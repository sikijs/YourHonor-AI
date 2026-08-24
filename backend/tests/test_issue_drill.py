"""Issue-spotting drill tests.

The drill is stateless: one LLM call builds the fact pattern + hidden answer
key, a second grades the student's list into matched / missed / false
positives. These tests cover auth, validation, the two LLM paths (including
string-issue coercion), score clamping, and the friendly-error funnel.
"""

import json
from unittest.mock import MagicMock, patch


def _llm_json(payload: dict) -> MagicMock:
    resp = MagicMock()
    resp.choices = [MagicMock(message=MagicMock(content=json.dumps(payload)))]
    return resp


GENERATE_PAYLOAD = {
    "fact_pattern": "Dana sold Priya a used car, assuring her it had never been wrecked.",
    "embedded_issues": [
        {"issue": "Fraudulent misrepresentation", "rule": "A false statement of material fact made knowingly or recklessly.", "fact_trigger": "Dana knew the car was wrecked"},
        {"issue": "Implied warranty of merchantability", "rule": "UCC 2-314 requires goods to be fit for ordinary purposes.", "fact_trigger": "sale of goods by a dealer"},
    ],
    "key_concepts": ["Misrepresentation", "UCC warranties"],
}


# ------------------------------------------------------------ unit: coercion

def test_coerce_issue_accepts_strings():
    from app.services.issue_drill import _coerce_issue
    issue = _coerce_issue("Statute of Frauds problem")
    assert issue.issue == "Statute of Frauds problem"
    assert issue.rule == ""
    assert issue.fact_trigger == ""


def test_coerce_issue_passes_through_objects():
    from app.services.issue_drill import _coerce_issue
    issue = _coerce_issue({"issue": "Negligence", "rule": "Duty, breach, causation", "fact_trigger": "the spill"})
    assert issue.issue == "Negligence"
    assert issue.rule == "Duty, breach, causation"


# ------------------------------------------------------------ API: generate

def test_generate_without_auth_returns_401(client):
    resp = client.post("/api/tutor/drill/generate", json={"topic_id": "contracts"})
    assert resp.status_code == 401


def test_generate_unknown_topic_returns_400(client, auth_headers):
    resp = client.post("/api/tutor/drill/generate", json={"topic_id": "nope"}, cookies=auth_headers)
    assert resp.status_code == 400


def test_generate_happy_path(client, auth_headers):
    with patch("app.services.issue_drill.completion", return_value=_llm_json(GENERATE_PAYLOAD)):
        resp = client.post("/api/tutor/drill/generate", json={"topic_id": "contracts", "difficulty": 3}, cookies=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["fact_pattern"].startswith("Dana")
    assert len(body["embedded_issues"]) == 2
    assert body["embedded_issues"][0]["issue"] == "Fraudulent misrepresentation"
    assert body["embedded_issues"][0]["rule"] != ""
    assert body["suggested_minutes"] >= 3
    assert body["key_concepts"] == ["Misrepresentation", "UCC warranties"]


def test_generate_coerces_string_issues(client, auth_headers):
    payload = dict(GENERATE_PAYLOAD)
    payload["embedded_issues"] = ["Bare negligence claim", "Strict products liability"]
    with patch("app.services.issue_drill.completion", return_value=_llm_json(payload)):
        resp = client.post("/api/tutor/drill/generate", json={"topic_id": "contracts"}, cookies=auth_headers)
    assert resp.status_code == 200
    issues = resp.json()["embedded_issues"]
    assert issues[0]["issue"] == "Bare negligence claim"
    assert issues[0]["rule"] == ""


def test_generate_llm_failure_returns_friendly_error(client, auth_headers):
    with patch("app.services.issue_drill.completion", side_effect=RuntimeError("boom")):
        resp = client.post("/api/tutor/drill/generate", json={"topic_id": "contracts"}, cookies=auth_headers)
    assert resp.status_code == 400
    # The friendly-error funnel passes generic failures through as the detail.
    assert resp.json()["detail"] == "boom"


# ------------------------------------------------------------ API: submit

SUBMIT_BODY = {
    "topic_id": "contracts",
    "difficulty": 3,
    "fact_pattern": GENERATE_PAYLOAD["fact_pattern"],
    "embedded_issues": GENERATE_PAYLOAD["embedded_issues"],
    "student_issues": ["Something about misrepresentation", "A wild products liability claim"],
    "time_taken_sec": 240,
}

EVAL_PAYLOAD = {
    "matched": ["Fraudulent misrepresentation"],
    "missed": [{"issue": "Implied warranty of merchantability", "rule": "UCC 2-314", "fact_trigger": "dealer sale"}],
    "false_positives": ["A wild products liability claim"],
    "score_pct": 50,
    "feedback": "You caught the intentional tort but skimmed past the warranty facts.",
}


def test_submit_without_auth_returns_401(client):
    resp = client.post("/api/tutor/drill/submit", json=SUBMIT_BODY)
    assert resp.status_code == 401


def test_submit_happy_path(client, auth_headers):
    with patch("app.services.issue_drill.completion", return_value=_llm_json(EVAL_PAYLOAD)):
        resp = client.post("/api/tutor/drill/submit", json=SUBMIT_BODY, cookies=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["matched"] == ["Fraudulent misrepresentation"]
    assert len(body["missed"]) == 1
    assert body["missed"][0]["issue"] == "Implied warranty of merchantability"
    assert body["missed"][0]["rule"] == "UCC 2-314"
    assert body["false_positives"] == ["A wild products liability claim"]
    assert body["score_pct"] == 50
    assert "skimmed" in body["feedback"]
    assert "educational" in body["disclaimer"]


def test_submit_clamps_out_of_range_score(client, auth_headers):
    payload = dict(EVAL_PAYLOAD, score_pct=250)
    with patch("app.services.issue_drill.completion", return_value=_llm_json(payload)):
        resp = client.post("/api/tutor/drill/submit", json=SUBMIT_BODY, cookies=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["score_pct"] == 100


def test_submit_recomputes_score_when_llm_omits_it(client, auth_headers):
    payload = {k: v for k, v in EVAL_PAYLOAD.items() if k != "score_pct"}
    with patch("app.services.issue_drill.completion", return_value=_llm_json(payload)):
        resp = client.post("/api/tutor/drill/submit", json=SUBMIT_BODY, cookies=auth_headers)
    # 1 matched out of 2 embedded issues -> 50
    assert resp.json()["score_pct"] == 50
