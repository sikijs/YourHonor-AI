from pydantic import BaseModel
from typing import Optional


class TutorQuestion(BaseModel):
    question: str
    hint: str
    expected_concepts: list[str]
    difficulty: int
    deep_hint: Optional[str] = None
    answer: Optional[str] = None


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
    follow_up_answer: Optional[str] = None
    is_complete: bool
    missed_concepts: list[str] = []


class GeneratedQuestion(BaseModel):
    question: str
    hint: str
    deep_hint: Optional[str] = None
    expected_concepts: list[str]
    difficulty: int
    answer: Optional[str] = None


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
    attempts_used: int = 0
    max_attempts: int = 3
    missed_concepts: list[str] = []
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


class MCQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str
    option_explanations: list[str]
    difficulty: int


class MCStartRequest(BaseModel):
    topic_id: str
    difficulty: int = 3


class MCStartResponse(BaseModel):
    topic_id: str
    topic_name: str
    difficulty: int
    total_questions: int = 5
    question: MCQuestion


class MCAnswerRequest(BaseModel):
    selected_index: int


class MCAnswerResponse(BaseModel):
    correct: bool
    correct_index: int
    explanation: str
    option_explanations: list[str]
    next_question: Optional[MCQuestion] = None
    score: int
    total: int
    is_complete: bool
    disclaimer: str = (
        "This quiz is for educational purposes only. "
        "It should not be relied upon as legal advice."
    )
