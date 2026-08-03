def test_issue_spotter_success(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "overview": "This fact pattern raises issues under the Fourth Amendment and Miranda doctrine.",
        "issues": [
            {
                "issue": "Did the officer have reasonable suspicion for the stop?",
                "rule": "A Terry stop requires reasonable suspicion of ongoing criminal activity.",
                "application": "The officer observed the defendant's car swerve twice, suggesting possible intoxication or impairment.",
                "conclusion": "Likely yes — erratic driving provides reasonable suspicion.",
                "missing_information": "Whether the officer observed any additional signs of impairment.",
                "relevant_authorities": ["Terry v. Ohio, 392 U.S. 1 (1968)"],
            },
            {
                "issue": "Was the defendant's statement admissible without Miranda warnings?",
                "rule": "Miranda warnings are required before custodial interrogation.",
                "application": "The officer asked the defendant about drinking while defendant was stopped and detained.",
                "conclusion": "Likely inadmissible — defendant was in custody and not read Miranda rights.",
                "missing_information": "Whether the question was asked during a routine traffic stop or after formal arrest.",
                "relevant_authorities": ["Miranda v. Arizona, 384 U.S. 436 (1966)"],
            },
        ],
        "issues_by_area": {
            "Fourth Amendment": ["Did the officer have reasonable suspicion for the stop?"],
            "Fifth Amendment - Miranda": ["Was the defendant's statement admissible without Miranda warnings?"],
        },
        "practice_tips": "Remember to analyze each interaction separately. The stop and the questioning are distinct Fourth and Fifth Amendment issues.",
        "sources_consulted": ["Terry v. Ohio", "Miranda v. Arizona"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.issue_spotter.completion", return_value=mock_llm):
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "Officer Smith stopped a car that swerved twice. He asked the driver 'Have you been drinking?' without reading Miranda rights.",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert "overview" in data
    assert len(data["issues"]) == 2
    assert "issues_by_area" in data
    assert "Fourth Amendment" in data["issues_by_area"]
    assert "practice_tips" in data
    assert "sources" in data
    assert "disclaimer" in data
    assert len(data["sources"]) == 0


def test_issue_spotter_single_issue(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "overview": "This fact pattern raises a single contract formation issue.",
        "issues": [
            {
                "issue": "Was a valid contract formed between the parties?",
                "rule": "Contract formation requires offer, acceptance, and consideration.",
                "application": "Party A offered $500 for the painting, Party B accepted in writing.",
                "conclusion": "Likely yes — offer and acceptance are present.",
                "missing_information": "Whether consideration was adequate.",
                "relevant_authorities": ["Restatement (Second) of Contracts § 17"],
            },
        ],
        "issues_by_area": {
            "Contracts": ["Was a valid contract formed between the parties?"],
        },
        "practice_tips": "Always start with formation before analyzing breach or defenses.",
        "sources_consulted": ["Restatement (Second) of Contracts"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.issue_spotter.completion", return_value=mock_llm):
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "A offered to sell B a painting for $500. B said yes.",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["issues"]) == 1
    assert data["issues"][0]["issue"] == "Was a valid contract formed between the parties?"


def test_issue_spotter_without_auth_returns_401(client):
    resp = client.post("/api/legal/issue-spotter", json={
        "query": "A fact pattern about a contract dispute.",
    })
    assert resp.status_code == 401


def test_issue_spotter_empty_query_returns_400(client, auth_headers):
    resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
        "query": "",
    })
    assert resp.status_code == 400


def test_issue_spotter_llm_error_returns_friendly_message(client, auth_headers):
    from unittest.mock import MagicMock, patch

    with patch("app.services.issue_spotter.completion", side_effect=Exception("Insufficient credits")):
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "Some fact pattern.",
        })
    assert resp.status_code == 400
    data = resp.json()
    assert "credit" in data["detail"].lower() or "fund" in data["detail"].lower()


