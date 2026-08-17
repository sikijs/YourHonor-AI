from typing import Optional

from pydantic import BaseModel


class CaseOfTheDay(BaseModel):
    case_name: str
    citation: str
    year: Optional[int] = None
    date_filed: Optional[str] = None
    case_summary: str = ""


class CitationDrillOption(BaseModel):
    text: str
    is_correct: bool
    rule_note: str


class CitationDrill(BaseModel):
    raw: str
    formatted: str
    case_name: str
    year: Optional[int] = None
    options: list[CitationDrillOption] = []


class TermOfTheDay(BaseModel):
    term: str
    definition: str
    related_terms: list[str] = []


class QuestionOfTheDay(BaseModel):
    question: str
    topic_id: str
    topic_name: str
    difficulty: int


class QuestionAnswerResponse(BaseModel):
    question: str
    topic_id: str
    topic_name: str
    difficulty: int
    hint: str
    answer: str


class IssuePromptOfTheDay(BaseModel):
    prompt: str
    case_name: str


class IssueAnswerResponse(BaseModel):
    case_name: str
    subject: str
    doctrine_name: str
    doctrine_description: str = ""
    issue: str = ""
    plain_holding: str = ""
    holding: str = ""


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