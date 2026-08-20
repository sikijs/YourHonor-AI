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
    assert total == sum(len(t["questions"]) for t in TOPICS.values())


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

    with patch("app.services.tutor.completion", side_effect=[fu_eval, fu_eval, fu_eval, reveal]), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[]):
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
    assert total == sum(len(t["questions"]) for t in TOPICS.values())


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


# ------------------------------------------------- grounded answer evaluation

def test_eval_prompt_grounded_in_curated_answer_for_bank_question(client, auth_headers):
    from unittest.mock import MagicMock, patch

    start = _start_contracts(client, auth_headers)
    q = start["current_question"]
    mock_llm = _eval_mock(evaluation="correct", is_complete=True)

    captured = {}
    def recording_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return mock_llm

    # Bank questions resolve from the session — retrieval must not be touched
    with patch("app.services.tutor.completion", side_effect=recording_completion), \
         patch("app.services.tutor.retrieve_curriculum",
               side_effect=AssertionError("bank question must not retrieve")):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "Correct"})

    assert resp.status_code == 200
    prompt = captured["prompt"]
    assert "Reference material" in prompt
    assert q["question"] in prompt
    assert q["answer"] in prompt
    for concept in q["expected_concepts"]:
        assert concept in prompt


def test_eval_prompt_grounded_via_retrieval_for_follow_up_question(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    fu_eval = _eval_mock(
        evaluation="incorrect",
        follow_up_question="Simpler follow-up: what is a bargained-for exchange?",
        follow_up_hint="Think about the exchange.",
        is_complete=False,
    )
    correct_eval = _eval_mock(evaluation="correct", is_complete=True)

    captured = {}
    def dispatch_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return fu_eval

    parent = _curriculum_result(answer="A vetted parent-card answer for grading.")
    with patch("app.services.tutor.completion", side_effect=dispatch_completion), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[parent]):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong"})
        assert resp.status_code == 200
        assert resp.json()["follow_up_question"] is not None

        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "better now"})

    assert resp.status_code == 200
    prompt = captured["prompt"]
    assert "Reference material" in prompt
    assert "A vetted parent-card answer for grading." in prompt


def test_eval_prompt_degrades_when_retrieval_unavailable(client, auth_headers):
    from unittest.mock import patch

    _start_contracts(client, auth_headers)
    fu_eval = _eval_mock(
        evaluation="incorrect",
        follow_up_question="Simpler follow-up: what is a bargained-for exchange?",
        follow_up_hint="Think about the exchange.",
        is_complete=False,
    )
    correct_eval = _eval_mock(evaluation="correct", is_complete=True)

    captured = {}
    def dispatch_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return fu_eval

    with patch("app.services.tutor.completion", side_effect=dispatch_completion), \
         patch("app.services.tutor.retrieve_curriculum", side_effect=RuntimeError("qdrant down")):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "wrong"})
        assert resp.status_code == 200
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "better now"})

    assert resp.status_code == 200
    assert "Reference material" not in captured["prompt"]


def test_eval_prompt_grounded_for_dynamic_session_questions(client, auth_headers):
    from unittest.mock import MagicMock, patch

    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=_question_mock_json()))]
    with patch("app.services.tutor.completion", return_value=mock_llm), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[_curriculum_result()]):
        resp = client.post("/api/tutor/start-dynamic", headers=auth_headers, json={"topic_id": "contracts"})
    assert resp.status_code == 200

    captured = {}
    def dispatch_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return _eval_mock(evaluation="correct", is_complete=True)

    parent = _curriculum_result(answer="A vetted answer for dynamic grounding.")
    with patch("app.services.tutor.completion", side_effect=dispatch_completion), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[parent]):
        resp = client.post("/api/tutor/answer", headers=auth_headers, json={"answer": "my analysis"})

    assert resp.status_code == 200
    prompt = captured["prompt"]
    assert "Reference material" in prompt
    assert "A short educative answer." in prompt


