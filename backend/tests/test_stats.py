from app import db


def _user_id():
    conn = db.get_db()
    try:
        row = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
        return row["id"]
    finally:
        conn.close()


def _create_document(client, auth_headers, title, doc_type=None):
    body = {"title": title, "content": "# Test body"}
    if doc_type is not None:
        body["doc_type"] = doc_type
    resp = client.post("/api/documents", json=body, headers=auth_headers)
    assert resp.status_code == 200


def _create_note(client, auth_headers, title):
    resp = client.post("/api/notes", json={"title": title, "content": "note body"}, headers=auth_headers)
    assert resp.status_code == 200


def _mark_review(client, auth_headers, question, topic_id, got_it):
    resp = client.post(
        "/api/tutor/review/mark",
        json={"question": question, "topic_id": topic_id, "got_it": got_it},
        headers=auth_headers,
    )
    assert resp.status_code == 200


def _insert_session(user_id, topic_id, mode, correct, wrong, total):
    conn = db.get_db()
    try:
        conn.execute(
            "INSERT INTO tutor_sessions (user_id, topic_id, mode, correct_count, wrong_count, total_questions) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, topic_id, mode, correct, wrong, total),
        )
        conn.commit()
    finally:
        conn.close()


def test_stats_requires_auth(client):
    resp = client.get("/api/stats/me")
    assert resp.status_code == 401


def test_stats_empty_state(client, auth_headers):
    resp = client.get("/api/stats/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_age_days"] == 0
    assert data["documents_total"] == 0
    assert data["documents_by_type"] == []
    assert data["notes_total"] == 0
    assert data["tutor_review"] == {
        "total_reviewed": 0,
        "mastered": 0,
        "weak": 0,
        "weak_topics": [],
    }
    assert data["tutor_sessions"] == {
        "total_sessions": 0,
        "total_answers": 0,
        "accuracy": 0,
        "per_topic": [],
    }


def test_stats_documents_breakdown(client, auth_headers):
    _create_document(client, auth_headers, "Doc A", "case_summary")
    _create_document(client, auth_headers, "Doc B", "case_summary")
    _create_document(client, auth_headers, "Doc C", "citation_map")
    _create_document(client, auth_headers, "Doc D")

    resp = client.get("/api/stats/me", headers=auth_headers)
    data = resp.json()
    assert data["documents_total"] == 4
    by_type = {entry["doc_type"]: entry["count"] for entry in data["documents_by_type"]}
    assert by_type == {"case_summary": 2, "citation_map": 1, "": 1}


def test_stats_notes_count(client, auth_headers):
    _create_note(client, auth_headers, "Note A")
    _create_note(client, auth_headers, "Note B")

    resp = client.get("/api/stats/me", headers=auth_headers)
    assert resp.json()["notes_total"] == 2


def test_stats_tutor_review(client, auth_headers):
    _mark_review(client, auth_headers, "Q1", "contracts", False)
    _mark_review(client, auth_headers, "Q2", "contracts", False)
    _mark_review(client, auth_headers, "Q3", "torts", False)
    _mark_review(client, auth_headers, "Q4", "contracts", True)

    resp = client.get("/api/stats/me", headers=auth_headers)
    review = resp.json()["tutor_review"]
    assert review["total_reviewed"] == 4
    assert review["mastered"] == 1
    assert review["weak"] == 3
    assert review["weak_topics"] == [
        {"topic_id": "contracts", "topic_name": "Contracts", "weak_count": 2},
        {"topic_id": "torts", "topic_name": "Torts", "weak_count": 1},
    ]


def test_stats_tutor_sessions(client, auth_headers):
    user_id = _user_id()
    _insert_session(user_id, "contracts", "curriculum", 8, 2, 10)
    _insert_session(user_id, "contracts", "dynamic", 6, 4, 10)
    _insert_session(user_id, "torts", "mc", 1, 1, 2)

    resp = client.get("/api/stats/me", headers=auth_headers)
    sessions = resp.json()["tutor_sessions"]
    assert sessions["total_sessions"] == 3
    assert sessions["total_answers"] == 22
    assert sessions["accuracy"] == round(15 / 22, 3)
    assert sessions["per_topic"] == [
        {
            "topic_id": "contracts",
            "topic_name": "Contracts",
            "sessions": 2,
            "correct": 14,
            "wrong": 6,
            "accuracy": 0.7,
        },
        {
            "topic_id": "torts",
            "topic_name": "Torts",
            "sessions": 1,
            "correct": 1,
            "wrong": 1,
            "accuracy": 0.5,
        },
    ]


def test_stats_account_age_days(client, auth_headers):
    user_id = _user_id()
    conn = db.get_db()
    try:
        conn.execute(
            "UPDATE users SET created_at = datetime('now', '-5 days') WHERE id = ?",
            (user_id,),
        )
        conn.commit()
    finally:
        conn.close()

    resp = client.get("/api/stats/me", headers=auth_headers)
    assert resp.json()["account_age_days"] == 5


def test_stats_ignores_other_users(client, auth_headers):
    _create_document(client, auth_headers, "Mine", "case_summary")
    _mark_review(client, auth_headers, "Q1", "contracts", False)
    _insert_session(_user_id(), "contracts", "curriculum", 5, 5, 10)

    other = client.post("/api/auth/signup", json={
        "email": "other@example.com",
        "password": "password123",
    })
    assert other.status_code == 200
    other_in = client.post("/api/auth/signin", json={
        "email": "other@example.com",
        "password": "password123",
    })
    token = other_in.cookies.get("access_token")
    other_headers = {"Cookie": f"access_token={token}"}
    _create_document(client, other_headers, "Theirs", "citation_map")
    other_id = client.get("/api/auth/me", headers=other_headers).json()["id"]
    _insert_session(other_id, "torts", "mc", 4, 1, 5)

    resp = client.get("/api/stats/me", headers=auth_headers)
    data = resp.json()
    assert data["documents_total"] == 1
    assert data["documents_by_type"] == [{"doc_type": "case_summary", "count": 1}]
    assert data["tutor_review"]["weak"] == 1
    assert data["tutor_sessions"]["total_sessions"] == 1
    assert data["tutor_sessions"]["per_topic"][0]["topic_id"] == "contracts"