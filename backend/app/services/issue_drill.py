"""Issue-spotting drill: timed breadth practice over one fact pattern.

Complements the deep single-issue IRAC Practice mode. The drill generates a
fact pattern hiding several legal issues, the student races a countdown
timer to list every issue they spot, and a second LLM pass grades the list
into three honest buckets:

- matched        — issues the student correctly spotted
- missed         — embedded issues they did not spot (with the rule statement)
- false_positives — issues claimed that the pattern does not actually raise

Stateless like the hypothetical Practice flow: the client holds the pattern,
the embedded answer key, and its own timer, and sends everything back on
submit. Two LLM calls per drill (generate + grade).
"""

import logging

from litellm import completion

from app.models.tutor import DrillSubmitResponse, EmbeddedIssue
from app.services.llm_errors import friendly_llm_error
from app.services.retrieval import parse_llm_json
from app.services.tutor_data import TOPICS

logger = logging.getLogger(__name__)

MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

# Issues hidden in the pattern by difficulty: d1 -> 2 ... d5 -> 6.
ISSUES_BY_DIFFICULTY = {1: 2, 2: 3, 3: 4, 4: 5, 5: 6}

# Countdown length in minutes; harder drills embed more issues and get more time.
MINUTES_BY_DIFFICULTY = {1: 4, 2: 5, 3: 6, 4: 8, 5: 10}


def _completion_call(system: str, prompt: str, schema: dict, max_tokens: int, temperature: float) -> dict:
    response = completion(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object", "schema": schema},
        extra_body=EXTRA_BODY,
        max_tokens=max_tokens,
        temperature=temperature,
        reasoning_effort="low",
        drop_params=True,
        timeout=180,
    )
    raw = response.choices[0].message.content
    if raw is None:
        raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
    return parse_llm_json(raw)


def _coerce_issue(entry) -> EmbeddedIssue:
    """Accept both {"issue": ...} objects and bare strings from the LLM."""
    if isinstance(entry, dict):
        return EmbeddedIssue(
            issue=str(entry.get("issue", "")).strip(),
            rule=str(entry.get("rule", "")).strip(),
            fact_trigger=str(entry.get("fact_trigger", "")).strip(),
        )
    return EmbeddedIssue(issue=str(entry).strip())


def generate_drill(topic_id: str, difficulty: int) -> dict:
    """LLM call #1 — build the fact pattern and its hidden answer key."""
    if topic_id not in TOPICS:
        raise ValueError(f"Unknown topic: {topic_id}")
    topic_name = TOPICS[topic_id]["name"]
    issue_count = ISSUES_BY_DIFFICULTY.get(difficulty, 4)

    prompt = f"""You are a law professor creating an issue-spotting drill for law students studying {topic_name}.

Generate ONE realistic hypothetical fact pattern at difficulty {difficulty}/5 that quietly raises exactly {issue_count} distinct legal issues.

Rules for the fact pattern:
- 2-4 paragraphs of narrative facts (parties, events, communications, timing).
- Every issue must be discoverable from facts explicitly stated in the pattern. Do NOT rely on missing-information traps.
- Spread the issues across the narrative; do not cluster them in one paragraph.
- Match the selected difficulty: lower difficulties raise clear-cut issues; higher ones add nuance (mixed facts, close calls within the same doctrine).

Return valid JSON with these exact keys:
- "fact_pattern": the hypothetical scenario (2-4 paragraphs)
- "embedded_issues": a list of exactly {issue_count} objects, each with keys:
    - "issue": the legal issue in one sentence (as an exam model answer would phrase it)
    - "rule": the governing rule or test in 1-2 sentences
    - "fact_trigger": which stated facts raise this issue
- "key_concepts": a list of the doctrines being tested"""

    schema = {
        "type": "object",
        "properties": {
            "fact_pattern": {"type": "string"},
            "embedded_issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "issue": {"type": "string"},
                        "rule": {"type": "string"},
                        "fact_trigger": {"type": "string"},
                    },
                    "required": ["issue", "rule", "fact_trigger"],
                },
            },
            "key_concepts": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["fact_pattern", "embedded_issues", "key_concepts"],
    }

    try:
        parsed = _completion_call(
            "You generate law school issue-spotting drill fact patterns in JSON format.",
            prompt, schema, max_tokens=2500, temperature=0.7,
        )
    except Exception as e:
        logger.error(f"Drill generation failed: {e}")
        raise ValueError(friendly_llm_error(e))

    issues = [_coerce_issue(i) for i in parsed.get("embedded_issues", [])]
    issues = [i for i in issues if i.issue][:issue_count + 2]  # tolerate mild overshoot
    return {
        "fact_pattern": str(parsed.get("fact_pattern", "")).strip(),
        "embedded_issues": [i.model_dump() for i in issues],
        "key_concepts": [str(k) for k in parsed.get("key_concepts", [])],
        "suggested_minutes": MINUTES_BY_DIFFICULTY.get(difficulty, 6),
    }


