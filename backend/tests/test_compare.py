"""Tests for the case comparison endpoint (POST /api/doctrine/compare).

The endpoint pairs curated static facts (no LLM) with an LLM-generated
narrative comparison built from the offline seed opinions.
"""
import json
from unittest.mock import MagicMock, patch


def _valid_comparison():
    return {
        "similarities": ["Both involve Fourteenth Amendment analysis."],
        "differences": ["Roe recognized the right; Dobbs rejected it."],
        "relationship": "Dobbs overruled Roe's central holding.",
        "relationship_type": "overruled",
        "significance": "Shows how constitutional doctrine can shift.",
        "practice_note": "Cite Roe for the pre-2022 standard and Dobbs for current law.",
    }


def _mock_llm(content: str):
    mock = MagicMock()
    mock.choices = [MagicMock(message=MagicMock(content=content))]
    return mock


def test_compare_returns_curated_facts_and_comparison(client, auth_headers):
    with patch(
        "app.services.compare.completion",
        return_value=_mock_llm(json.dumps(_valid_comparison())),
    ):
        resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
            "case_names": ["Roe v. Wade", "Dobbs v. Jackson Women's Health"],
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_a"]["name"] == "Roe v. Wade"
    assert data["case_a"]["citation"] == "410 U.S. 113"
    assert data["case_a"]["year"] == 1973
    assert data["case_a"]["court"]
    assert data["case_a"]["date_filed"]
    assert data["case_a"]["subjects"]
    assert data["case_a"]["holdings"]
    assert data["case_b"]["name"] == "Dobbs v. Jackson Women's Health"
    comp = data["comparison"]
    assert comp["relationship_type"] == "overruled"
    assert len(comp["similarities"]) == 1
    assert len(comp["differences"]) == 1
    assert data["sources_consulted"] == ["Roe v. Wade", "Dobbs v. Jackson Women's Health"]
    assert "disclaimer" in data


def test_compare_requires_exactly_two_cases(client, auth_headers):
    resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
        "case_names": ["Roe v. Wade"],
    })
    assert resp.status_code == 400
    resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
        "case_names": ["Roe v. Wade", "Roe v. Wade"],
    })
    assert resp.status_code == 400


def test_compare_unknown_case_returns_400(client, auth_headers):
    resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
        "case_names": ["Roe v. Wade", "Fictional v. Case"],
    })
    assert resp.status_code == 400
    assert "Unknown landmark case" in resp.json()["detail"]


def test_compare_requires_auth(client):
    resp = client.post("/api/doctrine/compare", json={
        "case_names": ["Roe v. Wade", "Dobbs v. Jackson Women's Health"],
    })
    assert resp.status_code == 401


def test_compare_llm_error_returns_friendly_message(client, auth_headers):
    with patch("app.services.compare.completion", side_effect=Exception("Insufficient credits")):
        resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
            "case_names": ["Roe v. Wade", "Dobbs v. Jackson Women's Health"],
        })
    assert resp.status_code == 400
    assert "credit" in resp.json()["detail"].lower() or "fund" in resp.json()["detail"].lower()


def test_compare_case_name_accepts_loose_input(client, auth_headers):
    """Partial case names resolve when the match is unambiguous."""
    with patch(
        "app.services.compare.completion",
        return_value=_mock_llm(json.dumps(_valid_comparison())),
    ):
        resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
            "case_names": ["Roe v. Wade", "Dobbs v. Jackson"],
        })
    assert resp.status_code == 200
    assert resp.json()["case_b"]["name"] == "Dobbs v. Jackson Women's Health"


def test_compare_saves_document(client, auth_headers):
    with patch(
        "app.services.compare.completion",
        return_value=_mock_llm(json.dumps(_valid_comparison())),
    ):
        resp = client.post("/api/doctrine/compare", headers=auth_headers, json={
            "case_names": ["Roe v. Wade", "Dobbs v. Jackson Women's Health"],
        })
    assert resp.status_code == 200
    docs = client.get("/api/documents", headers=auth_headers).json()
    saved = [d for d in docs if d["doc_type"] == "case_comparison"]
    assert saved
    assert "Roe v. Wade vs Dobbs v. Jackson Women's Health" in saved[0]["title"]