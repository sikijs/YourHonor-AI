"""Per-user study statistics for the dashboard.

All aggregations run against SQLite directly (no LLM calls, no Qdrant),
so the endpoint is instant and free. Tutor numbers cover the persisted
`review_progress` table (cards marked in review sessions) and completed
live sessions in `tutor_sessions` (written when a curriculum, dynamic, or
MC session finishes). Abandoned mid-session progress is in-memory only
and not included.
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

        session_rows = conn.execute(
            """
            SELECT topic_id, COUNT(*) AS sessions,
                   SUM(correct_count) AS correct, SUM(wrong_count) AS wrong
            FROM tutor_sessions
            WHERE user_id = ?
            GROUP BY topic_id
            ORDER BY sessions DESC
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

    session_answers = sum(r["correct"] + r["wrong"] for r in session_rows)

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
        "tutor_sessions": {
            "total_sessions": sum(r["sessions"] for r in session_rows),
            "total_answers": session_answers,
            "accuracy": round(sum(r["correct"] for r in session_rows) / session_answers, 3) if session_answers else 0,
            "per_topic": [
                {
                    "topic_id": r["topic_id"],
                    "topic_name": TOPICS.get(r["topic_id"], {}).get("name", r["topic_id"]),
                    "sessions": r["sessions"],
                    "correct": r["correct"],
                    "wrong": r["wrong"],
                    "accuracy": round(r["correct"] / (r["correct"] + r["wrong"]), 3) if (r["correct"] + r["wrong"]) else 0,
                }
                for r in session_rows
            ],
        },
    }