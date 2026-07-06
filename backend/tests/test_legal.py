def test_glossary_seed_term_returns_without_llm(client, auth_headers):
    resp = client.post("/api/legal/glossary", headers=auth_headers, json={
        "query": "stare decisis",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["term"].lower() == "stare decisis"
    assert data["from_seed"] is True
    assert "definition" in data
    assert "usage_example" in data
    assert "sources" in data
    assert len(data["sources"]) == 1
    assert data["sources"][0]["source_type"] == "seed"


def test_glossary_case_insensitive_match(client, auth_headers):
    resp = client.post("/api/legal/glossary", headers=auth_headers, json={
        "query": "Habeas Corpus",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["term"].lower() == "habeas corpus"
    assert data["from_seed"] is True
    assert "sources" in data
    assert len(data["sources"]) == 1
    assert data["sources"][0]["source_type"] == "seed"


def test_glossary_without_auth_returns_401(client):
    resp = client.post("/api/legal/glossary", json={"query": "test"})
    assert resp.status_code == 401


def test_case_brief_response_contains_sources(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid_brief = {
        "case_name": "Test Case",
        "citation": [],
        "court": "Supreme Court",
        "date_filed": "2024-01-01",
        "facts": "Test facts.",
        "procedural_history": "Test history.",
        "issues": ["Issue one"],
        "holding": "Test holding.",
        "reasoning": "Test reasoning.",
        "rule_of_law": "Test rule.",
        "significance": "Test significance.",
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid_brief)))]
    with (
        patch("app.services.case_brief.completion", return_value=mock_llm),
        patch("app.services.case_brief._has_auth", return_value=False),
    ):
        resp = client.post("/api/legal/case-brief", headers=auth_headers, json={
            "query": "Marbury v. Madison",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert "sources" in data
    assert isinstance(data["sources"], list)


def test_case_brief_without_auth_returns_401(client):
    resp = client.post("/api/legal/case-brief", json={"query": "Miranda v. Arizona"})
    assert resp.status_code == 401


def test_summary_without_auth_returns_401(client):
    resp = client.post("/api/legal/summary", json={"query": "contract law"})
    assert resp.status_code == 401


def test_arguments_without_auth_returns_401(client):
    resp = client.post("/api/legal/arguments", json={"query": "test case"})
    assert resp.status_code == 401


def test_citations_without_auth_returns_401(client):
    resp = client.post("/api/legal/citations", json={"query": "Marbury v. Madison"})
    assert resp.status_code == 401


def test_memorandum_without_auth_returns_401(client):
    resp = client.post("/api/legal/memorandum", json={"query": "Is a non-compete enforceable?"})
    assert resp.status_code == 401


def test_debate_without_auth_returns_401(client):
    resp = client.post("/api/legal/debate", json={"query": "Should abortion be legal?"})
    assert resp.status_code == 401
