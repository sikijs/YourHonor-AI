"""Tests for the Bluebook citation formatter.

The formatter is two-tier: a deterministic local pass over the 70 landmark
cases (zero LLM cost) plus an LLM pass for everything else. These tests cover
both paths, input splitting, auth, error handling, and document saving.
"""
import json
from unittest.mock import MagicMock, patch

from app.services.bluebook import LOCAL_CASES, _normalize


def _mock_llm(content: str):
    mock = MagicMock()
    mock.choices = [MagicMock(message=MagicMock(content=content))]
    return mock


def _valid_llm_response(raw_input: str, formatted: str = "Smith v. Jones, 123 F.3d 456 (7th Cir. 2000)."):
    return {
        "entries": [
            {
                "raw_input": raw_input,
                "formatted": formatted,
                "case_name": "Smith v. Jones",
                "authority_type": "case",
                "rules_applied": ["Rule 10 (case citation)", "Rule 10.2.1(a)"],
                "notes": "Reformatted the reporter abbreviation and added the year.",
                "confidence": "high",
                "from_local": False,
            }
        ],
        "general_notes": "Verify all citations against the current Bluebook.",
        "sources_consulted": ["The Bluebook: A Uniform System of Citation"],
    }


def test_local_landmark_hit_uses_zero_llm(client, auth_headers):
    """A landmark case (e.g. Miranda) must format deterministically with no LLM call."""
    with patch("app.services.bluebook.completion") as mock_completion:
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "miranda vs arizona, 384 US 436",
        })
    assert resp.status_code == 200
    mock_completion.assert_not_called()
    data = resp.json()
    assert len(data["entries"]) == 1
    entry = data["entries"][0]
    assert entry["formatted"] == "Miranda v. Arizona, 384 U.S. 436 (1966)"
    assert entry["from_local"] is True
    assert entry["confidence"] == "high"
    assert entry["authority_type"] == "case"


def test_local_hit_covers_all_landmark_cases(client, auth_headers):
    """Every landmark case must be formattable locally (normalization sanity)."""
    assert len(LOCAL_CASES) >= 70
    resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
        "text": "Roe v Wade",
    })
    assert resp.status_code == 200
    entry = resp.json()["entries"][0]
    assert entry["formatted"].startswith("Roe v. Wade,")
    assert entry["from_local"] is True


def test_normalize_matches_punctuation_variants():
    assert _normalize("Miranda v. Arizona") == _normalize("miranda vs arizona,")


def test_llm_path_for_unknown_citation(client, auth_headers):
    """Non-landmark citations go to the LLM and are returned formatted."""
    valid = _valid_llm_response("Smith v Jones, 123 F3d 456 (2000)")
    with patch("app.services.bluebook.completion", return_value=_mock_llm(json.dumps(valid))) as mock_completion:
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "Smith v Jones, 123 F3d 456 (2000)",
        })
    assert resp.status_code == 200
    mock_completion.assert_called_once()
    data = resp.json()
    assert len(data["entries"]) == 1
    entry = data["entries"][0]
    assert entry["formatted"] == "Smith v. Jones, 123 F.3d 456 (7th Cir. 2000)."
    assert entry["from_local"] is False
    assert "Rule 10" in entry["rules_applied"][0]
    assert data["general_notes"]
    assert "Bluebook" in data["sources_consulted"][0]
    assert "disclaimer" in data


def test_mixed_local_and_llm_entries_preserve_order(client, auth_headers):
    """Local + LLM entries must be merged back into the original input order."""
    valid = _valid_llm_response("Smith v Jones, 123 F3d 456 (2000)")
    with patch("app.services.bluebook.completion", return_value=_mock_llm(json.dumps(valid))):
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "Roe v Wade\nSmith v Jones, 123 F3d 456 (2000)\nMiranda v Arizona",
        })
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 3
    assert entries[0]["from_local"] is True
    assert entries[0]["formatted"].startswith("Roe v. Wade,")
    assert entries[1]["from_local"] is False
    assert entries[2]["from_local"] is True
    assert entries[2]["formatted"].startswith("Miranda v. Arizona,")


def test_semicolon_splitting(client, auth_headers):
    """A single line with multiple citations separated by semicolons splits into entries."""
    valid = _valid_llm_response("Smith v Jones, 123 F3d 456 (2000)")
    with patch("app.services.bluebook.completion", return_value=_mock_llm(json.dumps(valid))):
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "Roe v Wade; Smith v Jones, 123 F3d 456 (2000)",
        })
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 2
    assert entries[0]["from_local"] is True
    assert entries[1]["from_local"] is False


def test_missing_llm_entry_falls_back_unchanged(client, auth_headers):
    """If the LLM omits an entry, the raw input is returned unchanged with low confidence."""
    valid = {
        "entries": [],
        "general_notes": "",
        "sources_consulted": [],
    }
    with patch("app.services.bluebook.completion", return_value=_mock_llm(json.dumps(valid))):
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "Some odd citation 1234",
        })
    assert resp.status_code == 200
    entry = resp.json()["entries"][0]
    assert entry["formatted"] == "Some odd citation 1234"
    assert entry["confidence"] == "low"


def test_empty_text_returns_400(client, auth_headers):
    resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={"text": ""})
    assert resp.status_code == 400


def test_without_auth_returns_401(client):
    resp = client.post("/api/legal/bluebook-format", json={"text": "Roe v Wade"})
    assert resp.status_code == 401


def test_llm_error_returns_friendly_message(client, auth_headers):
    with patch("app.services.bluebook.completion", side_effect=Exception("Insufficient credits")):
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "Smith v Jones, 123 F3d 456 (2000)",
        })
    assert resp.status_code == 400
    assert "credit" in resp.json()["detail"].lower() or "fund" in resp.json()["detail"].lower()


def test_result_is_saved_as_document(client, auth_headers):
    """The formatted citations must be persisted as a bluebook_citations document."""
    valid = _valid_llm_response("Smith v Jones, 123 F3d 456 (2000)")
    with patch("app.services.bluebook.completion", return_value=_mock_llm(json.dumps(valid))):
        resp = client.post("/api/legal/bluebook-format", headers=auth_headers, json={
            "text": "Smith v Jones, 123 F3d 456 (2000)",
        })
    assert resp.status_code == 200
    docs = client.get("/api/documents", headers=auth_headers).json()
    saved = [d for d in docs if d["doc_type"] == "bluebook_citations"]
    assert saved, "No bluebook_citations document was saved"
    assert "Smith v. Jones" in saved[0]["content"]