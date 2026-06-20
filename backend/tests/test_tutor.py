def test_tutor_topics_returns_list(client):
    resp = client.get("/api/tutor/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert "topics" in data
    assert len(data["topics"]) > 0
    for topic in data["topics"]:
        assert "id" in topic
        assert "name" in topic
        assert "question_count" in topic


def test_tutor_topics_have_expected_structure(client):
    resp = client.get("/api/tutor/topics")
    topics = resp.json()["topics"]
    topic_names = [t["name"] for t in topics]
    assert "Contracts" in topic_names
    assert "Torts" in topic_names


def test_tutor_start_without_auth_returns_401(client):
    resp = client.post("/api/tutor/start", json={"topic_id": "contracts"})
    assert resp.status_code == 401


def test_tutor_start_dynamic_without_auth_returns_401(client):
    resp = client.post("/api/tutor/start-dynamic", json={"topic_id": "contracts"})
    assert resp.status_code == 401


def test_tutor_answer_without_auth_returns_401(client):
    resp = client.post("/api/tutor/answer", json={
        "session_id": "test",
        "question_id": 1,
        "answer": "test answer",
    })
    assert resp.status_code == 401


def test_tutor_continue_learning_without_auth_returns_401(client):
    resp = client.post("/api/tutor/continue-learning", json={"session_id": "test"})
    assert resp.status_code == 401
