"""Daily study-plan picks for the Dashboard's "Today's Legal Practice" section.

Everything here is deterministic and offline: content is seeded by the day of
the year into the app's curated libraries (85 landmark cases, 240 tutor cards,
123 glossary terms), so the endpoint is instant, free, and never calls an LLM.
The only per-user data is the suggested-focus topic from the review queue.
"""

import json
import random
from datetime import datetime
from pathlib import Path
from typing import Optional

from app import db
from app.models.dashboard import (
    CaseOfTheDay,
    CitationDrill,
    CitationDrillOption,
    DashboardTodayResponse,
    IssueAnswerResponse,
    IssuePromptOfTheDay,
    QuestionAnswerResponse,
    QuestionOfTheDay,
    SuggestedFocus,
    TermOfTheDay,
)
from app.services.bluebook import format_landmark_case
from app.services.doctrine_map import get_doctrine_map
from app.services.tutor_data import TOPICS

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "landmark_seed.json"
GLOSSARY_PATH = Path(__file__).resolve().parent.parent / "data" / "glossary_seed.json"


def _day_index(total: int) -> int:
    """Deterministic pick index for today: stable all day, rotates daily."""
    return (datetime.now().timetuple().tm_yday - 1) % max(total, 1)


def _day_seed() -> int:
    """Day-of-year number used to seed the deterministic quiz shuffles."""
    return datetime.now().timetuple().tm_yday


def _load_cases() -> list[dict]:
    if not SEED_PATH.exists():
        return []
    with open(SEED_PATH, encoding="utf-8") as f:
        return json.load(f)


def _load_glossary() -> list[dict]:
    if not GLOSSARY_PATH.exists():
        return []
    with open(GLOSSARY_PATH, encoding="utf-8") as f:
        return json.load(f)


def _flat_questions() -> list[dict]:
    """Flatten the topic question lists into one list of cards (240 total).

    Only the question text, topic, and difficulty are exposed — the curated
    card answers are hidden reference material and never leave the backend.
    """
    cards = []
    for topic_id, topic in TOPICS.items():
        for q in topic.get("questions", []):
            cards.append(
                {
                    "question": q.question,
                    "topic_id": topic_id,
                    "topic_name": topic["name"],
                    "difficulty": q.difficulty,
                }
            )
    return cards


def _today_card(include_hidden: bool = False) -> dict:
    """Today's deterministic tutor-card pick, shared by /today and /today/answer.

    With ``include_hidden`` the curated hint and answer are added — used only
    by the on-demand answer endpoint so the /today payload never leaks them.
    """
    cards = _flat_questions()
    card = cards[_day_index(len(cards))] if cards else {}
    if include_hidden and card:
        source = next(
            (
                q
                for q in TOPICS[card["topic_id"]].get("questions", [])
                if q.question == card["question"]
            ),
            None,
        )
        if source:
            card = {**card, "hint": source.hint or "", "answer": source.answer or ""}
    return card


def _issue_prompt(case: dict) -> IssuePromptOfTheDay:
    name = case.get("name", "the featured case")
    prompt = (
        f"In {name} the court answered one legal question. Write it as a single "
        "sentence: \u201cDoes [party] [action] violate [right or rule]?\u201d "
        "Not sure? Reveal the subject hint, then check your sentence against "
        "the court's own issue."
    )
    return IssuePromptOfTheDay(prompt=prompt, case_name=name)


def _case_doctrine_entries() -> dict[str, dict]:
    """Map each landmark case to its curated doctrine context.

    Built from the doctrine map (35 doctrines, 85 cases) so the issue card can
    offer a plain-language subject hint and the court's own issue and holding —
    zero LLM. First entry wins for the two cases that appear in more than one
    doctrine.
    """
    entries: dict[str, dict] = {}
    for doctrine in get_doctrine_map().get("doctrines", []):
        for case in doctrine.get("cases", []):
            name = case.get("name", "")
            if name and name not in entries:
                entries[name] = {
                    "subject": doctrine.get("subject", ""),
                    "doctrine_name": doctrine.get("name", ""),
                    "doctrine_description": doctrine.get("description", ""),
                    "issue": case.get("issue", ""),
                    "plain_holding": case.get("plain_holding", ""),
                    "holding": case.get("holding", ""),
                }
    return entries


def _build_distractors(name: str, citation: str, year: Optional[int]) -> list[CitationDrillOption]:
    """Deterministic Bluebook-error variants of the day's citation.

    Each distractor is built from the case's real data (no fabricated
    citations) and carries the Bluebook rule it violates. Templates that need
    a "v." separator are skipped for cases like Slaughter-House Cases.
    """
    pool: list[CitationDrillOption] = []
    if year:
        pool.append(
            CitationDrillOption(
                text=f"{name}, {citation}",
                is_correct=False,
                rule_note="Wrong — the decision year belongs in parentheses right after the citation (Rule 10.6).",
            )
        )
    if " v. " in name:
        left, right = name.rsplit(" v. ", 1)
        pool.append(
            CitationDrillOption(
                text=f"{left} vs. {right}, {citation} ({year})",
                is_correct=False,
                rule_note="Wrong — party names are joined by a lowercase 'v.' for versus, never 'vs.' (Rule 10.2.1).",
            )
        )
        pool.append(
            CitationDrillOption(
                text=f"{left} versus {right}, {citation} ({year})",
                is_correct=False,
                rule_note="Wrong — the Bluebook uses 'v.', not the word 'versus', between party names (Rule 10.2.1).",
            )
        )
        pool.append(
            CitationDrillOption(
                text=f"{left} V. {right}, {citation} ({year})",
                is_correct=False,
                rule_note="Wrong — 'v.' is written lowercase between party names (Rule 10.2.1).",
            )
        )
    if "." in citation:
        pool.append(
            CitationDrillOption(
                text=f"{name}, {citation.replace('.', '')} ({year})",
                is_correct=False,
                rule_note="Wrong — official reporter abbreviations keep their periods, e.g. U.S. Reports is 'U.S.' (Rule 10.3).",
            )
        )
    return pool


