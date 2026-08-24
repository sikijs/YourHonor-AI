"""Session-resume tests.

One opaque snapshot slot per user. Covers auth, the save/get/clear
round-trip, single-slot overwrite semantics, and rejection of modes that
cannot be faithfully resumed.
"""

from app.services.session_resume import (
    clear_active_session,
    get_active_session,
    save_active_session,
)


def test_resume_requires_auth(client):
    assert client.get("/api/tutor/resume").status_code == 401
    assert client.post("/api/tutor/resume", json={
        "topic_id": "contracts", "mode": "quiz", "payload": {},
    }).status_code == 401
    assert client.delete("/api/tutor/resume").status_code == 401


def test_resume_round_trip(client, auth_headers):
    payload = {
        "topic_name": "Contracts",
        "questions": [{"question": "Q?", "hint": "", "expected_concepts": ["c"], "difficulty": 1}],
        "current_index": 0,
        "history": [],
        "correct_count": 0,
        "wrong_count": 0,
    }
    resp = client.post("/api/tutor/resume", json={
        "topic_id": "contracts", "mode": "quiz", "payload": payload,
    }, cookies=auth_headers)
    assert resp.status_code == 200

    body = client.get("/api/tutor/resume", cookies=auth_headers).json()
    session = body["session"]
    assert session is not None
    assert session["topic_id"] == "contracts"
    assert session["mode"] == "quiz"
    assert session["payload"] == payload
    assert session["updated_at"]


def test_get_resume_returns_null_when_empty(client, auth_headers):
    assert client.get("/api/tutor/resume", cookies=auth_headers).json()["session"] is None


def test_second_save_overwrites_single_slot(client, auth_headers):
    client.post("/api/tutor/resume", json={
        "topic_id": "contracts", "mode": "quiz", "payload": {"n": 1},
    }, cookies=auth_headers)
    client.post("/api/tutor/resume", json={
        "topic_id": "torts", "mode": "review", "payload": {"n": 2},
    }, cookies=auth_headers)

    session = client.get("/api/tutor/resume", cookies=auth_headers).json()["session"]
    assert session["topic_id"] == "torts"
    assert session["mode"] == "review"


def test_clear_resume_discards_snapshot(client, auth_headers):
    client.post("/api/tutor/resume", json={
        "topic_id": "contracts", "mode": "quiz", "payload": {"n": 1},
    }, cookies=auth_headers)
    assert client.delete("/api/tutor/resume", cookies=auth_headers).status_code == 200
    assert client.get("/api/tutor/resume", cookies=auth_headers).json()["session"] is None


def test_unresumable_mode_rejected(client, auth_headers):
    resp = client.post("/api/tutor/resume", json={
        "topic_id": "contracts", "mode": "mc", "payload": {},
    }, cookies=auth_headers)
    assert resp.status_code == 400


def test_corrupt_payload_served_as_none(auth_headers, test_db):
    """A malformed blob is dropped rather than crashing the reader."""
    from app import db

    save_active_session(1, "contracts", "quiz", {"ok": True})
    conn = db.get_db()
    try:
        conn.execute("UPDATE active_sessions SET payload = '{not json' WHERE user_id = 1")
        conn.commit()
    finally:
        conn.close()
    assert get_active_session(1) is None
    # The slot still exists, so a fresh save cleanly overwrites it.
    save_active_session(1, "torts", "review", {"ok": True})
    assert get_active_session(1)["payload"] == {"ok": True}


def test_service_clear_is_idempotent(test_db):
    clear_active_session(42)
    clear_active_session(42)
    assert get_active_session(42) is None
