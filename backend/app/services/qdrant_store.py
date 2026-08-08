import os
import uuid
from typing import Optional

from .embeddings import get_embedding_dimension, generate_embeddings_batch

# Primary collection for legal documents (cases, user uploads, etc.).
COLLECTION_NAME = "legal_documents"
# Dedicated collection for the AI Tutor curriculum (flashcard Q&A content).
# Kept physically separate so educational study material never mixes with
# legal document retrieval.
TUTOR_COLLECTION_NAME = "tutor_curriculum"
# Curated glossary definitions (glossary_seed.json). Separate from both so
# definition lookups never pollute case retrieval or curriculum searches.
GLOSSARY_SEED_COLLECTION_NAME = "glossary_seed"

_client = None

# Tracks collections whose payload indexes have already been ensured, so the
# per-call index creation stays quiet and idempotent across many requests.
_ensured_indexes: set[str] = set()

# Payload indexes created when a collection is first ensured. Filtered
# retrievals (point_exists checks, tutor topic lookups) then avoid full scans.
PAYLOAD_INDEXES = {
    TUTOR_COLLECTION_NAME: [("topic", "keyword")],
    COLLECTION_NAME: [("title", "keyword"), ("source", "keyword")],
}


def get_qdrant_client():
    global _client
    if _client is None:
        from qdrant_client import QdrantClient
        host = os.getenv("QDRANT_HOST", "localhost")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        _client = QdrantClient(host=host, port=port)
    return _client


def build_query_filter(filters: Optional[dict]) -> Optional[object]:
    """Convert a simple {field: value} dict into a Qdrant Filter.

    Returns None when no filters are given so callers can pass it straight
    to query_points without extra branching.
    """
    if not filters:
        return None
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    conditions = [
        FieldCondition(key=str(key), match=MatchValue(value=value))
        for key, value in filters.items()
    ]
    return Filter(must=conditions)


def create_collection_if_not_exists(collection_name: str = COLLECTION_NAME):
    client = get_qdrant_client()
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]

        if collection_name not in collection_names:
            client.create_collection(
                collection_name=collection_name,
                vectors_config={
                    "size": get_embedding_dimension(),
                    "distance": "Cosine",
                },
            )
    except Exception as e:
        print(f"Collection check: {e}")

    ensure_payload_indexes(collection_name)


def ensure_payload_indexes(collection_name: str = COLLECTION_NAME):
    """Create payload indexes for a collection once per process.

    Idempotent via a module-level set: each collection is only attempted
    once, so repeated boot calls and per-request create checks stay quiet.
    Failures are logged and swallowed — an index is an optimization, not a
    correctness requirement.
    """
    if collection_name in _ensured_indexes:
        return
    client = get_qdrant_client()
    for field, schema in PAYLOAD_INDEXES.get(collection_name, []):
        try:
            client.create_payload_index(
                collection_name=collection_name,
                field_name=field,
                field_schema=schema,
            )
        except Exception as e:
            print(f"Payload index creation skipped ({field}): {e}")
    _ensured_indexes.add(collection_name)


def add_points(points: list[dict], batch_size: int = 100, collection_name: str = COLLECTION_NAME):
    """Upsert pre-built points into a collection.

    Each point must be a dict with:
      - "content":  the text to embed (the retrieval surface)
      - "payload":  the metadata stored alongside the vector
    Used for content that is already structured (e.g. tutor curriculum
    cards) and should bypass the legal text chunker.
    """
    client = get_qdrant_client()
    create_collection_if_not_exists(collection_name)

    texts = [point["content"] for point in points]
    embeddings = generate_embeddings_batch(texts)

    qdrant_points = []
    for point, embedding in zip(points, embeddings):
        qdrant_points.append({
            "id": str(uuid.uuid4()),
            "vector": embedding,
            "payload": point["payload"],
        })

    for i in range(0, len(qdrant_points), batch_size):
        client.upsert(
            collection_name=collection_name,
            points=qdrant_points[i:i + batch_size],
        )


