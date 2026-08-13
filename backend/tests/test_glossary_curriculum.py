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


# ---------------------------------------------------- related curriculum cards

def _curriculum_result(question, topic, topic_name, difficulty=2, answer="An educative answer."):
    return {
        "content": f"Question: {question}",
        "payload": {
            "kind": "curriculum",
            "topic": topic,
            "topic_name": topic_name,
            "question": question,
            "answer": answer,
            "expected_concepts": ["concept"],
            "difficulty": difficulty,
        },
    }


def test_related_curriculum_returns_multiple_cards_from_qdrant():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_curriculum", return_value=[
        _curriculum_result("What is consideration?", "contracts", "Contracts"),
        _curriculum_result("What is a bailment?", "property", "Property"),
    ]):
        cards = svc._retrieve_curriculum_cards("consideration")

    assert len(cards) == 2
    assert cards[0].topic_id == "contracts"
    assert cards[0].difficulty == 2
    assert cards[1].topic_name == "Property"
    assert cards[0].expected_concepts == ["concept"]


def test_related_curriculum_deduplicates_repeated_questions():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_curriculum", return_value=[
        _curriculum_result("Same question?", "contracts", "Contracts"),
        _curriculum_result("Same question?", "torts", "Torts"),
    ]):
        cards = svc._retrieve_curriculum_cards("anything")

    assert len(cards) == 1


def test_related_curriculum_falls_back_to_keyword_scan_when_qdrant_empty():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_curriculum", return_value=[]):
        cards = svc._retrieve_curriculum_cards("consideration")

    assert len(cards) == 1
    assert cards[0].topic_id == "contracts"


def test_related_curriculum_empty_when_both_paths_fail():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_curriculum", return_value=[]):
        cards = svc._retrieve_curriculum_cards("xylophone")

    assert cards == []


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


# ------------------------------------------------- semantic glossary seed lookup

def _seed_result(term, definition="A definition.", score=0.58):
    return {
        "content": f"Term: {term}\nDefinition: {definition}",
        "score": score,
        "payload": {
            "kind": "glossary_seed",
            "term": term,
            "definition": definition,
            "etymology": None,
            "jurisdiction": "US",
            "usage_example": f"Example using {term}.",
            "related_terms": ["one", "two"],
            "also_known_as": None,
            "practice_tips": "A tip.",
        },
    }


def test_semantic_seed_match_serves_paraphrase_without_llm():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[
        _seed_result("intestate", "Dying without a valid will."),
    ]), patch("app.services.legal_glossary.completion", side_effect=AssertionError("LLM must not be called")):
        result = svc.lookup("who inherits when you die without making a will")

    assert result.from_seed is True
    assert result.term == "intestate"
    assert result.related_terms == ["one", "two"]


def test_keyword_match_takes_priority_over_semantic():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_glossary_seed",
               side_effect=AssertionError("semantic must not run for exact term")):
        result = svc.lookup("habeas corpus")

    assert result.from_seed is True
    assert result.term.lower() == "habeas corpus"


def test_semantic_seed_empty_falls_through_to_llm():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[]), \
         patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)):
        result = svc.lookup("some unknown phrase")

    assert result.from_seed is False
    assert result.term == "novel term"


def test_semantic_seed_down_falls_through_to_llm():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    with patch("app.services.legal_glossary.retrieve_glossary_seed",
               side_effect=RuntimeError("qdrant down")), \
         patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)):
        result = svc.lookup("some unknown phrase")

    assert result.from_seed is False
    assert result.term == "novel term"


def test_semantic_seed_below_threshold_falls_through_to_llm():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[]), \
         patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)):
        result = svc.lookup("random unrelated words xylophone")

    assert result.from_seed is False


def test_semantic_seed_serves_low_score_with_clear_margin():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[
        _seed_result("intestate", "Dying without a valid will.", score=0.52),
        _seed_result("probate", "Court-supervised distribution of an estate.", score=0.30),
    ]), patch("app.services.legal_glossary.completion", side_effect=AssertionError("LLM must not be called")):
        result = svc.lookup("who inherits when you die without making a will")

    assert result.from_seed is True
    assert result.term == "intestate"


def test_semantic_seed_tie_near_band_top_falls_through_to_llm():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    # 0.52 vs 0.51: flat band near-miss — the margin is too thin to trust,
    # so the LLM (not a possibly-wrong seed term) must answer.
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[
        _seed_result("intestate", "Dying without a valid will.", score=0.52),
        _seed_result("probate", "Court-supervised distribution of an estate.", score=0.51),
    ]), patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)):
        result = svc.lookup("who inherits when you die without making a will")

    assert result.from_seed is False
    assert result.term == "novel term"


def test_semantic_seed_single_result_below_confident_falls_through_to_llm():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    # One candidate only — there is no runner-up to establish a margin.
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[
        _seed_result("intestate", "Dying without a valid will.", score=0.40),
    ]), patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)):
        result = svc.lookup("who inherits when you die without making a will")

    assert result.from_seed is False
    assert result.term == "novel term"


def test_semantic_seed_below_floor_falls_through_to_llm():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[
        _seed_result("intestate", "Dying without a valid will.", score=0.30),
        _seed_result("probate", "Court-supervised distribution of an estate.", score=0.20),
    ]), patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)):
        result = svc.lookup("who inherits when you die without making a will")

    assert result.from_seed is False
    assert result.term == "novel term"


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
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[]), \
         patch("app.services.legal_glossary.completion", side_effect=[bad_response, good_response]):
        result = svc.lookup("random term")

    assert result.term == "test term"
    assert result.from_seed is False


def test_glossary_raises_friendly_error_after_both_attempts_fail():
    svc = _service()
    bad_response = _mock_llm_response("still not json")
    with patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[]), \
         patch("app.services.legal_glossary.completion", return_value=bad_response):
        with pytest.raises(ValueError, match="Failed to look up term"):
            svc.lookup("random term")


def test_seed_lookup_returns_list_of_related_curriculum_cards():
    svc = _service()
    with patch("app.services.legal_glossary.retrieve_curriculum", return_value=[
        _curriculum_result("What is consideration?", "contracts", "Contracts"),
    ]):
        result = svc.lookup("consideration")

    assert result.from_seed is True
    assert isinstance(result.related_curriculum, list)
    assert len(result.related_curriculum) == 1
    assert result.related_curriculum[0].topic_id == "contracts"


def test_llm_path_tolerates_empty_qdrant_cards():
    svc = _service()
    good_json = json.dumps({
        "term": "novel term",
        "definition": "A definition.",
        "usage_example": "An example.",
        "related_terms": [],
        "citations": [],
    })
    with patch("app.services.legal_glossary.completion", return_value=_mock_llm_response(good_json)), \
         patch("app.services.legal_glossary.retrieve_glossary_seed", return_value=[]), \
         patch("app.services.legal_glossary.retrieve_curriculum", return_value=[]):
        result = svc.lookup("novel term")

    assert result.from_seed is False
    assert isinstance(result.related_curriculum, list)
    assert all(c.question for c in result.related_curriculum)