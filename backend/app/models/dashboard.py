from typing import Optional

from pydantic import BaseModel


class CaseOfTheDay(BaseModel):
    case_name: str
    citation: str
    year: Optional[int] = None
    date_filed: Optional[str] = None


class CitationDrill(BaseModel):
    raw: str
    formatted: str
    case_name: str
    year: Optional[int] = None
    rules_applied: list[str] = []
    notes: str = ""


class TermOfTheDay(BaseModel):
    term: str
    definition: str
    related_terms: list[str] = []


class QuestionOfTheDay(BaseModel):
    question: str
    topic_id: str
    topic_name: str
    difficulty: int


class IssuePromptOfTheDay(BaseModel):
    prompt: str
    case_name: str


class SuggestedFocus(BaseModel):
    topic_id: str
    topic_name: str
    weak_count: int


class DashboardTodayResponse(BaseModel):
    case_of_the_day: CaseOfTheDay
    citation_drill: CitationDrill
    term_of_the_day: TermOfTheDay
    question_of_the_day: QuestionOfTheDay
    issue_prompt_of_the_day: IssuePromptOfTheDay
    suggested_focus: Optional[SuggestedFocus] = None