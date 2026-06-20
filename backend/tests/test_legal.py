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


def test_glossary_case_insensitive_match(client, auth_headers):
    resp = client.post("/api/legal/glossary", headers=auth_headers, json={
        "query": "Habeas Corpus",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["term"].lower() == "habeas corpus"
    assert data["from_seed"] is True


def test_glossary_without_auth_returns_401(client):
    resp = client.post("/api/legal/glossary", json={"query": "test"})
    assert resp.status_code == 401


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
