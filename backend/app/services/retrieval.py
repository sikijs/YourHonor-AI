import re
import json
import logging
from typing import Any
from typing import Optional
from .qdrant_store import search_similar, get_collection_stats, COLLECTION_NAME, TUTOR_COLLECTION_NAME
from connectors.courtlistener import case_brief_from_query

logger = logging.getLogger(__name__)


class RetrievalService:
    def __init__(self, top_k: int = 5, min_score: float = 0.5):
        self.top_k = top_k
        self.min_score = min_score

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        min_score: Optional[float] = None,
        filters: Optional[dict] = None,
        collection_name: str = COLLECTION_NAME,
    ) -> list[dict]:
        k = top_k if top_k is not None else self.top_k
        threshold = min_score if min_score is not None else self.min_score
        
        results = search_similar(
            query=query,
            top_k=k,
            min_score=threshold,
            filters=filters,
            collection_name=collection_name,
        )
        
        return results

    def retrieve_case(self, case_name: str) -> Optional[dict]:
        return case_brief_from_query(case_name)

    def get_stats(self, collection_name: str = COLLECTION_NAME) -> dict:
        return get_collection_stats(collection_name)


retrieval_service = RetrievalService()


def get_retrieval_service() -> RetrievalService:
    return retrieval_service


def retrieve_curriculum(
    query: str,
    top_k: int = 3,
    min_score: float = 0.45,
    topic: Optional[str] = None,
) -> list[dict]:
    """Semantic search over the AI Tutor curriculum collection.

    Returns search_similar-style dicts where ``content`` is the card's
    question (curriculum points have no payload ``content`` key) and the
    full ``payload`` carries the structured card fields (topic, difficulty,
    answer, expected_concepts, ...). A ``topic`` filter narrows results to
    one subject (e.g. ``"contracts"``). Empty results are returned as ``[]``
    so callers can fall back gracefully when Qdrant is unavailable.
    """
    filters = {"topic": topic} if topic else None
    results = search_similar(
        query=query,
        top_k=top_k,
        min_score=min_score,
        filters=filters,
        collection_name=TUTOR_COLLECTION_NAME,
    )
    return [r for r in results if r.get("content")]


def curriculum_card_from_payload(payload: Optional[dict]) -> Optional[dict]:
    """Convert a tutor_curriculum payload into a CurriculumCard-shaped dict.

    Returns None when the payload has no question (defensive: malformed or
    non-curriculum points). Kept model-free so both the glossary and tutor
    services can build their own Pydantic cards from one shared converter.
    """
    if not payload:
        return None
    question = payload.get("question")
    if not question:
        return None
    return {
        "question": question,
        "answer": payload.get("answer") or "",
        "topic_id": payload.get("topic") or "",
        "topic_name": payload.get("topic_name") or "",
        "difficulty": payload.get("difficulty") or 1,
        "expected_concepts": payload.get("expected_concepts") or [],
    }


def deduplicate_rag_results(results: list[dict], min_content_length: int = 200) -> list[dict]:
    seen = set()
    filtered = []
    for r in results:
        content = r.get("content", "")
        if not content or len(content) < min_content_length:
            continue
        h = content[:min(100, len(content) // 2)]
        if h not in seen:
            seen.add(h)
            filtered.append(r)
    return filtered


def parse_llm_json(raw: str) -> dict:
    raw_clean = raw.strip()
    if raw_clean.startswith("```"):
        raw_clean = raw_clean.split("\n", 1)[-1] if "\n" in raw_clean else raw_clean
        raw_clean = raw_clean.rsplit("```", 1)[0] if "```" in raw_clean else raw_clean
        raw_clean = raw_clean.strip()
    brace_idx = raw_clean.find("{")
    if brace_idx >= 0:
        raw_clean = raw_clean[brace_idx:]
    close_idx = raw_clean.rfind("}")
    if close_idx >= 0:
        raw_clean = raw_clean[: close_idx + 1]

    if not raw_clean:
        raise ValueError("Empty JSON after cleanup")

    def _try_parse(text: str) -> Optional[dict]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    parsed = _try_parse(raw_clean)
    if parsed is not None:
        return parsed

    raw_clean = raw_clean.replace("\\'", "'")
    parsed = _try_parse(raw_clean)
    if parsed is not None:
        return parsed

    raw_clean_py = re.sub(r"'", "\"", raw_clean)
    raw_clean_py = re.sub(r'(\w+):', r'"\1":', raw_clean_py)
    parsed = _try_parse(raw_clean_py)
    if parsed is not None:
        return parsed

    import ast
    try:
        parsed = ast.literal_eval(raw_clean)
        return parsed
    except Exception:
        pass

    logger.error(f"LLM raw response (first 500 chars): {raw[:500]}")
    raise ValueError(f"Could not parse LLM JSON response")