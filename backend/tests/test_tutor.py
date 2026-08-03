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


def test_tutor_contracts_has_twenty_questions(client):
    resp = client.get("/api/tutor/topics")
    contracts = next(t for t in resp.json()["topics"] if t["id"] == "contracts")
    assert contracts["question_count"] == 20


def test_all_questions_have_short_and_deep_hints():
    from app.services.tutor_data import TOPICS
    from app.services.tutor import MAX_ATTEMPTS_PER_QUESTION

    assert MAX_ATTEMPTS_PER_QUESTION >= 2
    total = 0
    for topic_id, topic in TOPICS.items():
        for q in topic["questions"]:
            total += 1
            assert q.hint, f"{topic_id}: question missing short hint"
            # Deep hint: 2+ sentences of guidance, substantial length
            assert q.deep_hint, f"{topic_id}: question missing deep_hint"
            assert len(q.deep_hint) >= 90, f"{topic_id}: deep_hint too short: {q.deep_hint[:60]}"
            sentences = sum(1 for ch in q.deep_hint if ch in ".!?")
            assert sentences >= 2, f"{topic_id}: deep_hint not multi-sentence: {q.deep_hint[:80]}"
            # Deep hint must not leak expected concepts verbatim — unless the
            # question itself already names the concept (then it's not a leak)
            lowered = q.deep_hint.lower()
            qtext = q.question.lower()
            for concept in q.expected_concepts:
                if concept.lower() not in qtext:
                    assert concept.lower() not in lowered, (
                        f"{topic_id}: deep_hint reveals concept '{concept}': {q.deep_hint[:100]}"
                    )
    assert total == 160


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
        "missed_concepts": [],
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


def _eval_mock(evaluation="incorrect", follow_up_question=None, follow_up_hint=None,
               is_complete=False, explanation="Evaluation feedback.",
               missed_concepts=None, follow_up_answer=None):
    from unittest.mock import MagicMock
    import json
    eval_dict = {
        "evaluation": evaluation,
        "explanation": explanation,
        "follow_up_question": follow_up_question,
        "follow_up_hint": follow_up_hint,
        "follow_up_answer": follow_up_answer,
        "is_complete": is_complete,
        "missed_concepts": missed_concepts if missed_concepts is not None else [],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(eval_dict)))]
    return mock_llm


def _reveal_mock(text="The correct answer is consideration."):
    from unittest.mock import MagicMock
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=text))]
    return mock_llm


def _start_contracts(client, auth_headers):
    start = client.post("/api/tutor/start", headers=auth_headers, json={"topic_id": "contracts"})
    assert start.status_code == 200
    return start.json()


