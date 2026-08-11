"""Tests for the CourtListener connector's seed fallback.

Some CourtListener clusters (e.g. Penn Central Transportation Co.) expose a
syllabus-only stub as their first sub-opinion. The connector must fall back
to the curated landmark_seed.json instead of returning a ~180-char stub.
"""
from unittest.mock import patch

from connectors import courtlistener
from connectors.courtlistener import _SEED_TEXT_THRESHOLD, _seed_fallback

PENN_CENTRAL_QUERY = "Penn Central Transportation Co. v. New York City 438 U.S. 104"


def _penn_cluster() -> dict:
    return {
        "id": 12345,
        "case_name": "Penn Central Transportation Co. v. New York City",
        "court": "scotus",
        "date_filed": "1978-06-26",
        "citations": [{"volume": "438", "reporter": "U.S.", "page": "104"}],
        "sub_opinions": ["https://www.courtlistener.com/api/rest/v4/opinions/999/"],
    }


def test_seed_fallback_returns_full_penn_central_text():
    result = _seed_fallback(PENN_CENTRAL_QUERY)
    assert result is not None
    assert result["source"] == "seed"
    assert len(result["opinion_text"]) >= _SEED_TEXT_THRESHOLD


def test_seed_fallback_none_for_unknown_case():
    assert _seed_fallback("Fleming v. Jane Doe 1234") is None


def test_case_brief_stub_falls_back_to_seed(test_db):
    with patch("connectors.courtlistener._lookup_citation", return_value=_penn_cluster()), \
         patch("connectors.courtlistener._has_auth", return_value=True), \
         patch("connectors.courtlistener.get_opinion_by_id",
               return_value={"id": 999, "type": "120day", "author": "",
                             "plain_text": "A syllabus stub."}):
        result = courtlistener.case_brief_from_query(PENN_CENTRAL_QUERY)

    assert result is not None
    assert result["source"] == "seed"
    assert len(result["opinion_text"]) >= _SEED_TEXT_THRESHOLD


def test_stub_already_in_cache_is_replaced_with_seed(test_db):
    cache_key = "penn central transportation co. v. new york city"
    courtlistener._cache_set(cache_key, {
        "case_name": "Penn Central Transportation Co. v. New York City",
        "court": "scotus",
        "date_filed": "1978-06-26",
        "citations": ["438 U.S. 104"],
        "opinion_text": "A syllabus stub.",
        "opinion_id": 999,
        "cluster_id": 12345,
    })

    with patch("connectors.courtlistener._lookup_citation", return_value=_penn_cluster()), \
         patch("connectors.courtlistener._has_auth", return_value=True), \
         patch("connectors.courtlistener.get_opinion_by_id",
               return_value={"id": 999, "type": "120day", "author": "",
                             "plain_text": "Another syllabus stub."}):
        result = courtlistener.case_brief_from_query(PENN_CENTRAL_QUERY)

    assert result is not None
    assert result["source"] == "seed"
    assert len(result["opinion_text"]) >= _SEED_TEXT_THRESHOLD

    # The stub row was overwritten — a second call now serves the good text from cache.
    again = courtlistener.case_brief_from_query(PENN_CENTRAL_QUERY)
    assert again["source"] == "cache"
    assert len(again["opinion_text"]) >= _SEED_TEXT_THRESHOLD