def evaluate_drill(
    topic_id: str,
    fact_pattern: str,
    embedded_issues: list[EmbeddedIssue],
    student_issues: list[str],
) -> DrillSubmitResponse:
    """LLM call #2 — strict three-bucket grading of the student's list."""
    topic_name = TOPICS.get(topic_id, {}).get("name", topic_id)
    key_block = "\n".join(
        f"{idx}. ISSUE: {i.issue}\n   RULE: {i.rule}" + (f"\n   TRIGGER: {i.fact_trigger}" if i.fact_trigger else "")
        for idx, i in enumerate(embedded_issues, 1)
    ) or "(no answer key provided)"
    student_block = "\n".join(f"- {s}" for s in student_issues) or "(the student listed nothing)"

    prompt = f"""You are a law professor grading a timed issue-spotting drill in {topic_name}.

The fact pattern (shown to the student):
{fact_pattern}

The professor's answer key (hidden from the student until now):
{key_block}

The student listed these issues under time pressure:
{student_block}

Grade strictly but fairly:
- "matched": issues from the key the student genuinely identified (allow different wording; the substance must be there).
- "missed": issues from the key the student did not identify or only vaguely gestured at.
- "false_positives": items the student listed that the fact pattern does not actually raise. Judge against the stated facts ONLY — an issue that is real law but not triggered here counts as a false positive.
- "score_pct": integer 0-100 computed as matched / total issues in the key * 100, rounded.
- "feedback": 2-4 sentences of coaching: what they caught well, what kind of facts they tend to skim past, and one concrete reading-up suggestion.

Return valid JSON with these exact keys:
- "matched": list of strings (use the key's phrasing)
- "missed": list of objects with keys "issue", "rule", "fact_trigger"
- "false_positives": list of strings
- "score_pct": integer
- "feedback": string"""

    schema = {
        "type": "object",
        "properties": {
            "matched": {"type": "array", "items": {"type": "string"}},
            "missed": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "issue": {"type": "string"},
                        "rule": {"type": "string"},
                        "fact_trigger": {"type": "string"},
                    },
                    "required": ["issue"],
                },
            },
            "false_positives": {"type": "array", "items": {"type": "string"}},
            "score_pct": {"type": "integer"},
            "feedback": {"type": "string"},
        },
        "required": ["matched", "missed", "false_positives", "score_pct", "feedback"],
    }

    try:
        parsed = _completion_call(
            "You are a law professor grading student issue-spotting drill submissions in JSON format.",
            prompt, schema, max_tokens=2000, temperature=0.3,
        )
    except Exception as e:
        logger.error(f"Drill evaluation failed: {e}")
        raise ValueError(friendly_llm_error(e))

    score = parsed.get("score_pct")
    try:
        score = max(0, min(100, int(score)))
    except (TypeError, ValueError):
        total = len(embedded_issues)
        score = round(100 * len(parsed.get("matched", [])) / total) if total else 0

    missed = [_coerce_issue(i) for i in parsed.get("missed", []) if _coerce_issue(i).issue]
    matched = [str(m) for m in parsed.get("matched", [])]
    false_positives = [str(f) for f in parsed.get("false_positives", [])]

    return DrillSubmitResponse(
        matched=matched,
        missed=[m for m in missed],
        false_positives=false_positives,
        score_pct=score,
        feedback=str(parsed.get("feedback", "")).strip(),
    )
