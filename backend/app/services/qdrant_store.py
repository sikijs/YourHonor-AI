import os
import uuid
from typing import Optional

from .embeddings import get_embedding_dimension, generate_embeddings_batch

COLLECTION_NAME = "legal_documents"

_client = None


def get_qdrant_client():
    global _client
    if _client is None:
        from qdrant_client import QdrantClient
        host = os.getenv("QDRANT_HOST", "localhost")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        _client = QdrantClient(host=host, port=port)
    return _client


def create_collection_if_not_exists():
    client = get_qdrant_client()
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if COLLECTION_NAME not in collection_names:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config={
                    "size": get_embedding_dimension(),
                    "distance": "Cosine"
                }
            )
    except Exception as e:
        print(f"Collection check: {e}")


def add_documents(chunks: list[dict], batch_size: int = 100):
    client = get_qdrant_client()
    create_collection_if_not_exists()
    
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
            client.upsert(collection_name=COLLECTION_NAME, points=points)
            points = []
    
    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)


def search_similar(
    query: str,
    top_k: int = 5,
    min_score: float = 0.5,
    filters: Optional[dict] = None,
) -> list[dict]:
    from .embeddings import generate_embedding
    
    client = get_qdrant_client()
    create_collection_if_not_exists()
    
    query_embedding = generate_embedding(query)
    
    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_embedding,
            limit=top_k,
            score_threshold=min_score if min_score > 0 else None,
        )
    except Exception as e:
        print(f"Search error: {e}")
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_embedding,
            limit=top_k,
        )
    
    return [
        {
            "content": result.payload["content"],
            "score": result.score,
            "title": result.payload.get("title", "Unknown"),
            "source": result.payload.get("source", "unknown"),
            "doc_type": result.payload.get("doc_type", "general_legal"),
            "opinion_id": result.payload.get("opinion_id"),
            "cluster_id": result.payload.get("cluster_id"),
            "citation": result.payload.get("citation"),
            "court": result.payload.get("court"),
            "date_filed": result.payload.get("date_filed"),
        }
        for result in results.points
    ]


def get_collection_stats() -> dict:
    client = get_qdrant_client()
    try:
        info = client.get_collection(collection_name=COLLECTION_NAME)
        return {
            "name": COLLECTION_NAME,
            "vectors_count": getattr(info, "vectors_count", getattr(info, "indexed_vectors_count", 0)),
            "points_count": info.points_count,
            "status": info.status.name if hasattr(info.status, 'name') else str(info.status),
        }
    except Exception:
        return {
            "name": COLLECTION_NAME,
            "vectors_count": 0,
            "points_count": 0,
            "status": "not_initialized",
        }


def delete_collection():
    client = get_qdrant_client()
    try:
        client.delete_collection(collection_name=COLLECTION_NAME)
    except Exception:
        pass