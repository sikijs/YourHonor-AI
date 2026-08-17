from pydantic import BaseModel
from typing import Optional
from urllib.parse import quote


class SourceDocument(BaseModel):
    title: str
    source_type: str  # "courtlistener" | "rag" | "user_upload" | "web" | "seed" | "none"
    url: Optional[str] = None
    citation: Optional[str] = None
    court: Optional[str] = None
    date_filed: Optional[str] = None
    relevance_score: Optional[float] = None


def build_source_url(opinion_id: Optional[int], cluster_id: Optional[int], title: Optional[str] = None) -> Optional[str]:
    if opinion_id:
        return f"https://www.courtlistener.com/opinion/{opinion_id}/"
    if cluster_id:
        return f"https://www.courtlistener.com/cluster/{cluster_id}/"
    if title:
        return f"https://www.courtlistener.com/?q={quote(title)}"
    return None


def from_rag_result(result: dict) -> Optional[SourceDocument]:
    title = result.get("title") or "Unknown"
    if not title:
        return None
    opinion_id = result.get("opinion_id")
    cluster_id = result.get("cluster_id")
    citation_list = result.get("citation") or result.get("citations") or []
    citation_str = ", ".join(citation_list) if isinstance(citation_list, list) else str(citation_list) if citation_list else None
    return SourceDocument(
        title=title,
        source_type=result.get("source", "rag"),
        url=build_source_url(opinion_id, cluster_id, title),
        citation=citation_str,
        court=result.get("court"),
        date_filed=result.get("date_filed"),
        relevance_score=result.get("score"),
    )


def from_rag_results(results: list[dict]) -> list[SourceDocument]:
    seen: set[str] = set()
    sources: list[SourceDocument] = []
    for r in results:
        s = from_rag_result(r)
        if s and s.title not in seen:
            seen.add(s.title)
            sources.append(s)
    return sources


def from_courtlistener_case(data: dict) -> list[SourceDocument]:
    title = data.get("case_name") or "Unknown"
    opinion_id = data.get("opinion_id")
    cluster_id = data.get("cluster_id")
    citation_list = data.get("citation") or data.get("citations") or []
    citation_str = ", ".join(citation_list) if isinstance(citation_list, list) else str(citation_list) if citation_list else None
    if not title:
        return []
    url = data.get("url")
    if not url or not url.startswith(("http://", "https://")):
        url = build_source_url(opinion_id, cluster_id, title)
    return [SourceDocument(
        title=title,
        source_type="courtlistener",
        url=url,
        citation=citation_str,
        court=data.get("court"),
        date_filed=data.get("date_filed"),
    )]


def from_user_upload(title: str) -> list[SourceDocument]:
    if not title:
        return []
    return [SourceDocument(
        title=title,
        source_type="user_upload",
    )]


def from_web_search(results: list[dict]) -> list[SourceDocument]:
    sources: list[SourceDocument] = []
    seen: set[str] = set()
    for r in results:
        title = r.get("title") or r.get("href") or "Unknown"
        if title not in seen:
            seen.add(title)
            sources.append(SourceDocument(
                title=title,
                source_type="web",
                url=r.get("href"),
                relevance_score=r.get("relevance_score"),
            ))
    return sources
