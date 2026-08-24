"""Spaced-repetition (Leitner) scheduling tests.

Covers the pure scheduling math in services/spaced_repetition.py and the
wiring through /api/tutor/review/mark, /api/tutor/review/queue,
/api/tutor/review/due-count, and /api/stats/me.
"""

from datetime import datetime, timedelta, timezone

from app import db
from app.services.spaced_repetition import LEITNER_INTERVALS_DAYS, MAX_BOX, schedule_mark


# ----------------------------------------------------------------- unit: math

def _parse(ts):
    return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


def _days_until(ts):
    return (_parse(ts) - datetime.now(timezone.utc)).total_seconds() / 86400


def test_fail_resets_to_box_one_due_tomorrow():
    for current_box in (1, 3, MAX_BOX):
        got_it, box, due = schedule_mark(False, current_box)
        assert got_it == 0
        assert box == 1
        assert 0 < _days_until(due) <= 1.01


def test_pass_promotes_box_and_uses_its_interval():
    for current_box in range(1, MAX_BOX):
        got_it, box, due = schedule_mark(True, current_box)
        assert got_it == 0
        assert box == current_box + 1
        interval = LEITNER_INTERVALS_DAYS[box - 1]
        assert interval - 0.01 < _days_until(due) <= interval + 0.01


def test_pass_at_top_box_graduates():
    got_it, box, due = schedule_mark(True, MAX_BOX)
    assert got_it == 1
    assert box == MAX_BOX
    assert due is None


def test_out_of_range_boxes_are_clamped():
    # A missing/corrupt box level is treated as box 1; absurd values cap out.
    got_it, box, due = schedule_mark(True, 0)
    assert (got_it, box) == (0, 2)
    got_it, box, due = schedule_mark(True, 99)
    assert (got_it, box, due) == (1, MAX_BOX, None)


# ------------------------------------------------- integration: API + SQLite

def test_due_count_endpoint_requires_auth(client):
    resp = client.get("/api/tutor/review/due-count")
    assert resp.status_code == 401


def test_fresh_fail_mark_is_scheduled_not_due(client, auth_headers):
    resp = client.post("/api/tutor/review/mark", headers=auth_headers, json={
        "question": "Q?", "topic_id": "contracts", "got_it": False,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["got_it"] is False
    assert body["graduated"] is False
    assert body["box_level"] == 1

    due = client.get("/api/tutor/review/due-count", headers=auth_headers).json()["due_count"]
    assert due == 0

    conn = db.get_db()
    try:
        row = conn.execute("SELECT box_level, next_due FROM review_progress").fetchone()
    finally:
        conn.close()
    assert row["box_level"] == 1
    assert 0 < _days_until(row["next_due"]) <= 1.01


def test_backdated_card_is_due_and_sorted_first(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    early = TOPICS["contracts"]["questions"][0]
    late = TOPICS["contracts"]["questions"][1]

    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        for q in (late, early):
            client.post("/api/tutor/review/mark", headers=auth_headers, json={
                "question": q.question, "topic_id": "contracts", "got_it": False,
            })
        # Backdate `early` so it is overdue; `late` stays due tomorrow. The
        # queue must lead with the overdue card despite the newer timestamp.
        conn = db.get_db()
        try:
            conn.execute(
                "UPDATE review_progress SET next_due = ? WHERE question = ?",
                ("2020-01-01 00:00:00", early.question),
            )
            conn.commit()
        finally:
            conn.close()

        due = client.get("/api/tutor/review/due-count", headers=auth_headers).json()["due_count"]
        assert due == 1

        queue = client.get("/api/tutor/review/queue", headers=auth_headers).json()
    assert [c["question"] for c in queue["cards"]] == [early.question, late.question]


def test_graduation_after_five_passes_removes_card_from_rotation(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    q = TOPICS["contracts"]["questions"][0]
    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        boxes = []
        graduated = False
        for i in range(5):
            body = client.post("/api/tutor/review/mark", headers=auth_headers, json={
                "question": q.question, "topic_id": "contracts", "got_it": True,
            }).json()
            boxes.append(body["box_level"])
            graduated = body["graduated"]

    assert boxes == [2, 3, 4, 5, 5]
    assert graduated is True

    conn = db.get_db()
    try:
        row = conn.execute("SELECT got_it, next_due FROM review_progress").fetchone()
    finally:
        conn.close()
    assert row["got_it"] == 1
    assert row["next_due"] is None

    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        assert client.get("/api/tutor/review/queue", headers=auth_headers).json()["total"] == 0

    stats = client.get("/api/stats/me", headers=auth_headers).json()["tutor_review"]
    assert stats["mastered"] == 1
    assert stats["weak"] == 0


def test_legacy_null_next_due_is_backfilled_on_init(client):
    """Pre-migration rows (next_due NULL) become due immediately on boot."""
    conn = db.get_db()
    try:
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES ('legacy@x.com', 'h')"
        )
        conn.execute(
            "INSERT INTO review_progress (user_id, topic_id, question, got_it, next_due) "
            "VALUES (1, 'contracts', 'Old card', 0, NULL)"
        )
        conn.commit()
    finally:
        conn.close()

    db.init_db()  # idempotent re-run, as happens on every container start

    conn = db.get_db()
    try:
        row = conn.execute("SELECT next_due FROM review_progress").fetchone()
    finally:
        conn.close()
    assert row["next_due"] is not None


def test_stats_reports_due_now(client, auth_headers):
    from app.services.spaced_repetition import schedule_mark

    client.post("/api/tutor/review/mark", headers=auth_headers, json={
        "question": "Due card", "topic_id": "torts", "got_it": False,
    })
    client.post("/api/tutor/review/mark", headers=auth_headers, json={
        "question": "Future card", "topic_id": "torts", "got_it": True,
    })
    _, _, future_due = schedule_mark(True, 1)

    conn = db.get_db()
    try:
        conn.execute("UPDATE review_progress SET next_due = '2020-01-01 00:00:00' WHERE question = 'Due card'")
        conn.execute("UPDATE review_progress SET next_due = ? WHERE question = 'Future card'", (future_due,))
        conn.commit()
    finally:
        conn.close()

    stats = client.get("/api/stats/me", headers=auth_headers).json()["tutor_review"]
    assert stats["due_now"] == 1
    assert stats["weak"] == 2