# ------------------------------------------------- curriculum-grounded generation

def _curriculum_result(question="What is consideration?", topic="contracts", topic_name=None, answer="answer"):
    return {
        "content": f"Question: {question}\nHint: hint\nConcepts: consideration\nAnswer: {answer}",
        "payload": {
            "kind": "curriculum",
            "topic": topic,
            "topic_name": topic_name or ("Contracts" if topic == "contracts" else topic.capitalize()),
            "question": question,
            "answer": answer,
            "expected_concepts": ["consideration"],
            "difficulty": 2,
        },
    }


def _question_mock_json():
    import json
    return json.dumps({
        "question": "A brand new dynamic question?",
        "hint": "A short hint.",
        "deep_hint": "An elaborate hint that guides the student step by step: first consider the elements, then draw the distinction, then structure the answer. This is long enough.",
        "expected_concepts": ["offer", "acceptance"],
        "difficulty": 2,
        "answer": "A short educative answer.",
    })


def test_dynamic_generation_includes_curriculum_exemplars(client, auth_headers):
    from unittest.mock import MagicMock, patch

    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=_question_mock_json()))]

    captured = {}
    def recording_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return mock_llm

    with patch("app.services.tutor.completion", side_effect=recording_completion), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[_curriculum_result()]):
        resp = client.post("/api/tutor/start-dynamic", headers=auth_headers, json={"topic_id": "contracts"})

    assert resp.status_code == 200
    prompt = captured["prompt"]
    assert "Example card 1" in prompt
    assert "What is consideration?" in prompt
    assert "does not duplicate them" in prompt


def test_dynamic_generation_degrades_without_curriculum(client, auth_headers):
    from unittest.mock import MagicMock, patch

    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=_question_mock_json()))]

    captured = {}
    def recording_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return mock_llm

    with patch("app.services.tutor.completion", side_effect=recording_completion), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        resp = client.post("/api/tutor/start-dynamic", headers=auth_headers, json={"topic_id": "contracts"})

    assert resp.status_code == 200
    assert "Example card" not in captured["prompt"]
    assert "already-covered concepts" in captured["prompt"]


def test_mc_generation_includes_curriculum_exemplars(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    mc_json = json.dumps({
        "question": "Which of the following is consideration?",
        "options": ["A gift", "A bargained-for exchange", "A promise with no return", "A moral obligation"],
        "correct_index": 1,
        "explanation": "Consideration is a bargained-for exchange.",
        "option_explanations": ["Gifts lack exchange.", "Correct.", "No return = no exchange.", "Moral duties are not consideration."],
        "difficulty": 3,
    })
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=mc_json))]

    captured = {}
    def recording_completion(model, messages, **kwargs):
        captured["prompt"] = messages[-1]["content"]
        return mock_llm

    with patch("app.services.tutor.completion", side_effect=recording_completion), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[_curriculum_result()]):
        resp = client.post("/api/tutor/mc/start", headers=auth_headers, json={"topic_id": "contracts", "difficulty": 3})

    assert resp.status_code == 200
    assert "Example card 1" in captured["prompt"]
    assert "What is consideration?" in captured["prompt"]


def test_curriculum_exemplars_tries_topic_filter_then_cross_topic(client):
    from unittest.mock import patch

    from app.services.tutor import tutor_service

    calls = []

    def fake_retrieve(query, top_k=3, min_score=0.45, topic=None):
        calls.append(topic)
        return [] if topic else [_curriculum_result()]

    with patch("app.services.tutor.retrieve_curriculum", side_effect=fake_retrieve):
        exemplars = tutor_service._curriculum_exemplars("contracts")

    assert len(exemplars) == 1
    assert calls == ["contracts", None]


# ------------------------------------------------------ related concepts (Step 2)

def test_related_concepts_requires_auth(client):
    resp = client.post("/api/tutor/related", json={"question": "consideration"})
    assert resp.status_code == 401


