"""Per-user study statistics for the dashboard.

All aggregations run against SQLite directly (no LLM calls, no Qdrant),
so the endpoint is instant and free. The tutor numbers are limited to the
persisted `review_progress` table (cards marked in review sessions); live
session performance is in-memory only and not included.
"""

from app import db
from app.services.tutor_data import TOPICS


def get_user_stats(user_id: int) -> dict:
    conn = db.get_db()
    try:
        by_type = conn.execute(
            """
            SELECT COALESCE(doc_type, '') AS doc_type, COUNT(*) AS count
            FROM documents
            WHERE user_id = ?
            GROUP BY doc_type
            ORDER BY count DESC, doc_type ASC
            """,
            (user_id,),
        ).fetchall()

        notes_total = conn.execute(
            "SELECT COUNT(*) AS count FROM notes WHERE user_id = ?",
            (user_id,),
        ).fetchone()["count"]

        review_rows = conn.execute(
            """
            SELECT got_it, COUNT(*) AS count
            FROM review_progress
            WHERE user_id = ?
            GROUP BY got_it
            """,
            (user_id,),
        ).fetchall()

        weak_topics = conn.execute(
            """
            SELECT topic_id, COUNT(*) AS count
            FROM review_progress
            WHERE user_id = ? AND got_it = 0
            GROUP BY topic_id
            ORDER BY count DESC
            """,
            (user_id,),
        ).fetchall()

        age_row = conn.execute(
            """
            SELECT CAST(MAX(0, julianday('now') - julianday(created_at)) AS INTEGER) AS age_days
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
    finally:
        conn.close()

    mastered = next((r["count"] for r in review_rows if r["got_it"] == 1), 0)
    weak = next((r["count"] for r in review_rows if r["got_it"] == 0), 0)

    return {
        "account_age_days": age_row["age_days"] if age_row else 0,
        "documents_total": sum(r["count"] for r in by_type),
        "documents_by_type": [
            {"doc_type": r["doc_type"], "count": r["count"]} for r in by_type
        ],
        "notes_total": notes_total,
        "tutor_review": {
            "total_reviewed": mastered + weak,
            "mastered": mastered,
            "weak": weak,
            "weak_topics": [
                {
                    "topic_id": r["topic_id"],
                    "topic_name": TOPICS.get(r["topic_id"], {}).get("name", r["topic_id"]),
                    "weak_count": r["count"],
                }
                for r in weak_topics
            ],
        },
    }