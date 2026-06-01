import os
import re
import json
import time
from typing import Optional

import httpx

from app.db import get_db

COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4"
COURTLISTENER_TOKEN = os.getenv("COURTLISTENER_TOKEN", "")

_cache: dict[str, dict] = {}
_cache_ttl: int = 300


def _cache_get(query_key: str) -> Optional[dict]:
    try:
        conn = get_db()
        row = conn.execute(
            "SELECT case_name, court, date_filed, citations, opinion_text FROM opinions_cache WHERE query_key = ?",
            (query_key,)
        ).fetchone()
        conn.close()
        if row:
            return {
                "case_name": row["case_name"],
                "court": row["court"] or "",
                "date_filed": row["date_filed"] or "",
                "citations": json.loads(row["citations"]) if row["citations"] else [],
                "opinion_text": row["opinion_text"] or "",
            }
    except Exception:
        pass
    return None


def _cache_set(query_key: str, data: dict):
    try:
        conn = get_db()
        conn.execute(
            """INSERT OR REPLACE INTO opinions_cache
               (query_key, case_name, court, date_filed, citations, opinion_text)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                query_key,
                data["case_name"],
                data.get("court", ""),
                data.get("date_filed", ""),
                json.dumps(data.get("citations", [])),
                data.get("opinion_text", ""),
            )
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def _get_headers() -> dict:
    headers = {"Accept": "application/json"}
    if COURTLISTENER_TOKEN:
        headers["Authorization"] = f"Token {COURTLISTENER_TOKEN}"
    return headers


def _has_auth() -> bool:
    return bool(COURTLISTENER_TOKEN)


def _cached(key: str, value: Optional[dict] = None) -> Optional[dict]:
    now = time.time()
    if value is not None:
        _cache[key] = {"data": value, "ts": now}
        return value
    entry = _cache.get(key)
    if entry and now - entry["ts"] < _cache_ttl:
        return entry["data"]
    return None


def _clean_query(query: str) -> str:
    citation_patterns = [
        r"\d+\s+U\.?\s*S\.?\s*\d+",
        r"\d+\s+S\.?\s*Ct\.?\s*\d+",
        r"\d+\s+L\.?\s*Ed\.?\s*\d+",
        r"\d+\s+F\.\d*d\s+\d+",
        r"\d+\s+Cranch\s+\d+",
        r"\d+\s+N\.\s*E\.\d*\s+\d+",
        r"\d+\s+N\.\s*W\.\d*\s+\d+",
        r"\d+\s+P\.\d*\s+\d+",
        r"\d+\s+Cal\.\d*\s+\d+",
        r"\d+\s+F\.\s*Supp\.\s*\d+",
    ]
    for pattern in citation_patterns:
        query = re.sub(pattern, "", query, flags=re.IGNORECASE)
    query = re.sub(r"\s+", " ", query).strip()
    return query


def _request(url: str, params: Optional[dict] = None, data: Optional[dict] = None, timeout: float = 15.0) -> httpx.Response:
    cache_key = f"{url}?{params}|{data}" if params or data else url
    cached = _cached(cache_key)
    if isinstance(cached, httpx.Response):
        return cached

    max_retries = 2
    for attempt in range(max_retries):
        if data is not None:
            response = httpx.post(url, data=data, headers=_get_headers(), timeout=timeout)
        else:
            response = httpx.get(url, params=params, headers=_get_headers(), timeout=timeout)
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", "10"))
            wait = min(retry_after, 15)
            time.sleep(wait)
            continue
        if response.status_code != 200:
            response.raise_for_status()
        _cached(cache_key, response)
        return response
    raise httpx.HTTPStatusError("Rate limit exceeded after retries", request=None, response=response)


def search_opinions(
    query: str,
    court: Optional[str] = None,
    page_size: int = 5,
) -> list[dict]:
    cleaned = _clean_query(query)
    params = {
        "q": cleaned,
        "page_size": min(page_size, 50),
    }
    if court:
        params["court"] = court

    try:
        response = _request(f"{COURTLISTENER_BASE}/search/", params=params)
        data = response.json()
    except Exception as e:
        return [{
            "case_name": query,
            "source": "courtlistener_error",
            "error": str(e),
            "score": 0,
            "snippet": "",
        }]

    results = []
    for result in data.get("results", [])[:page_size]:
        cluster_id = result.get("cluster_id")
        if isinstance(cluster_id, str):
            match = re.search(r"/(\d+)/", cluster_id)
            cluster_id = int(match.group(1)) if match else None

        opinions = result.get("opinions", [])
        opinion_id = opinions[0].get("id") if opinions else None

        results.append({
            "case_name": result.get("caseName", ""),
            "court": result.get("court", ""),
            "court_id": result.get("court_id", ""),
            "date_filed": result.get("dateFiled", ""),
            "cluster_id": cluster_id,
            "opinion_id": opinion_id,
            "citation": result.get("citation", []),
            "snippet": result.get("syllabus", "") or result.get("snippet", ""),
            "score": result.get("score", 0),
            "source": "courtlistener",
        })
    return results


def get_opinion_by_id(opinion_id: int) -> Optional[dict]:
    if not _has_auth():
        return {"error": "auth_required", "plain_text": ""}

    try:
        response = _request(f"{COURTLISTENER_BASE}/opinions/{opinion_id}/")
        data = response.json()
    except Exception as e:
        return {"error": str(e), "plain_text": ""}

    return _extract_text_from_opinion(data)


def _extract_text_from_opinion(data: dict) -> dict:
    plain_text = data.get("plain_text", "") or ""
    if plain_text:
        plain_text = re.sub(r"<[^>]+>", "", plain_text)
        plain_text = re.sub(r"\s+", " ", plain_text).strip()
        if plain_text:
            return {"id": data.get("id"), "type": data.get("type", ""),
                    "author": data.get("author", ""), "plain_text": plain_text}

    for field in ["html", "html_lawbox", "html_columbia", "html_anon_2020"]:
        content = data.get(field, "") or ""
        if content:
            text = re.sub(r"<[^>]+>", "", content)
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                return {"id": data.get("id"), "type": data.get("type", ""),
                        "author": data.get("author", ""), "plain_text": text}

    xml = data.get("xml_harvard", "") or ""
    if xml:
        text = re.sub(r"<[^>]+>", "", xml)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            return {"id": data.get("id"), "type": data.get("type", ""),
                    "author": data.get("author", ""), "plain_text": text}

    return {"error": "no_text_found", "plain_text": ""}


def _lookup_citation(text: str) -> Optional[dict]:
    if not _has_auth():
        return None
    try:
        response = _request(f"{COURTLISTENER_BASE}/citation-lookup/", data={"text": text})
        results = response.json()
        if not results:
            return None
        best = results[0]
        clusters = best.get("clusters", [])
        if not clusters or best.get("status") != 200:
            return None
        return clusters[0]
    except Exception:
        return None


def _extract_opinion_id_from_cluster(cluster: dict) -> Optional[int]:
    sub_opinions = cluster.get("sub_opinions", [])
    if sub_opinions:
        match = re.search(r"/opinions/(\d+)/", sub_opinions[0])
        if match:
            return int(match.group(1))
    return None


def case_brief_from_query(query: str) -> Optional[dict]:
    query_key = _clean_query(query).lower()
    cached = _cache_get(query_key)
    if cached:
        return {
            **cached,
            "opinion_id": None,
            "cluster_id": None,
            "source": "cache",
        }

    cluster = _lookup_citation(query)
    if cluster:
        cluster_id = cluster.get("id")
        case_name = cluster.get("case_name", query)
        court = cluster.get("court", "")
        date_filed = cluster.get("date_filed", "")
        citations = [f'{c.get("volume", "")} {c.get("reporter", "")} {c.get("page", "")}'.strip()
                     for c in cluster.get("citations", [])]
        opinion_id = _extract_opinion_id_from_cluster(cluster)
    else:
        results = search_opinions(query, page_size=3)
        if not results or results[0].get("error"):
            return None
        best = results[0]
        cluster_id = best.get("cluster_id")
        case_name = best["case_name"]
        court = best.get("court", "")
        date_filed = best.get("date_filed", "")
        citations = best.get("citation", [])
        opinion_id = best.get("opinion_id")

    opinion_data = None
    if _has_auth() and opinion_id:
        mem_cached = _cached(f"opinion_{opinion_id}")
        if mem_cached:
            opinion_data = mem_cached
        else:
            opinion_data = get_opinion_by_id(opinion_id)
            if not opinion_data or not opinion_data.get("plain_text"):
                opinion_data = None
            else:
                _cached(f"opinion_{opinion_id}", opinion_data)

    result = {
        "case_name": case_name,
        "citation": citations,
        "court": court,
        "date_filed": date_filed,
        "opinion_text": opinion_data["plain_text"] if opinion_data else "",
        "snippet": "",
        "opinion_id": opinion_id,
        "cluster_id": cluster_id,
        "source": "courtlistener",
    }

    if not _has_auth():
        result["auth_note"] = "Set COURTLISTENER_TOKEN for full opinion text"

    if result.get("opinion_text"):
        _cache_set(query_key, result)

    return result
