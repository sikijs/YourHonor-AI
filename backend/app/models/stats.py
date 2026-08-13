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


class StatsResponse(BaseModel):
    account_age_days: int
    documents_total: int
    documents_by_type: list[DocTypeCount] = []
    notes_total: int
    tutor_review: TutorReviewStats
    tutor_sessions: TutorSessionStats = Field(default_factory=TutorSessionStats)