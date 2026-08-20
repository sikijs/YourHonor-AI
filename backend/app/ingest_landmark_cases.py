import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SEED_PATH = Path(__file__).parent / "data" / "landmark_seed.json"

# In-memory progress tracker for the background ingestion thread. Exposed to
# the frontend via GET /api/rag/ingestion-status so users can see landmark
# cases loading after a fresh boot. Lives in memory only — no DB writes.
INGESTION_PROGRESS = {
    "running": False,
    "total": 0,
    "done": 0,
    "failed": 0,
    "current": "",
}

# 85 landmark cases covering the standard 1L curriculum plus the deep
# constitutional-law threads used by the Doctrine Explorer. The names here
# MUST match the "name" keys in landmark_seed.json exactly — _get_or_fetch
# matches seeds by lowercase name, so mismatches silently fall back to a
# rate-limited CourtListener fetch on every boot.
LANDMARK_CASES = [
    # Existing core (24)
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
    # Contracts (5)
    {"name": "Hamer v. Sidway", "citation": "27 N.E. 256 (N.Y. 1891)", "year": 1891},
    {"name": "Hadley v. Baxendale", "citation": "9 Exch. 341 (1854)", "year": 1854},
    {"name": "Lucy v. Zehmer", "citation": "84 S.E.2d 516 (Va. 1954)", "year": 1954},
    {"name": "Williams v. Walker-Thomas Furniture Co.", "citation": "350 F.2d 445 (D.C. Cir. 1965)", "year": 1965},
    {"name": "Hawkins v. McGee", "citation": "146 A. 641 (N.H. 1929)", "year": 1929},
    # Torts (6)
    {"name": "Palsgraf v. Long Island Railroad", "citation": "248 N.Y. 339 (1928)", "year": 1928},
    {"name": "MacPherson v. Buick Motor Co.", "citation": "217 N.Y. 382 (1916)", "year": 1916},
    {"name": "Rylands v. Fletcher", "citation": "L.R. 3 H.L. 330 (1868)", "year": 1868},
    {"name": "United States v. Carroll Towing Co.", "citation": "159 F.2d 169 (2d Cir. 1947)", "year": 1947},
    {"name": "Escola v. Coca Cola Bottling Co.", "citation": "150 P.2d 436 (Cal. 1944)", "year": 1944},
    {"name": "Brown v. Kendall", "citation": "60 Mass. 292 (1850)", "year": 1850},
    # Property (5)
    {"name": "Pierson v. Post", "citation": "3 Cai. R. 175 (N.Y. 1805)", "year": 1805},
    {"name": "Johnson v. M'Intosh", "citation": "21 U.S. 543", "year": 1823},
    {"name": "Penn Central Transportation Co. v. New York City", "citation": "438 U.S. 104", "year": 1978},
    {"name": "State v. Shack", "citation": "277 A.2d 369 (N.J. 1971)", "year": 1971},
    {"name": "Kelo v. City of New London", "citation": "545 U.S. 469", "year": 2005},
    # Civil Procedure (4)
    {"name": "Pennoyer v. Neff", "citation": "95 U.S. 714", "year": 1878},
    {"name": "International Shoe Co. v. Washington", "citation": "326 U.S. 310", "year": 1945},
    {"name": "Asahi Metal Industry Co. v. Superior Court", "citation": "480 U.S. 102", "year": 1987},
    {"name": "Ashcroft v. Iqbal", "citation": "556 U.S. 662", "year": 2009},
    # Criminal Law & Procedure (5)
    {"name": "Terry v. Ohio", "citation": "392 U.S. 1", "year": 1968},
    {"name": "Katz v. United States", "citation": "389 U.S. 347", "year": 1967},
    {"name": "Chimel v. California", "citation": "395 U.S. 752", "year": 1969},
    {"name": "Brady v. Maryland", "citation": "373 U.S. 83", "year": 1963},
    {"name": "Batson v. Kentucky", "citation": "476 U.S. 79", "year": 1986},
    # First Amendment (6)
    {"name": "Brandenburg v. Ohio", "citation": "395 U.S. 444", "year": 1969},
    {"name": "Schenck v. United States", "citation": "249 U.S. 47", "year": 1919},
    {"name": "Texas v. Johnson", "citation": "491 U.S. 397", "year": 1989},
    {"name": "Tinker v. Des Moines Independent Community School District", "citation": "393 U.S. 503", "year": 1969},
    {"name": "New York Times v. United States", "citation": "403 U.S. 713", "year": 1971},
    {"name": "Wisconsin v. Yoder", "citation": "406 U.S. 205", "year": 1972},
    # Constitutional Law (15)
    {"name": "United States v. Nixon", "citation": "418 U.S. 683", "year": 1974},
    {"name": "Youngstown Sheet & Tube Co. v. Sawyer", "citation": "343 U.S. 579", "year": 1952},
    {"name": "United States v. Carolene Products Co.", "citation": "304 U.S. 144", "year": 1938},
    {"name": "Loving v. Virginia", "citation": "388 U.S. 1", "year": 1967},
    {"name": "Shelby County v. Holder", "citation": "570 U.S. 529", "year": 2013},
    {"name": "Wickard v. Filburn", "citation": "317 U.S. 111", "year": 1942},
    {"name": "New York v. United States", "citation": "505 U.S. 144", "year": 1992},
    {"name": "Lujan v. Defenders of Wildlife", "citation": "504 U.S. 555", "year": 1992},
    {"name": "Slaughter-House Cases", "citation": "83 U.S. 36", "year": 1873},
    {"name": "Grutter v. Bollinger", "citation": "539 U.S. 306", "year": 2003},
    {"name": "Furman v. Georgia", "citation": "408 U.S. 238", "year": 1972},
    {"name": "Near v. Minnesota", "citation": "283 U.S. 697", "year": 1931},
    {"name": "Lemon v. Kurtzman", "citation": "403 U.S. 602", "year": 1971},
    {"name": "Central Hudson Gas & Electric Corp. v. Public Service Commission", "citation": "447 U.S. 557", "year": 1980},
    {"name": "Buckley v. Valeo", "citation": "424 U.S. 1", "year": 1976},
    # Criminal Procedure — digital privacy (3)
    {"name": "Riley v. California", "citation": "573 U.S. 373", "year": 2014},
    {"name": "United States v. Jones", "citation": "565 U.S. 400", "year": 2012},
    {"name": "Carpenter v. United States", "citation": "585 U.S. 296", "year": 2018},
    # Criminal Procedure — trial rights (2)
    {"name": "Crawford v. Washington", "citation": "541 U.S. 36", "year": 2004},
    {"name": "Blakely v. Washington", "citation": "542 U.S. 296", "year": 2004},
    # Wills, Trusts & Estates (4)
    {"name": "Lucas v. Hamm", "citation": "56 Cal. 2d 583", "year": 1961},
    {"name": "Shapira v. Union National Bank", "citation": "315 N.E.2d 825 (Ohio Ct. Com. Pl. 1974)", "year": 1974},
    {"name": "Matter of Totten", "citation": "71 N.E. 748 (N.Y. 1904)", "year": 1904},
    {"name": "Farkas v. Williams", "citation": "125 N.E.2d 600 (Ill. 1955)", "year": 1955},
    # Agency & Partnership (4)
    {"name": "Gorton v. Doty", "citation": "69 P.2d 136 (Idaho 1937)", "year": 1937},
    {"name": "Gay Jenson Farms Co. v. Cargill, Inc.", "citation": "309 N.W.2d 285 (Minn. 1981)", "year": 1981},
    {"name": "Lind v. Schenley Industries", "citation": "278 F.2d 79 (3d Cir. 1960)", "year": 1960},
    {"name": "Meinhard v. Salmon", "citation": "249 N.Y. 458", "year": 1928},
    # Professional Responsibility (2)
    {"name": "In re Ryder", "citation": "263 F. Supp. 360 (E.D. Va. 1967)", "year": 1967},
    {"name": "Nix v. Whiteside", "citation": "475 U.S. 157", "year": 1986},
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

    INGESTION_PROGRESS.update(
        {"running": True, "total": total, "done": 0, "failed": 0, "current": ""}
    )

    logger.info(f"Landmark case ingestion: {total} cases (seed: {len(seed_data)} pre-seeded)")

    for i, case in enumerate(cases, 1):
        name = case["name"]
        citation = case["citation"]
        INGESTION_PROGRESS["current"] = name

        if _already_in_qdrant(name):
            skipped += 1
            INGESTION_PROGRESS["done"] = i
            logger.info(f"  [{i}/{total}] {name} — already in Qdrant, skipping")
            continue

        logger.info(f"  [{i}/{total}] {name} — processing...")
        result = _get_or_fetch(case, seed_data)

        if not result or not result.get("opinion_text"):
            failed += 1
            INGESTION_PROGRESS["done"] = i
            INGESTION_PROGRESS["failed"] = failed
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
            INGESTION_PROGRESS["done"] = i
            logger.info(f"  [{i}/{total}] {name} — ✓ ingested ({len(result['opinion_text'])} chars)")
        except Exception as e:
            failed += 1
            INGESTION_PROGRESS["done"] = i
            INGESTION_PROGRESS["failed"] = failed
            logger.error(f"  [{i}/{total}] {name} — ✗ error: {e}")

        if name.lower() not in seed_data:
            _save_to_cache(name, result)
            time.sleep(12)

    INGESTION_PROGRESS.update({"running": False, "current": ""})

    logger.info(
        f"Landmark case ingestion complete: "
        f"{ingested} ingested, {skipped} skipped, {failed} failed"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ingest_landmark_cases()
