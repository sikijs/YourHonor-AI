from typing import Optional

from pydantic import BaseModel, Field


class DocTypeCount(BaseModel):
    doc_type: str
    count: int


class WeakTopic(BaseModel):
    topic_id: str
    topic_name: str
    weak_count: int


class TutorReviewStats(BaseModel):
    total_reviewed: int
    mastered: int
    weak: int
    weak_topics: list[WeakTopic] = []


class TutorSessionTopic(BaseModel):
    topic_id: str
    topic_name: str
    sessions: int
    correct: int
    wrong: int
    accuracy: float


class TutorSessionStats(BaseModel):
    total_sessions: int
    total_answers: int
    accuracy: float
    per_topic: list[TutorSessionTopic] = []


class SkillStat(BaseModel):
    skill_id: str
    name: str
    description: str
    count: int


class PortfolioItem(BaseModel):
    id: int
    title: str
    doc_type: Optional[str] = None
    updated_at: Optional[str] = None


class StatsResponse(BaseModel):
    documents_total: int
    documents_by_type: list[DocTypeCount] = []
    notes_total: int
    tutor_review: TutorReviewStats
    tutor_sessions: TutorSessionStats = Field(default_factory=TutorSessionStats)
    skills: list[SkillStat] = []
    portfolio: list[PortfolioItem] = []