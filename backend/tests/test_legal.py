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
        "concurrence": None,
        "dissent": None,
        "significance": "Test significance.",
        "sources_consulted": ["test source"],
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


def test_summary_success(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "title": "Contract Law Summary",
        "overview": "Overview of contract law principles.",
        "key_findings": ["Contracts require consideration"],
        "legal_principles": ["Consideration doctrine"],
        "impact": "Foundation of commercial law",
        "key_points": ["Key point one"],
        "sources_consulted": ["Restatement (Second) of Contracts"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.legal_summary.completion", return_value=mock_llm):
        resp = client.post("/api/legal/summary", headers=auth_headers, json={
            "query": "contract law",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Contract Law Summary"
    assert data["summary_type"] == "general"
    assert "overview" in data
    assert len(data["key_findings"]) == 1


def test_arguments_success(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "case_name": "Test Case",
        "petitioner": "Petitioner Corp",
        "respondent": "Respondent Corp",
        "petitioner_arguments": [{
            "party": "petitioner",
            "argument": "The contract was breached",
            "reasoning": "Respondent failed to deliver",
            "authorities": ["UCC 2-301"],
            "court_resolution": "Rejected",
        }],
        "respondent_arguments": [{
            "party": "respondent",
            "argument": "Delivery was timely",
            "reasoning": "Shipped within 30 days",
            "authorities": ["UCC 2-309"],
            "court_resolution": "Accepted",
        }],
        "counterarguments_considered": [],
        "key_doctrines_statutes": ["UCC Article 2"],
        "winning_party": "respondent",
        "rationale": "Delivery within reasonable time",
        "sources_consulted": ["UCC Article 2"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.argument_extraction.completion", return_value=mock_llm):
        resp = client.post("/api/legal/arguments", headers=auth_headers, json={
            "query": "contract dispute",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_name"] == "Test Case"
    assert data["petitioner"] == "Petitioner Corp"
    assert len(data["petitioner_arguments"]) == 1
    assert len(data["respondent_arguments"]) == 1


def test_citations_success(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "case_name": "Marbury v. Madison",
        "cases_cited": [{
            "name": "Some Precedent",
            "citation": "5 U.S. 137",
            "type": "case",
            "context": "Established judicial review",
            "treatment": "followed",
        }],
        "statutes_cited": [],
        "constitutional_provisions": [{
            "name": "Article III",
            "citation": None,
            "type": "constitutional",
            "context": "Judicial power",
            "treatment": "interpreted",
        }],
        "total_citations": 2,
        "key_precedent": "Some Precedent",
        "sources_consulted": ["test source"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.citation_map.completion", return_value=mock_llm):
        resp = client.post("/api/legal/citations", headers=auth_headers, json={
            "query": "Marbury v. Madison",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_name"] == "Marbury v. Madison"
    assert len(data["cases_cited"]) == 1
    assert data["total_citations"] == 2


def test_memorandum_success(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "to": "Supervising Attorney",
        "author": "YourHonor AI",
        "date": "July 28, 2026",
        "re": "Non-Compete Enforceability",
        "question_presented": "Is this non-compete enforceable?",
        "brief_answer": "Likely yes.",
        "facts": "Employee signed a non-compete.",
        "issues": [{
            "issue": "Is the restriction reasonable?",
            "rule": "Restraints must be reasonable",
            "application": "The restriction is 6 months",
            "conclusion": "Likely reasonable",
        }],
        "overall_conclusion": "The non-compete is likely enforceable.",
        "sources_consulted": ["Restatement (Second) of Contracts"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with (
        patch("app.services.memorandum.completion", return_value=mock_llm),
        patch("app.services.memorandum.MemorandumService._search_courtlistener", return_value=(None, [])),
    ):
        resp = client.post("/api/legal/memorandum", headers=auth_headers, json={
            "query": "non-compete enforceability",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["to"] == "Supervising Attorney"
    assert data["re"] == "Non-Compete Enforceability"
    assert len(data["issues"]) == 1
    assert "overall_conclusion" in data


def test_debate_success(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "topic": "Should abortion be legal?",
        "user_position": "Abortion should be legal",
        "supporting_arguments": [{
            "side": "supporting",
            "title": "Right to Privacy",
            "argument": "Roe established privacy right",
            "reasoning": "14th Amendment liberty interest",
            "authorities": ["Roe v. Wade"],
            "strength": "strong",
            "counter_rebuttal": "Not absolute right",
        }],
        "opposing_arguments": [{
            "side": "opposing",
            "title": "Fetal Life",
            "argument": "Fetus has right to life",
            "reasoning": "Personhood begins at conception",
            "authorities": ["14th Amendment"],
            "strength": "moderate",
            "counter_rebuttal": "Not legally recognized",
        }],
        "key_doctrines_statutes": ["14th Amendment"],
        "predicted_winner": "balanced",
        "rationale": "Both sides have valid arguments",
        "practice_tips": ["Lead with privacy"],
        "sources_consulted": ["Roe v. Wade"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.debate.completion", return_value=mock_llm):
        resp = client.post("/api/legal/debate", headers=auth_headers, json={
            "query": "Should abortion be legal?",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["topic"] == "Should abortion be legal?"
    assert len(data["supporting_arguments"]) == 1
    assert len(data["opposing_arguments"]) == 1
    assert data["predicted_winner"] == "balanced"
