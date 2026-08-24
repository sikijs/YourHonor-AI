"""Free offline MC bank tests.

The offline tier assembles multiple-choice questions from the curated tutor
cards with zero LLM involvement. These tests cover the builder itself, the
no-repeat guarantee across a session, and the API flow end to end —
including a hard assertion that litellm.completion is never called.
"""

from unittest.mock import MagicMock, patch

from app import db
from app.services.mc_bank import OFFLINE_MC_QUESTIONS, _first_sentence, build_question
from app.services.tutor_data import TOPICS


# ------------------------------------------------------------ unit: builder

def test_first_sentence_splits_on_real_sentence_ends():
    text = ("The Statute of Frauds is a legal rule requiring certain contracts "
            "to be in writing to be enforceable. It applies to land sales and more.")
    assert _first_sentence(text).endswith("enforceable.")


def test_first_sentence_does_not_split_on_abbreviations():
    text = "The U.S. Supreme Court reviews acts of Congress. It can strike them down."
    assert _first_sentence(text).endswith("Congress.")


def test_first_sentence_caps_length():
    assert len(_first_sentence("Word " * 200)) <= 240


def test_build_question_shape_and_correctness():
    question, stem = build_question("contracts", set())
    card = next(q for q in TOPICS["contracts"]["questions"] if q.question == stem)

    assert len(question.options) == 4
    assert len(set(question.options)) == 4
    assert 0 <= question.correct_index < 4
    assert question.difficulty == card.difficulty
    # The correct option is drawn from this card's own vetted answer.
    correct_option = question.options[question.correct_index]
    assert correct_option in card.answer
    # Explanations align with options; wrong ones point at their true concept.
    assert len(question.option_explanations) == 4
    assert question.option_explanations[question.correct_index].startswith("Correct.")
    for i, expl in enumerate(question.option_explanations):
        if i != question.correct_index:
            assert expl.startswith("Incorrect —")
    assert question.explanation == card.answer.strip()


def test_session_never_repeats_a_stem():
    used: set[str] = set()
    stems = []
    for _ in range(OFFLINE_MC_QUESTIONS):
        _, stem = build_question("contracts", used)
        used.add(stem)
        stems.append(stem)
    assert len(set(stems)) == OFFLINE_MC_QUESTIONS


def test_unknown_topic_raises():
    try:
        build_question("not-a-topic", set())
        raise AssertionError("expected ValueError")
    except ValueError as e:
        assert "Unknown topic" in str(e)


# ------------------------------------------------------------- integration

def test_offline_start_requires_auth(client):
    resp = client.post("/api/tutor/mc-offline/start", json={"topic_id": "contracts"})
    assert resp.status_code == 401


def test_offline_start_unknown_topic(client, auth_headers):
    resp = client.post("/api/tutor/mc-offline/start",
                       json={"topic_id": "not-a-topic"}, headers=auth_headers)
    assert resp.status_code == 400


def test_full_offline_run_without_any_llm_calls(client, auth_headers):
    """Start + 10 answers complete a session with litellm.completion untouched."""
    with patch("app.services.tutor.completion") as mock_llm:
        resp = client.post("/api/tutor/mc-offline/start",
                           json={"topic_id": "contracts"}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_questions"] == OFFLINE_MC_QUESTIONS
        assert data["difficulty"] == 0
        assert len(data["question"]["options"]) == 4

        score = 0
        for i in range(OFFLINE_MC_QUESTIONS):
            answer = client.post("/api/tutor/mc/answer",
                                 json={"selected_index": data["question"]["correct_index"]},
                                 headers=auth_headers).json()
            score += 1 if answer["correct"] else 0
            assert answer["correct_index"] == data["question"]["correct_index"]
            if i < OFFLINE_MC_QUESTIONS - 1:
                assert answer["next_question"] is not None
                assert not answer["is_complete"]
                data["question"] = answer["next_question"]
            else:
                assert answer["is_complete"]
        assert score == OFFLINE_MC_QUESTIONS
        assert mock_llm.call_count == 0

    conn = db.get_db()
    try:
        row = conn.execute(
            "SELECT mode, correct_count, wrong_count, total_questions "
            "FROM tutor_sessions ORDER BY id DESC LIMIT 1"
        ).fetchone()
    finally:
        conn.close()
    assert row["mode"] == "mc_offline"
    assert row["correct_count"] == OFFLINE_MC_QUESTIONS
    assert row["wrong_count"] == 0
    assert row["total_questions"] == OFFLINE_MC_QUESTIONS


def test_offline_and_ai_sessions_do_not_collide(client, auth_headers):
    """Starting an offline quiz replaces any prior AI MC session state."""
    from unittest.mock import MagicMock

    from app.services.tutor import get_tutor_service

    client.post("/api/tutor/mc-offline/start", json={"topic_id": "contracts"},
                headers=auth_headers)
    service = get_tutor_service()

    conn = db.get_db()
    try:
        user_id = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()["id"]
    finally:
        conn.close()
    session = service._mc_sessions[user_id]
    assert session.offline is True
    assert session.total_questions == OFFLINE_MC_QUESTIONS

    fake_response = MagicMock()
    fake_response.choices = [MagicMock(message=MagicMock(content=(
        '{"question":"AI Q?","options":["a","b","c","d"],"correct_index":0,'
        '"explanation":"because","option_explanations":["a","b","c","d"],'
        '"difficulty":3}'
    )))]
    with patch("app.services.tutor.completion", return_value=fake_response) as mock_llm:
        client.post("/api/tutor/mc/start", json={"topic_id": "contracts", "difficulty": 3},
                    headers=auth_headers)
    session2 = service._mc_sessions[user_id]
    assert session2.offline is False
    assert session2.total_questions == 5
    assert mock_llm.call_count == 1