def add_documents(chunks: list[dict], batch_size: int = 100, collection_name: str = COLLECTION_NAME):
    client = get_qdrant_client()
    create_collection_if_not_exists(collection_name)

    texts = [chunk["content"] for chunk in chunks]
    embeddings = generate_embeddings_batch(texts)

    points = []
    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point = {
            "id": str(uuid.uuid4()),
            "vector": embedding,
            "payload": {
                "content": chunk["content"],
                "index": chunk.get("index", 0),
                "doc_type": chunk.get("doc_type", "general_legal"),
                "source": chunk.get("source", "unknown"),
                "title": chunk.get("title", "Unknown"),
                "heading": chunk.get("heading"),
                "opinion_id": chunk.get("opinion_id"),
                "cluster_id": chunk.get("cluster_id"),
                "citation": chunk.get("citation"),
                "court": chunk.get("court"),
                "date_filed": chunk.get("date_filed"),
            },
        }
        points.append(point)

        if len(points) >= batch_size:
            client.upsert(collection_name=collection_name, points=points)
            points = []

    if points:
        client.upsert(collection_name=collection_name, points=points)


def search_similar(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5,
    filters: Optional[dict] = None,
    collection_name: str = COLLECTION_NAME,
) -> list[dict]:
    from .embeddings import generate_embedding

    client = get_qdrant_client()
    create_collection_if_not_exists(collection_name)

    query_embedding = generate_embedding(query)
    query_filter = build_query_filter(filters)

    try:
        results = client.query_points(
            collection_name=collection_name,
            query=query_embedding,
            limit=top_k,
            score_threshold=min_score if min_score > 0 else None,
            query_filter=query_filter,
        )
    except Exception as e:
        print(f"Search error: {e}")
        results = client.query_points(
            collection_name=collection_name,
            query=query_embedding,
            limit=top_k,
            query_filter=query_filter,
        )

    # Curriculum points (tutor_curriculum) store their text only as the
    # embedding surface, never in the payload — so "content" falls back to
    # the payload question. The full payload is passed through for callers
    # that need structured fields (topic, difficulty, answer, ...).
    return [
        {
            "content": result.payload.get("content") or result.payload.get("question", "") or "",
            "score": result.score,
            "title": result.payload.get("title", "Unknown"),
            "source": result.payload.get("source", "unknown"),
            "doc_type": result.payload.get("doc_type", "general_legal"),
            "opinion_id": result.payload.get("opinion_id"),
            "cluster_id": result.payload.get("cluster_id"),
            "citation": result.payload.get("citation"),
            "court": result.payload.get("court"),
            "date_filed": result.payload.get("date_filed"),
            "payload": result.payload,
        }
        for result in results.points
    ]


def point_exists(collection_name: str, filters: dict) -> bool:
    """Return True if at least one point matches the given payload filters.

    Used for self-healing startup idempotency: seeding/ingestion skips a
    document when its points are already present, so repeated container
    boots never re-bloat the collection.
    """
    client = get_qdrant_client()
    try:
        results, _ = client.scroll(
            collection_name=collection_name,
            limit=1,
            scroll_filter=build_query_filter(filters),
            with_payload=False,
            with_vectors=False,
        )
        return len(results) > 0
    except Exception:
        return False


def collection_point_count(collection_name: str = COLLECTION_NAME) -> int:
    client = get_qdrant_client()
    try:
        info = client.get_collection(collection_name=collection_name)
        return int(getattr(info, "points_count", 0) or 0)
    except Exception:
        return 0


def get_collection_stats(collection_name: str = COLLECTION_NAME) -> dict:
    client = get_qdrant_client()
    try:
        info = client.get_collection(collection_name=collection_name)
        return {
            "name": collection_name,
            "vectors_count": getattr(info, "vectors_count", getattr(info, "indexed_vectors_count", 0)),
            "points_count": info.points_count,
            "status": info.status.name if hasattr(info.status, 'name') else str(info.status),
        }
    except Exception:
        return {
            "name": collection_name,
            "vectors_count": 0,
            "points_count": 0,
            "status": "not_initialized",
        }


def delete_collection(collection_name: str = COLLECTION_NAME):
    client = get_qdrant_client()
    try:
        client.delete_collection(collection_name=collection_name)
    except Exception:
        pass
