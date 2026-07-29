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


def test_tutor_start_session_valid_topic(client, auth_headers):
    resp = client.post("/api/tutor/start", headers=auth_headers, json={
        "topic_id": "contracts",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["topic_id"] == "contracts"
    assert data["topic_name"] == "Contracts"
    assert data["total_questions"] > 0
    assert "current_question" in data
    q = data["current_question"]
    assert "question" in q
    assert "hint" in q
    assert "expected_concepts" in q
    assert "difficulty" in q
    assert data["current_index"] == 0


def test_tutor_submit_answer_valid(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    start = client.post("/api/tutor/start", headers=auth_headers, json={
        "topic_id": "contracts",
    })
    assert start.status_code == 200

    valid_eval = {
        "evaluation": "correct",
        "explanation": "Good answer! You correctly identified consideration.",
        "follow_up_question": None,
        "follow_up_hint": None,
        "is_complete": True,
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid_eval)))]
    with patch("app.services.tutor.completion", return_value=mock_llm):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={
            "answer": "Consideration is a bargained-for exchange.",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["evaluation"] == "correct"
    assert "explanation" in data
    assert data["current_index"] == 1
    assert "correct_count" in data


def test_tutor_unknown_topic_returns_400(client, auth_headers):
    resp = client.post("/api/tutor/start", headers=auth_headers, json={
        "topic_id": "invalid_topic",
    })
    assert resp.status_code == 400
