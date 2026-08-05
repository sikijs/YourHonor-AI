import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SEED_PATH = Path(__file__).parent / "data" / "landmark_seed.json"

LANDMARK_CASES = [
    {"name": "Marbury v. Madison", "citation": "5 U.S. 137", "year": 1803},
    {"name": "McCulloch v. Maryland", "citation": "17 U.S. 316", "year": 1819},
    {"name": "Gibbons v. Ogden", "citation": "22 U.S. 1", "year": 1824},
    {"name": "Brown v. Board of Education", "citation": "347 U.S. 483", "year": 1954},
    {"name": "Miranda v. Arizona", "citation": "384 U.S. 436", "year": 1966},
    {"name": "Roe v. Wade", "citation": "410 U.S. 113", "year": 1973},
    {"name": "Dobbs v. Jackson Women's Health", "citation": "597 U.S. 215", "year": 2022},
    {"name": "Obergefell v. Hodges", "citation": "576 U.S. 644", "year": 2015},
    {"name": "Gideon v. Wainwright", "citation": "372 U.S. 335", "year": 1963},
    {"name": "Plessy v. Ferguson", "citation": "163 U.S. 537", "year": 1896},
    {"name": "Citizens United v. FEC", "citation": "558 U.S. 310", "year": 2010},
    {"name": "District of Columbia v. Heller", "citation": "554 U.S. 570", "year": 2008},
    {"name": "New York Times v. Sullivan", "citation": "376 U.S. 254", "year": 1964},
    {"name": "Mapp v. Ohio", "citation": "367 U.S. 643", "year": 1961},
    {"name": "United States v. Lopez", "citation": "514 U.S. 549", "year": 1995},
    {"name": "Lawrence v. Texas", "citation": "539 U.S. 558", "year": 2003},
    {"name": "Korematsu v. United States", "citation": "323 U.S. 214", "year": 1944},
    {"name": "Baker v. Carr", "citation": "369 U.S. 186", "year": 1962},
    {"name": "Erie Railroad v. Tompkins", "citation": "304 U.S. 64", "year": 1938},
    {"name": "Griswold v. Connecticut", "citation": "381 U.S. 479", "year": 1965},
    {"name": "Employment Division v. Smith", "citation": "494 U.S. 872", "year": 1990},
    {"name": "Miller v. California", "citation": "413 U.S. 15", "year": 1973},
    {"name": "Shaw v. Reno", "citation": "509 U.S. 630", "year": 1993},
    {"name": "Chevron v. NRDC", "citation": "467 U.S. 837", "year": 1984},
]


def _already_in_qdrant(title: str) -> bool:
    from app.services.qdrant_store import point_exists, COLLECTION_NAME
    try:
        return point_exists(COLLECTION_NAME, {"title": title, "source": "courtlistener_ingested"})
    except Exception:
        return False


def _load_seed_data() -> dict:
    """Load pre-seeded landmark cases from JSON file in image."""
    if not SEED_PATH.exists():
        logger.info("No landmark seed file found at %s", SEED_PATH)
        return {}
    try:
        with open(SEED_PATH) as f:
            cases = json.load(f)
        by_name = {}
        for c in cases:
            by_name[c["name"].lower()] = c
        logger.info(f"Loaded {len(by_name)} cases from landmark seed file")
        return by_name
    except Exception as e:
        logger.warning(f"Failed to load landmark seed file: {e}")
        return {}


def _get_or_fetch(case: dict, seed_data: dict) -> Optional[dict]:
    name_lower = case["name"].lower()
    if name_lower in seed_data:
        entry = seed_data[name_lower]
        result = {
            "case_name": entry.get("case_name", case["name"]),
            "opinion_text": entry.get("opinion_text", ""),
            "source": "seed",
            "opinion_id": entry.get("opinion_id"),
            "cluster_id": entry.get("cluster_id"),
            "court": entry.get("court", ""),
            "date_filed": entry.get("date_filed", ""),
            "citation": entry.get("citation", []),
        }
        if result["opinion_text"] and len(result["opinion_text"]) >= 200:
            logger.info(f"  {case['name']} — using pre-seeded data")
            return result
        logger.info(f"  {case['name']} — seed text too short, falling back to API")

    from connectors.courtlistener import case_brief_from_query
    result = case_brief_from_query(f"{case['name']} {case['citation']}")
    if not result:
        return None
    text = result.get("opinion_text", "")
    if not text or len(text) < 200:
        return None
    return result


def _save_to_cache(case_name: str, result: dict):
    """Save fetched case to SQLite cache for future startups."""
    try:
        from app.db import get_db
        from connectors.courtlistener import _cache_set
        query_key = case_name.lower()
        _cache_set(query_key, {
            "case_name": result.get("case_name", case_name),
            "court": result.get("court", ""),
            "date_filed": result.get("date_filed", ""),
            "citations": result.get("citation", []),
            "opinion_text": result.get("opinion_text", ""),
            "opinion_id": result.get("opinion_id"),
            "cluster_id": result.get("cluster_id"),
        })
    except Exception:
        pass


def ingest_landmark_cases(max_cases: Optional[int] = None):
    from connectors.courtlistener import _has_auth

    seed_data = _load_seed_data()
    has_token = _has_auth()

    cases = LANDMARK_CASES[:max_cases] if max_cases else LANDMARK_CASES
    total = len(cases)
    ingested = 0
    skipped = 0
    failed = 0

    logger.info(f"Landmark case ingestion: {total} cases (seed: {len(seed_data)} pre-seeded)")

    for i, case in enumerate(cases, 1):
        name = case["name"]
        citation = case["citation"]

        if _already_in_qdrant(name):
            skipped += 1
            logger.info(f"  [{i}/{total}] {name} — already in Qdrant, skipping")
            continue

        logger.info(f"  [{i}/{total}] {name} — processing...")
        result = _get_or_fetch(case, seed_data)

        if not result or not result.get("opinion_text"):
            failed += 1
            logger.warning(f"  [{i}/{total}] {name} — no text available, skipping")
            if not has_token and name.lower() not in seed_data:
                logger.warning(f"  [{i}/{total}] {name} — set COURTLISTENER_TOKEN in .env")
            time.sleep(2)
            continue

        try:
            from app.services.ingestion import get_ingestion_service
            get_ingestion_service().ingest_document(
                content=result["opinion_text"],
                title=name,
                source="courtlistener_ingested",
                metadata={
                    "doc_type": "case_law",
                    "category": "landmark_case",
                    "citation": citation,
                    "year": case["year"],
                    "opinion_id": result.get("opinion_id"),
                    "cluster_id": result.get("cluster_id"),
                },
            )
            ingested += 1
            logger.info(f"  [{i}/{total}] {name} — ✓ ingested ({len(result['opinion_text'])} chars)")
        except Exception as e:
            failed += 1
            logger.error(f"  [{i}/{total}] {name} — ✗ error: {e}")

        if name.lower() not in seed_data:
            _save_to_cache(name, result)
            time.sleep(12)

    logger.info(
        f"Landmark case ingestion complete: "
        f"{ingested} ingested, {skipped} skipped, {failed} failed"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ingest_landmark_cases()
