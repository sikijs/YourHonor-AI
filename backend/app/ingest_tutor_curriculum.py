import logging

from app.services.tutor_data import TOPICS
from app.services.qdrant_store import TUTOR_COLLECTION_NAME, add_points, delete_collection

logger = logging.getLogger(__name__)

# Cards carry static payload values (not a list of sub-dicts), so they can be
# placed straight into a Qdrant payload. This tag distinguishes curriculum
# points from legal document points if anyone ever scans the collection.
CARD_KIND = "curriculum"


def build_curriculum_points() -> list[dict]:
    """Build one retrieval point per AI Tutor curriculum card.

    The card's question, hint, concepts, and answer are merged into a single
    ``content`` string that becomes the embedding surface, while the structured
    fields are kept verbatim in ``payload`` so later stages (tutor grounding,
    glossary badges, answer reveals) can read them directly without re-parsing
    LLM output.
    """
    points: list[dict] = []
    for topic_id, topic in TOPICS.items():
        for index, q in enumerate(topic["questions"]):
            concepts = ", ".join(q.expected_concepts)
            content = (
                f"Question: {q.question}\n"
                f"Hint: {q.hint}\n"
                f"Concepts: {concepts}\n"
                f"Answer: {q.answer or ''}"
            )
            points.append({
                "content": content,
                "payload": {
                    "kind": CARD_KIND,
                    "topic": topic_id,
                    "topic_name": topic["name"],
                    "question_index": index,
                    "question": q.question,
                    "hint": q.hint,
                    "deep_hint": q.deep_hint,
                    "expected_concepts": q.expected_concepts,
                    "difficulty": q.difficulty,
                    "answer": q.answer,
                },
            })
    return points


def seed_tutor_curriculum() -> int:
    """Rebuild the tutor_curriculum collection from static card data.

    The curriculum is fully derived from Python source, so we delete and
    recreate it on every boot. This guarantees the collection always matches
    the current card definitions, never grows, and stays idempotent without
    existence checks.
    """
    points = build_curriculum_points()
    try:
        delete_collection(TUTOR_COLLECTION_NAME)
        add_points(points, collection_name=TUTOR_COLLECTION_NAME)
        logger.info(f"Tutor curriculum seeded: {len(points)} cards into {TUTOR_COLLECTION_NAME}")
        return len(points)
    except Exception as e:
        logger.warning(f"Tutor curriculum seeding failed: {e}")
        return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seeding = seed_tutor_curriculum()
    print(f"Seeded {seeding} curriculum cards")