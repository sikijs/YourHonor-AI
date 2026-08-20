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


def test_today_answer_requires_auth(client):
    resp = client.get("/api/dashboard/today/answer")
    assert resp.status_code == 401


def test_today_issue_answer_requires_auth(client):
    resp = client.get("/api/dashboard/today/issue-answer")
    assert resp.status_code == 401


def test_today_answer_matches_today_question(client, auth_headers):
    today = client.get("/api/dashboard/today", headers=auth_headers).json()
    card = today["question_of_the_day"]

    resp = client.get("/api/dashboard/today/answer", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["question"] == card["question"]
    assert data["topic_id"] == card["topic_id"]
    assert data["topic_name"] == card["topic_name"]
    assert data["difficulty"] == card["difficulty"]
    assert data["hint"]
    assert data["answer"]


def test_today_answer_is_deterministic_same_day(client, auth_headers):
    first = client.get("/api/dashboard/today/answer", headers=auth_headers).json()
    second = client.get("/api/dashboard/today/answer", headers=auth_headers).json()
    assert first == second


def test_today_issue_answer_matches_today_case(client, auth_headers):
    today = client.get("/api/dashboard/today", headers=auth_headers).json()
    case = today["case_of_the_day"]

    resp = client.get("/api/dashboard/today/issue-answer", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_name"] == case["case_name"]
    assert data["subject"]
    assert data["doctrine_name"]
    assert data["doctrine_description"]
    assert data["issue"]
    assert data["plain_holding"]
    assert data["holding"]


def test_today_issue_answer_is_deterministic_same_day(client, auth_headers):
    first = client.get("/api/dashboard/today/issue-answer", headers=auth_headers).json()
    second = client.get("/api/dashboard/today/issue-answer", headers=auth_headers).json()
    assert first == second


def test_today_shape(client, auth_headers):
    resp = client.get("/api/dashboard/today", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_of_the_day"]["case_name"]
    assert data["case_of_the_day"]["citation"]
    assert data["case_of_the_day"]["case_summary"]
    drill = data["citation_drill"]
    assert drill["raw"]
    assert drill["formatted"]
    assert drill["case_name"] == data["case_of_the_day"]["case_name"]
    options = drill["options"]
    assert 3 <= len(options) <= 4
    assert len({o["text"] for o in options}) == len(options)
    correct = [o for o in options if o["is_correct"]]
    assert len(correct) == 1
    assert correct[0]["text"] == drill["formatted"]
    for option in options:
        assert option["text"]
        assert option["rule_note"]
    assert data["term_of_the_day"]["term"]
    assert data["term_of_the_day"]["definition"]
    assert data["question_of_the_day"]["question"]
    assert data["question_of_the_day"]["topic_id"]
    assert data["question_of_the_day"]["topic_name"]
    assert data["issue_prompt_of_the_day"]["prompt"]
    assert data["suggested_focus"] is None


def test_drill_distractors_never_equal_correct():
    options = dashboard_service._build_distractors("Marbury v. Madison", "5 U.S. 137", 1803)
    assert len(options) == 5
    for option in options:
        assert not option.is_correct
        assert option.text != "Marbury v. Madison, 5 U.S. 137 (1803)"
        assert option.rule_note


def test_drill_distractors_without_v_separator():
    options = dashboard_service._build_distractors("Slaughter-House Cases", "83 U.S. 36", 1873)
    assert len(options) == 2
    for option in options:
        assert " v. " not in option.text


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
    expected = sum(len(t["questions"]) for t in dashboard_service.TOPICS.values())
    assert len(cards) == expected
    for card in cards:
        assert card["question"]
        assert card["topic_id"]
        assert card["topic_name"]