def test_issue_spotter_content_structure(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "overview": "Test overview.",
        "issues": [
            {
                "issue": "Test issue?",
                "rule": "Test rule.",
                "application": "Test application.",
                "conclusion": "Test conclusion.",
                "missing_information": "Test missing info.",
                "relevant_authorities": ["Test Authority"],
            },
        ],
        "issues_by_area": {
            "Test Area": ["Test issue?"],
        },
        "practice_tips": "Test tip.",
        "sources_consulted": ["Test source"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.issue_spotter.completion", return_value=mock_llm):
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "Test fact pattern.",
        })
    assert resp.status_code == 200
    data = resp.json()
    issue = data["issues"][0]
    assert issue["issue"] == "Test issue?"
    assert issue["rule"] == "Test rule."
    assert issue["application"] == "Test application."
    assert issue["conclusion"] == "Test conclusion."
    assert issue["missing_information"] == "Test missing info."
    assert len(issue["relevant_authorities"]) == 1
    assert issue["relevant_authorities"][0] == "Test Authority"
    assert "Test Area" in data["issues_by_area"]
    assert data["practice_tips"] == "Test tip."


def test_issue_spotter_retrieval_integration(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "overview": "Analysis with RAG context.",
        "issues": [
            {
                "issue": "Test issue?",
                "rule": "Test rule.",
                "application": "Test application.",
                "conclusion": "Test conclusion.",
                "missing_information": "None.",
                "relevant_authorities": [],
            },
        ],
        "issues_by_area": {"Test": ["Test issue?"]},
        "practice_tips": "Test.",
        "sources_consulted": ["Retrieved Source"],
    }
    mock_llm = MagicMock()
    mock_llm.choices = [MagicMock(message=MagicMock(content=json.dumps(valid)))]
    with patch("app.services.issue_spotter.completion", return_value=mock_llm):
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "A fact pattern with RAG context.",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["overview"] == "Analysis with RAG context."


def test_issue_spotter_retries_on_parse_failure(client, auth_headers):
    from unittest.mock import MagicMock, patch
    import json

    valid = {
        "overview": "Recovered after retry.",
        "issues": [
            {
                "issue": "Test issue?",
                "rule": "Test rule.",
                "application": "Test application.",
                "conclusion": "Test conclusion.",
                "missing_information": "None.",
                "relevant_authorities": [],
            },
        ],
        "issues_by_area": {"Test": ["Test issue?"]},
        "practice_tips": "Test.",
        "sources_consulted": ["Test source"],
    }

    def make_mock(content: str):
        mock_llm = MagicMock()
        mock_llm.choices = [MagicMock(message=MagicMock(content=content))]
        return mock_llm

    first_response = make_mock('{"overview": "This response is truncated mid-sentence')
    second_response = make_mock(json.dumps(valid))

    with patch("app.services.issue_spotter.completion", side_effect=[first_response, second_response]) as mock_completion:
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "A fact pattern that triggers a truncated response.",
        })
    assert resp.status_code == 200
    assert mock_completion.call_count == 2
    data = resp.json()
    assert data["overview"] == "Recovered after retry."


def test_issue_spotter_parse_failure_after_retry_returns_friendly_message(client, auth_headers):
    from unittest.mock import MagicMock, patch

    truncated = '{"overview": "Truncated response'

    def make_mock(content: str):
        mock_llm = MagicMock()
        mock_llm.choices = [MagicMock(message=MagicMock(content=content))]
        return mock_llm

    with patch("app.services.issue_spotter.completion", side_effect=[make_mock(truncated), make_mock(truncated)]) as mock_completion:
        resp = client.post("/api/legal/issue-spotter", headers=auth_headers, json={
            "query": "A fact pattern that keeps failing.",
        })
    assert resp.status_code == 400
    assert mock_completion.call_count == 2
    assert "incomplete" in resp.json()["detail"].lower()
