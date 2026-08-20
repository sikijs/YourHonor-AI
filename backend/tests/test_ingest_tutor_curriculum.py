"""Tests for the AI Tutor curriculum point builder and startup seeding."""
from unittest.mock import patch

from app.ingest_tutor_curriculum import build_curriculum_points, seed_tutor_curriculum, CARD_KIND
from app.services.tutor_data import TOPICS
from app.services.qdrant_store import TUTOR_COLLECTION_NAME


def test_build_curriculum_points_one_per_card():
    points = build_curriculum_points()
    expected = sum(len(t["questions"]) for t in TOPICS.values())
    assert expected > 0
    assert len(points) == expected
    for p in points:
        assert p["content"]
        payload = p["payload"]
        assert payload["kind"] == CARD_KIND
        assert payload["topic"] in TOPICS
        assert payload["question"]
        assert payload["answer"]
        assert payload["expected_concepts"]


def test_build_curriculum_points_content_carries_question_and_answer():
    points = build_curriculum_points()
    first = points[0]
    assert first["content"].startswith("Question: ")
    assert f"Answer: {first['payload']['answer']}" in first["content"]
    assert first["payload"]["topic"] == "contracts"
    assert "question_index" in first["payload"]


def test_seed_tutor_curriculum_deletes_then_upserts_into_tutor_collection():
    with patch("app.ingest_tutor_curriculum.add_points") as mock_add, \
         patch("app.ingest_tutor_curriculum.delete_collection") as mock_delete:
        result = seed_tutor_curriculum()

    expected = sum(len(t["questions"]) for t in TOPICS.values())
    assert result == expected
    mock_delete.assert_called_once_with(TUTOR_COLLECTION_NAME)
    call = mock_add.call_args
    assert call.kwargs["collection_name"] == TUTOR_COLLECTION_NAME
    assert len(call.args[0]) == expected


def test_seed_tutor_curriculum_returns_zero_on_error():
    with patch("app.ingest_tutor_curriculum.add_points", side_effect=RuntimeError("down")), \
         patch("app.ingest_tutor_curriculum.delete_collection"):
        result = seed_tutor_curriculum()
    assert result == 0