def _build_drill(case: dict) -> CitationDrill:
    """Build the day's citation quiz: 1 correct option + 3 deterministic distractors."""
    empty = CitationDrill(raw="", formatted="", case_name="", options=[])
    if not (case.get("citation") and case.get("name")):
        return empty
    entry = format_landmark_case(case["name"])
    if not entry:
        return empty

    correct = CitationDrillOption(
        text=entry.formatted,
        is_correct=True,
        rule_note=(
            "Correct — full case name, lowercase 'v.' (Rule 10.2.1), official reporter "
            "abbreviation with periods (Rule 10.3), and the decision year in parentheses (Rule 10.6)."
        ),
    )
    distractors = _build_distractors(case["name"], case.get("citation", ""), case.get("year"))
    rng = random.Random(_day_seed())
    chosen = rng.sample(distractors, k=min(3, len(distractors)))
    options = [correct] + chosen
    rng.shuffle(options)

    return CitationDrill(
        raw=case["citation"],
        formatted=entry.formatted,
        case_name=case["name"],
        year=case.get("year"),
        options=options,
    )


def _suggested_focus(user_id: int) -> Optional[SuggestedFocus]:
    conn = db.get_db()
    try:
        row = conn.execute(
            """
            SELECT topic_id, COUNT(*) AS count
            FROM review_progress
            WHERE user_id = ? AND got_it = 0
            GROUP BY topic_id
            ORDER BY count DESC
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    topic = TOPICS.get(row["topic_id"], {})
    return SuggestedFocus(
        topic_id=row["topic_id"],
        topic_name=topic.get("name", row["topic_id"]),
        weak_count=row["count"],
    )


def get_today(user_id: int) -> DashboardTodayResponse:
    cases = _load_cases()
    case = cases[_day_index(len(cases))] if cases else {}

    glossary = _load_glossary()
    term = glossary[_day_index(len(glossary))] if glossary else {}

    card = _today_card()

    drill = _build_drill(case)

    case_summary = _case_doctrine_entries().get(case.get("name", ""), {}).get("plain_holding", "")

    return DashboardTodayResponse(
        case_of_the_day=CaseOfTheDay(
            case_name=case.get("name", ""),
            citation=case.get("citation", ""),
            year=case.get("year"),
            date_filed=case.get("date_filed"),
            case_summary=case_summary,
        ),
        citation_drill=drill,
        term_of_the_day=TermOfTheDay(
            term=term.get("term", ""),
            definition=term.get("definition", ""),
            related_terms=term.get("related_terms", []) or [],
        ),
        question_of_the_day=QuestionOfTheDay(
            question=card.get("question", ""),
            topic_id=card.get("topic_id", ""),
            topic_name=card.get("topic_name", ""),
            difficulty=card.get("difficulty", 1),
        ),
        issue_prompt_of_the_day=_issue_prompt(case) if case else IssuePromptOfTheDay(prompt="", case_name=""),
        suggested_focus=_suggested_focus(user_id),
    )


def get_today_answer() -> QuestionAnswerResponse:
    """Hint + curated answer for today's Question of the Day (on demand).

    Served only by the explicit /api/dashboard/today/answer endpoint so the
    /today payload never ships the answer to the client upfront.
    """
    card = _today_card(include_hidden=True)
    return QuestionAnswerResponse(
        question=card.get("question", ""),
        topic_id=card.get("topic_id", ""),
        topic_name=card.get("topic_name", ""),
        difficulty=card.get("difficulty", 1),
        hint=card.get("hint", ""),
        answer=card.get("answer", ""),
    )


def get_today_issue_answer() -> IssueAnswerResponse:
    """Plain-language hint + curated issue and holding for today's Case of the Day.

    The hint pairs the doctrine subject/name with the doctrine's plain-English
    description; the reveal shows the court's issue (the question it answered)
    and the holding rewritten in beginner-friendly terms. Shares the same
    day-seeded case pick as /today, so the issue card can never drift from the
    featured case. Zero LLM.
    """
    cases = _load_cases()
    case = cases[_day_index(len(cases))] if cases else {}
    entry = _case_doctrine_entries().get(case.get("name", ""), {})
    return IssueAnswerResponse(
        case_name=case.get("name", ""),
        subject=entry.get("subject", ""),
        doctrine_name=entry.get("doctrine_name", ""),
        doctrine_description=entry.get("doctrine_description", ""),
        issue=entry.get("issue", ""),
        plain_holding=entry.get("plain_holding", ""),
        holding=entry.get("holding", ""),
    )