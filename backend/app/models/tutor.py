from pydantic import BaseModel
from typing import Optional


class TutorQuestion(BaseModel):
    question: str
    hint: str
    expected_concepts: list[str]
    difficulty: int


class TutorStartRequest(BaseModel):
    topic_id: str


class TutorStartResponse(BaseModel):
    topic_id: str
    topic_name: str
    topic_description: str
    total_questions: int
    current_question: TutorQuestion
    current_index: int
    questions: list[TutorQuestion]


class TutorAnswerRequest(BaseModel):
    answer: str


class GeneratedEvaluation(BaseModel):
    evaluation: str
    explanation: str
    follow_up_question: Optional[str] = None
    follow_up_hint: Optional[str] = None
    is_complete: bool


class GeneratedQuestion(BaseModel):
    question: str
    hint: str
    expected_concepts: list[str]
    difficulty: int


class TutorAnswerResponse(BaseModel):
    evaluation: str
    explanation: str
    follow_up_question: Optional[TutorQuestion] = None
    current_index: int
    total_questions: int
    is_complete: bool
    correct_count: int
    wrong_count: int
    attempts_exceeded: bool = False
    correct_answer_revealed: Optional[str] = None
    disclaimer: str = (
        "This tutoring session is for educational purposes only. "
        "It should not be relied upon as legal advice."
    )


class HypotheticalGenerateRequest(BaseModel):
    topic_id: str
    difficulty: int = 3


class HypotheticalGenerateResponse(BaseModel):
    fact_pattern: str
    issues: list[str] = []
    model_answer: str
    key_concepts: list[str] = []


class HypotheticalEvaluateRequest(BaseModel):
    topic_id: str
    difficulty: int
    fact_pattern: str
    student_answer: str


class HypotheticalEvaluateResponse(BaseModel):
    issues_identified: list[str]
    issues_missed: list[str]
    rule_accuracy: str
    application_quality: str
    overall_score: int
    feedback: str
    model_answer: str
    disclaimer: str = (
        "This evaluation is for educational purposes only. "
        "It should not be relied upon as legal advice."
    )