def test_related_concepts_excludes_current_topic(client, auth_headers):
    from unittest.mock import patch

    with patch("app.services.tutor.retrieve_curriculum", return_value=[
        _curriculum_result("What is consideration?", "contracts"),
        _curriculum_result("What is a bailment?", "property", topic_name="Property"),
        _curriculum_result("What is negligence?", "torts", topic_name="Torts"),
    ]):
        resp = client.post("/api/tutor/related", headers=auth_headers, json={
            "question": "consideration", "exclude_topic": "contracts", "top_k": 4,
        })

    assert resp.status_code == 200
    data = resp.json()
    topics = [c["topic_id"] for c in data["cards"]]
    assert "contracts" not in topics
    assert "property" in topics
    assert "torts" in topics
    assert all(c["question"] for c in data["cards"])


def test_related_concepts_empty_when_only_same_topic_cards(client, auth_headers):
    from unittest.mock import patch

    # Only same-topic cards are close enough: cross-topic mode must return
    # nothing rather than repeat the card the student is already looking at.
    with patch("app.services.tutor.retrieve_curriculum", return_value=[
        _curriculum_result("What is consideration?", "contracts"),
    ]):
        resp = client.post("/api/tutor/related", headers=auth_headers, json={
            "question": "consideration", "exclude_topic": "contracts",
        })

    assert resp.status_code == 200
    assert resp.json()["cards"] == []


# ------------------------------------------------------- review queue (Step 2)

def test_review_mark_and_queue_round_trip(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    weak = TOPICS["contracts"]["questions"][0]
    strong = TOPICS["contracts"]["questions"][1]

    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        resp = client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": weak.question, "topic_id": "contracts", "got_it": False,
        })
        assert resp.status_code == 200
        client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": strong.question, "topic_id": "contracts", "got_it": True,
        })

        resp = client.get("/api/tutor/review/queue", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    card = data["cards"][0]
    assert card["question"] == weak.question
    assert card["topic_id"] == "contracts"
    assert len(card["expected_concepts"]) > 0


def test_review_mark_overwrites_previous_self_assessment(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    q = TOPICS["contracts"]["questions"][0]
    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": q.question, "topic_id": "contracts", "got_it": True,
        })
        client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": q.question, "topic_id": "contracts", "got_it": False,
        })
        resp = client.get("/api/tutor/review/queue", headers=auth_headers)
    assert resp.json()["total"] == 1


def test_review_queue_returns_all_weak_cards_beyond_limit(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    # 14 cards marked "need to study" — the old 10-card cap dropped 4 of them
    weak_cards = TOPICS["contracts"]["questions"][:14]
    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        for q in weak_cards:
            client.post("/api/tutor/review/mark", headers=auth_headers, json={
                "question": q.question, "topic_id": "contracts", "got_it": False,
            })
        resp = client.get("/api/tutor/review/queue", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 14
    questions = [c["question"] for c in data["cards"]]
    assert len(set(questions)) == 14
    for q in weak_cards:
        assert q.question in questions


def test_review_queue_enriches_with_similar_cards_and_deduplicates(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    weak = TOPICS["contracts"]["questions"][0]
    similar = _curriculum_result("What is a counteroffer?", "contracts")
    similar["payload"]["expected_concepts"] = ["revocation", "counteroffer"]

    with patch("app.services.tutor.retrieve_curriculum", side_effect=[
        [],  # enrichment phase only (marked card resolves from TOPICS)
    ]):
        client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": weak.question, "topic_id": "contracts", "got_it": False,
        })
        resp = client.get("/api/tutor/review/queue", headers=auth_headers)
        assert resp.json()["total"] == 1  # no enrichment cards available

    # With enrichment available, the similar card is appended (not duplicated)
    with patch("app.services.tutor.retrieve_curriculum", return_value=[similar, similar]):
        resp = client.get("/api/tutor/review/queue", headers=auth_headers)
    data = resp.json()
    assert data["total"] == 2
    questions = [c["question"] for c in data["cards"]]
    assert len(set(questions)) == 2
    assert data["cards"][0]["question"] == weak.question  # own weak card first


def test_review_queue_excludes_mastered_cards_from_enrichment(client, auth_headers):
    from unittest.mock import patch
    from app.services.tutor_data import TOPICS

    weak = TOPICS["contracts"]["questions"][0]
    mastered_card = _curriculum_result(TOPICS["contracts"]["questions"][2].question, "contracts")

    with patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": weak.question, "topic_id": "contracts", "got_it": False,
        })
        client.post("/api/tutor/review/mark", headers=auth_headers, json={
            "question": TOPICS["contracts"]["questions"][2].question,
            "topic_id": "contracts", "got_it": True,
        })

    # Enrichment would surface the mastered card, but the queue must skip it
    with patch("app.services.tutor.retrieve_curriculum", return_value=[mastered_card]):
        resp = client.get("/api/tutor/review/queue", headers=auth_headers)
    data = resp.json()
    assert data["total"] == 1
    assert data["cards"][0]["question"] == weak.question