def test_tutor_three_wrong_answers_reveals_correct_answer(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    wrong_eval = _eval_mock(evaluation="incorrect", is_complete=False)
    reveal = _reveal_mock()

    # 3 evaluation calls + 1 reveal call on the final request
    with patch("app.services.tutor.completion", side_effect=[wrong_eval, wrong_eval, wrong_eval, reveal]):
        for attempt in (1, 2):
            resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": f"wrong {attempt}"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["attempts_exceeded"] is False
            assert data["correct_answer_revealed"] is None
            assert data["current_index"] == 0
            assert data["attempts_used"] == attempt
            assert data["max_attempts"] == 3

        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong 3"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["attempts_exceeded"] is True
        assert data["correct_answer_revealed"] is not None
        assert "consideration" in data["correct_answer_revealed"].lower()
        assert data["current_index"] == 1
        assert data["attempts_used"] == 0  # reset for the next question


def test_tutor_wrong_answer_marked_complete_does_not_advance(client, auth_headers):
    from unittest.mock import patch

    start = _start_contracts(client, auth_headers)
    first_question = start["current_question"]["question"]
    # LLM misbehaves: marks is_complete even though the answer is wrong
    wrong_but_complete = _eval_mock(evaluation="incorrect", is_complete=True)

    with patch("app.services.tutor.completion", return_value=wrong_but_complete):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_index"] == 0
    assert data["attempts_used"] == 1
    assert data["attempts_exceeded"] is False
    assert data["correct_answer_revealed"] is None
    # stays on the same question (fallback) so attempts can reach the limit
    assert data["follow_up_question"]["question"] == first_question


def test_tutor_follow_up_answers_count_toward_attempt_limit(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    fu_eval = _eval_mock(
        evaluation="incorrect",
        follow_up_question="Simpler follow-up: what is a bargained-for exchange?",
        follow_up_hint="Think about the exchange.",
        is_complete=False,
    )
    reveal = _reveal_mock()

    with patch("app.services.tutor.completion", side_effect=[fu_eval, fu_eval, fu_eval, reveal]):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong 1"})
        data = resp.json()
        assert data["follow_up_question"]["question"] == "Simpler follow-up: what is a bargained-for exchange?"
        assert data["current_index"] == 0
        assert data["attempts_used"] == 1

        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong 2"})
        data = resp.json()
        assert data["current_index"] == 0
        assert data["attempts_used"] == 2
        assert data["attempts_exceeded"] is False

        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong 3"})
        data = resp.json()
        assert data["attempts_exceeded"] is True
        assert data["correct_answer_revealed"] is not None
        assert data["current_index"] == 1


def test_tutor_correct_answer_advances_immediately(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    correct_eval = _eval_mock(evaluation="correct", is_complete=True)

    with patch("app.services.tutor.completion", return_value=correct_eval):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "Correct answer"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_index"] == 1
    assert data["attempts_used"] == 0
    assert data["attempts_exceeded"] is False
    assert data["correct_answer_revealed"] is None


def test_tutor_missed_concepts_round_trip(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    partial_eval = _eval_mock(
        evaluation="partially_correct",
        is_complete=False,
        follow_up_question="Simpler follow-up: what is a bargained-for exchange?",
        follow_up_hint="Think about the exchange.",
        missed_concepts=["consideration", "meeting of the minds"],
    )

    with patch("app.services.tutor.completion", return_value=partial_eval):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "Offer and acceptance"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["evaluation"] == "partially_correct"
    assert data["missed_concepts"] == ["consideration", "meeting of the minds"]
    # stays on the same question with a follow-up
    assert data["current_index"] == 0


def test_tutor_llm_failure_fallback_reports_all_concepts_missed(client, auth_headers):
    from unittest.mock import patch

    start = _start_contracts(client, auth_headers)
    expected = start["current_question"]["expected_concepts"]
    assert len(expected) > 0

    with patch("app.services.tutor.completion", side_effect=Exception("LLM down")):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "my answer"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["evaluation"] == "incorrect"
    assert data["missed_concepts"] == expected
    assert data["attempts_used"] == 1


def test_all_questions_have_educative_answers():
    from app.services.tutor_data import TOPICS

    total = 0
    for topic_id, topic in TOPICS.items():
        for q in topic["questions"]:
            total += 1
            assert q.answer, f"{topic_id}: question missing answer: {q.question[:60]}"
            assert len(q.answer) >= 80, (
                f"{topic_id}: answer too short ({len(q.answer)} chars): {q.answer[:80]}"
            )
            # The answer must actually be about the question, not placeholder text
            assert q.answer.lower() != q.question.lower()
    assert total == 160


def test_follow_up_answer_propagates_to_follow_up_question(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    fu_eval = _eval_mock(
        evaluation="incorrect",
        follow_up_question="Simpler follow-up: what is a bargained-for exchange?",
        follow_up_hint="Think about the exchange.",
        follow_up_answer="A bargained-for exchange is the reciprocal promise or act that each party gives up in exchange for the other's promise or act.",
        is_complete=False,
    )

    with patch("app.services.tutor.completion", return_value=fu_eval):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong"})
    assert resp.status_code == 200
    data = resp.json()
    fu = data["follow_up_question"]
    assert fu is not None
    assert fu["answer"] == "A bargained-for exchange is the reciprocal promise or act that each party gives up in exchange for the other's promise or act."
    assert "bargained-for exchange" in fu["answer"]


def test_follow_up_without_answer_defaults_to_none(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    fu_eval = _eval_mock(
        evaluation="incorrect",
        follow_up_question="Simpler follow-up: what is a bargained-for exchange?",
        follow_up_hint="Think about the exchange.",
        is_complete=False,
    )

    with patch("app.services.tutor.completion", return_value=fu_eval):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["follow_up_question"]["answer"] is None
