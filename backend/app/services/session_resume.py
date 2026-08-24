"""Resumable tutor sessions.

One slot per user: the frontend snapshots an in-progress quiz or review
session as a JSON blob and the backend stores it opaquely. Reloading the
page (or restarting the browser, or switching topics) no longer loses the
session — the banner in TutorView offers to restore it.

Only modes whose full state can be reconstructed client-side are snapshotted
(curated/dynamic quizzes deliver their whole question array upfront; the
review queue is rebuilt from review_progress). AI-MC / practice / drill
sessions depend on server-side state or one-shot generations and are not
resumable.
"""

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

RESUMABLE_MODES = ("quiz", "review")


def save_active_session(user_id: int, topic_id: str, mode: str, payload: dict) -> None:
    """Upsert the user's single resumable-session snapshot."""
    if mode not in RESUMABLE_MODES:
        raise ValueError(f"Mode '{mode}' is not resumable")
    from app import db

    conn = db.get_db()
    try:
        conn.execute(
            """
            INSERT INTO active_sessions (user_id, topic_id, mode, payload, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id)
            DO UPDATE SET topic_id = excluded.topic_id, mode = excluded.mode,
                          payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, topic_id, mode, json.dumps(payload)),
        )
        conn.commit()
    finally:
        conn.close()


def get_active_session(user_id: int) -> Optional[dict]:
    """The saved snapshot with its metadata, or None."""
    from app import db

    conn = db.get_db()
    try:
        row = conn.execute(
            "SELECT topic_id, mode, payload, updated_at FROM active_sessions WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    try:
        payload = json.loads(row["payload"])
    except (TypeError, ValueError):
        logger.warning(f"Discarding corrupt resume payload for user {user_id}")
        return None
    return {
        "topic_id": row["topic_id"],
        "mode": row["mode"],
        "payload": payload,
        "updated_at": row["updated_at"],
    }


def clear_active_session(user_id: int) -> None:
    from app import db

    conn = db.get_db()
    try:
        conn.execute("DELETE FROM active_sessions WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()