# ---------------------------------------------- completed-session persistence

def test_tutor_completed_session_persists_to_db(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json
    from app import db

    start = client.post("/api/tutor/start", headers=auth_headers, json={"topic_id": "contracts"})
    assert start.status_code == 200
    total = start.json()["total_questions"]
    assert total > 0

    valid_eval = {
        "evaluation": "correct",
        "explanation": "Good answer!",
        "follow_up_question": None,
        "follow_up_hint": None,
        "is_complete": True,
        "missed_concepts": [],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid_eval)))]
    with patch("app.services.tutor.completion", return_value=mock_llm):
        for _ in range(total):
            resp = client.post("/api/tutor/answer", headers=auth_headers, json={
                "answer": "Consideration is a bargained-for exchange.",
            })
            assert resp.status_code == 200

    conn = db.get_db()
    try:
        user_id = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()["id"]
        row = conn.execute("SELECT * FROM tutor_sessions").fetchone()
        assert row is not None, "completed session was not persisted"
        assert row["user_id"] == user_id
        assert row["topic_id"] == "contracts"
        assert row["mode"] == "curriculum"
        assert row["correct_count"] == total
        assert row["wrong_count"] == 0
        assert row["total_questions"] == total
    finally:
        conn.close()


def test_tutor_completed_mc_quiz_persists_to_db(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json
    from app import db

    mc_json = json.dumps({
        "question": "Which of the following is consideration?",
        "options": ["A gift", "A bargained-for exchange", "A promise with no return", "A moral obligation"],
        "correct_index": 1,
        "explanation": "Consideration is a bargained-for exchange.",
        "option_explanations": ["Gifts lack exchange.", "Correct.", "No return = no exchange.", "Moral duties are not consideration."],
        "difficulty": 3,
    })
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=mc_json))]
    with patch("app.services.tutor.completion", return_value=mock_llm), \
         patch("app.services.tutor.retrieve_curriculum", return_value=[]):
        resp = client.post("/api/tutor/mc/start", headers=auth_headers, json={
            "topic_id": "contracts", "difficulty": 3,
        })
        assert resp.status_code == 200
        total = resp.json()["total_questions"]
        for _ in range(total):
            resp = client.post("/api/tutor/mc/answer", headers=auth_headers, json={
                "selected_index": 1,
            })
            assert resp.status_code == 200
            assert resp.json()["correct"] is True

    conn = db.get_db()
    try:
        user_id = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()["id"]
        row = conn.execute("SELECT * FROM tutor_sessions").fetchone()
        assert row is not None, "completed MC quiz was not persisted"
        assert row["user_id"] == user_id
        assert row["topic_id"] == "contracts"
        assert row["mode"] == "mc"
        assert row["correct_count"] == total
        assert row["wrong_count"] == 0
        assert row["total_questions"] == total
    finally:
        conn.close()
