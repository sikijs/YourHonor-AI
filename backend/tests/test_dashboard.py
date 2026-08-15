from app import db
from app.services import dashboard as dashboard_service


def _mark_review(client, auth_headers, question, topic_id, got_it):
    resp = client.post(
        "/api/tutor/review/mark",
        json={"question": question, "topic_id": topic_id, "got_it": got_it},
        headers=auth_headers,
    )
    assert resp.status_code == 200


def test_today_requires_auth(client):
    resp = client.get("/api/dashboard/today")
    assert resp.status_code == 401


def test_today_shape(client, auth_headers):
    resp = client.get("/api/dashboard/today", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_of_the_day"]["case_name"]
    assert data["case_of_the_day"]["citation"]
    assert data["citation_drill"]["raw"]
    assert data["citation_drill"]["formatted"]
    assert data["citation_drill"]["case_name"] == data["case_of_the_day"]["case_name"]
    assert data["term_of_the_day"]["term"]
    assert data["term_of_the_day"]["definition"]
    assert data["question_of_the_day"]["question"]
    assert data["question_of_the_day"]["topic_id"]
    assert data["question_of_the_day"]["topic_name"]
    assert data["issue_prompt_of_the_day"]["prompt"]
    assert data["suggested_focus"] is None


def test_today_is_deterministic_same_day(client, auth_headers):
    first = client.get("/api/dashboard/today", headers=auth_headers).json()
    second = client.get("/api/dashboard/today", headers=auth_headers).json()
    assert first == second


def test_today_question_never_leaks_card_answer(client, auth_headers):
    data = client.get("/api/dashboard/today", headers=auth_headers).json()
    card = data["question_of_the_day"]
    topic = dashboard_service.TOPICS[card["topic_id"]]
    for q in topic["questions"]:
        assert q.question != card["question"] or q.answer != card["question"]
    assert "answer" not in card


def test_today_suggested_focus_from_weakest_topic(client, auth_headers):
    _mark_review(client, auth_headers, "Q1", "contracts", False)
    _mark_review(client, auth_headers, "Q2", "contracts", False)
    _mark_review(client, auth_headers, "Q3", "torts", False)

    data = client.get("/api/dashboard/today", headers=auth_headers).json()
    focus = data["suggested_focus"]
    assert focus is not None
    assert focus["topic_id"] == "contracts"
    assert focus["topic_name"] == "Contracts"
    assert focus["weak_count"] == 2


def test_day_index_rotation():
    assert dashboard_service._day_index(70) == dashboard_service._day_index(70)
    assert 0 <= dashboard_service._day_index(70) < 70
    assert 0 <= dashboard_service._day_index(123) < 123
    assert 0 <= dashboard_service._day_index(160) < 160


def test_flat_questions_covers_all_cards():
    cards = dashboard_service._flat_questions()
    assert len(cards) == 160
    for card in cards:
        assert card["question"]
        assert card["topic_id"]
        assert card["topic_name"]