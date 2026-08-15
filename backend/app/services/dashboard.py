"""Daily study-plan picks for the Dashboard's "Today's Legal Practice" section.

Everything here is deterministic and offline: content is seeded by the day of
the year into the app's curated libraries (70 landmark cases, 160 tutor cards,
123 glossary terms), so the endpoint is instant, free, and never calls an LLM.
The only per-user data is the suggested-focus topic from the review queue.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from app import db
from app.models.dashboard import (
    CaseOfTheDay,
    CitationDrill,
    DashboardTodayResponse,
    IssuePromptOfTheDay,
    QuestionOfTheDay,
    SuggestedFocus,
    TermOfTheDay,
)
from app.services.bluebook import format_landmark_case
from app.services.tutor_data import TOPICS

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "landmark_seed.json"
GLOSSARY_PATH = Path(__file__).resolve().parent.parent / "data" / "glossary_seed.json"


def _day_index(total: int) -> int:
    """Deterministic pick index for today: stable all day, rotates daily."""
    return (datetime.now().timetuple().tm_yday - 1) % max(total, 1)


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
    """Flatten the topic question lists into one list of cards (160 total).

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


def _issue_prompt(case: dict) -> IssuePromptOfTheDay:
    name = case.get("name", "the featured case")
    prompt = (
        f"Before reading the holding in {name}, write down the legal issues the "
        "court had to resolve. State each issue as a single IRAC-style question, "
        "then check your list against the case's doctrine in the Doctrine Explorer."
    )
    return IssuePromptOfTheDay(prompt=prompt, case_name=name)


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

    cards = _flat_questions()
    card = cards[_day_index(len(cards))] if cards else {}

    drill = CitationDrill(raw="", formatted="", case_name="", notes="")
    if case.get("citation") and case.get("name"):
        entry = format_landmark_case(case["name"])
        if entry:
            drill = CitationDrill(
                raw=case["citation"],
                formatted=entry.formatted,
                case_name=case["name"],
                year=case.get("year"),
                rules_applied=entry.rules_applied,
                notes=entry.notes,
            )

    return DashboardTodayResponse(
        case_of_the_day=CaseOfTheDay(
            case_name=case.get("name", ""),
            citation=case.get("citation", ""),
            year=case.get("year"),
            date_filed=case.get("date_filed"),
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