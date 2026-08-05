"""Tests for the glossary related-curriculum badge (in-memory TOPICS scan)."""
import json
import pytest
from types import SimpleNamespace
from unittest.mock import patch

from app.services.legal_glossary import GlossaryService


def _service() -> GlossaryService:
    return GlossaryService()


def test_card_found_for_known_term():
    card = _service()._find_curriculum_card("consideration")
    assert card is not None
    assert card.topic_id == "contracts"
    assert card.question
    assert card.answer
    assert card.difficulty >= 1


def test_card_not_found_for_unrelated_term():
    assert _service()._find_curriculum_card("xylophone") is None


def test_query_term_dominates_over_noisy_entry_keywords():
    entry = {
        "term": "habeas corpus",
        "related_terms": ["writ", "court", "person"],
        "definition": "A long verbose text mentioning court, person, judge, and imprisonment.",
    }
    card = _service()._find_curriculum_card("habeas corpus", entry)
    assert card is not None
    assert card.topic_id == "constitutional_law"
    assert "suspension" in card.question.lower() or "habeas" in card.question.lower()


def test_entry_keywords_are_used_as_fallback_when_query_has_no_match():
    entry = {
        "term": "negligence",
        "related_terms": ["duty of care"],
        "definition": "A tort standard about reasonable conduct.",
    }
    card = _service()._find_curriculum_card("abcxyz", entry)
    assert card is not None
    assert card.topic_id == "torts"


# --------------------------------------------------------- fuzzy seed matching

def test_fuzzy_seed_match_tolerates_typo():
    svc = _service()
    if not svc._seed:
        pytest.skip("glossary seed data not loaded")
    hit = svc._lookup_seed("habeus corpus")
    assert hit is not None
    assert hit["term"].lower() == "habeas corpus"


def test_fuzzy_seed_match_rejects_unrelated_query():
    svc = _service()
    if not svc._seed:
        pytest.skip("glossary seed data not loaded")
    assert svc._lookup_seed("xylophone") is None


# ------------------------------------------------------------- LLM retry path

def _mock_llm_response(content: str):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def test_glossary_retries_once_when_llm_output_is_not_json():
    svc = _service()
    good_json = json.dumps({
        "term": "test term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": ["one", "two"],
        "citations": [],
    })
    bad_response = _mock_llm_response("I cannot answer that question directly.")
    good_response = _mock_llm_response(good_json)
    with patch("app.services.legal_glossary.completion", side_effect=[bad_response, good_response]):
        result = svc.lookup("random term")

    assert result.term == "test term"
    assert result.from_seed is False


def test_glossary_raises_friendly_error_after_both_attempts_fail():
    svc = _service()
    bad_response = _mock_llm_response("still not json")
    with patch("app.services.legal_glossary.completion", return_value=bad_response):
        with pytest.raises(ValueError, match="Failed to look up term"):
            svc.lookup("random term")