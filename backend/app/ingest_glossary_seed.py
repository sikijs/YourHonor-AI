import json
import logging
import time
from pathlib import Path

from app.services.qdrant_store import GLOSSARY_SEED_COLLECTION_NAME, add_points, delete_collection

logger = logging.getLogger(__name__)

SEED_RETRY_ATTEMPTS = 2
SEED_RETRY_BACKOFF_SECONDS = 5

SEED_PATH = Path(__file__).parent / "data" / "glossary_seed.json"

# Tag distinguishing glossary points from curriculum/legal-document points
# if anyone ever scans the collection.
GLOSSARY_KIND = "glossary_seed"


def _load_seed_entries() -> list[dict]:
    """Load the curated glossary entries from the JSON file in the image."""
    if not SEED_PATH.exists():
        logger.warning(f"Glossary seed file not found at {SEED_PATH}")
        return []
    try:
        with open(SEED_PATH) as f:
            entries = json.load(f)
        logger.info(f"Loaded {len(entries)} glossary seed entries")
        return entries
    except Exception as e:
        logger.warning(f"Failed to load glossary seed file: {e}")
        return []


def build_glossary_seed_points() -> list[dict]:
    """Build one retrieval point per curated glossary entry.

    The embedding surface merges the term, definition, usage example, and
    related terms so paraphrase queries (e.g. "intent to commit a crime")
    still match semantically. Structured fields are kept verbatim in the
    payload so the glossary service can serve them directly without an LLM.
    """
    points: list[dict] = []
    for entry in _load_seed_entries():
        term = entry.get("term", "").strip()
        if not term:
            continue
        related = ", ".join(str(t) for t in entry.get("related_terms", []))
        content = (
            f"Term: {term}\n"
            f"Definition: {entry.get('definition', '')}\n"
            f"Usage example: {entry.get('usage_example', '')}\n"
            f"Related terms: {related}"
        )
        points.append({
            "content": content,
            "payload": {
                "kind": GLOSSARY_KIND,
                "term": term,
                "definition": entry.get("definition", ""),
                "etymology": entry.get("etymology"),
                "jurisdiction": entry.get("jurisdiction"),
                "usage_example": entry.get("usage_example", ""),
                "related_terms": entry.get("related_terms", []),
                "also_known_as": entry.get("also_known_as"),
                "practice_tips": entry.get("practice_tips"),
            },
        })
    return points


def seed_glossary_seed_collection() -> int:
    """Rebuild the glossary_seed collection from the JSON file on every boot.

    Same delete-and-recreate pattern as the tutor curriculum: the collection
    is fully derived from a checked-in source, so this stays idempotent and
    always in sync with the JSON.
    """
    points = build_glossary_seed_points()
    for attempt in range(1, SEED_RETRY_ATTEMPTS + 1):
        try:
            delete_collection(GLOSSARY_SEED_COLLECTION_NAME)
            add_points(points, collection_name=GLOSSARY_SEED_COLLECTION_NAME)
            logger.info(
                f"Glossary seed collection seeded: {len(points)} entries into {GLOSSARY_SEED_COLLECTION_NAME}"
            )
            return len(points)
        except Exception as e:
            logger.warning(
                f"Glossary seed collection seeding failed (attempt {attempt}/{SEED_RETRY_ATTEMPTS}): {e}",
                exc_info=True,
            )
            if attempt < SEED_RETRY_ATTEMPTS:
                time.sleep(SEED_RETRY_BACKOFF_SECONDS)
    logger.error("Glossary seed collection seeding failed after all retries")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seeded = seed_glossary_seed_collection()
    print(f"Seeded {seeded} glossary entries")
