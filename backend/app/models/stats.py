from pydantic import BaseModel


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


class StatsResponse(BaseModel):
    account_age_days: int
    documents_total: int
    documents_by_type: list[DocTypeCount] = []
    notes_total: int
    tutor_review: TutorReviewStats