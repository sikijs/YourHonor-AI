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

# Saved-document doc_types per practical skill, so the dashboard can show
# "what am I good at" instead of raw document counts. Documents uploaded as
# PDFs (file_type set) count toward Legal Research.
SKILLS = [
    {
        "skill_id": "research",
        "name": "Legal Research",
        "description": "Case summaries, statute analyses, and uploaded materials",
        "doc_types": {"case_summary", "general_summary", "statute_summary", "doctrine_summary", "legal_summary"},
        "counts_uploads": True,
    },
    {
        "skill_id": "drafting",
        "name": "Legal Drafting",
        "description": "Case briefs, memoranda, arguments, and generated documents",
        "doc_types": {"case_brief", "memorandum", "argument_analysis", "generated_document"},
        "counts_uploads": False,
    },
    {
        "skill_id": "citation",
        "name": "Citation Skills",
        "description": "Citation maps and Bluebook formatting",
        "doc_types": {"citation_map", "bluebook_citations"},
        "counts_uploads": False,
    },
    {
        "skill_id": "analysis",
        "name": "Case Analysis",
        "description": "Case comparisons and debate analyses",
        "doc_types": {"case_comparison", "debate"},
        "counts_uploads": False,
    },
    {
        "skill_id": "issue_spotting",
        "name": "Issue Spotting",
        "description": "Issue-spotter analyses and tutor practice saves",
        "doc_types": {"issue_spotter", "other"},
        "counts_uploads": False,
    },
]


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

        doc_rows = conn.execute(
            "SELECT doc_type, file_type FROM documents WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        portfolio = conn.execute(
            """
            SELECT id, title, doc_type, updated_at
            FROM documents
            WHERE user_id = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 6
            """,
            (user_id,),
        ).fetchall()
    finally:
        conn.close()

    mastered = next((r["count"] for r in review_rows if r["got_it"] == 1), 0)
    weak = next((r["count"] for r in review_rows if r["got_it"] == 0), 0)

    session_answers = sum(r["correct"] + r["wrong"] for r in session_rows)

    # Skill counts come from per-document rows so uploads can be separated
    # cleanly: a document with a file_type is source material (research), and
    # its doc_type label is not double-counted into another skill.
    doc_type_counts: dict[str, int] = {}
    uploaded_count = 0
    for r in doc_rows:
        if r["file_type"]:
            uploaded_count += 1
        else:
            key = r["doc_type"] or ""
            doc_type_counts[key] = doc_type_counts.get(key, 0) + 1

    skill_counts: dict[str, int] = {}
    for skill in SKILLS:
        count = sum(doc_type_counts.get(dt, 0) for dt in skill["doc_types"])
        if skill["counts_uploads"]:
            count += uploaded_count
        skill_counts[skill["skill_id"]] = count
    # Doctrine Knowledge is measured by tutor activity (answers + review marks).
    skill_counts["doctrine"] = session_answers + mastered + weak

    skills = [
        {
            "skill_id": skill["skill_id"],
            "name": skill["name"],
            "description": skill["description"],
            "count": skill_counts[skill["skill_id"]],
        }
        for skill in SKILLS
    ]
    skills.append(
        {
            "skill_id": "doctrine",
            "name": "Doctrine Knowledge",
            "description": "Tutor answers and review-mastery marks",
            "count": skill_counts["doctrine"],
        }
    )

    return {
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
        "skills": skills,
        "portfolio": [
            {
                "id": r["id"],
                "title": r["title"],
                "doc_type": r["doc_type"],
                "updated_at": r["updated_at"],
            }
            for r in portfolio
        ],
    }