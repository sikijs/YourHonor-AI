from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.tutor import (
    TutorStartRequest, TutorStartResponse, TutorAnswerRequest, TutorAnswerResponse, TutorQuestion,
    HypotheticalGenerateRequest, HypotheticalGenerateResponse,
    HypotheticalEvaluateRequest, HypotheticalEvaluateResponse,
    MCStartRequest, MCStartResponse, MCAnswerRequest, MCAnswerResponse,
)
from app.models.legal_glossary import CurriculumCard
from app.services.auth import decode_token
from app.services.tutor import get_tutor_service
from pydantic import BaseModel


class ContinueLearningResponse(BaseModel):
    question: TutorQuestion
    disclaimer: str = (
        "This will use an AI API call (approx. $0.02-0.04). "
        "The question is generated dynamically and is for educational purposes only."
    )


class RelatedConceptsRequest(BaseModel):
    question: str
    exclude_topic: Optional[str] = None
    top_k: int = 4


class RelatedConceptsResponse(BaseModel):
    cards: list[CurriculumCard]
    disclaimer: str = (
        "Related cards are surfaced from the AI Tutor curriculum for "
        "educational purposes only. They should not be relied upon as legal advice."
    )


class ReviewMarkRequest(BaseModel):
    question: str
    topic_id: str
    got_it: bool


class ReviewQueueResponse(BaseModel):
    cards: list[CurriculumCard]
    total: int

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


def get_current_user_id(access_token: Optional[str] = Cookie(None)) -> int:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(user_id)


@router.get("/topics")
def list_topics():
    service = get_tutor_service()
    return {"topics": service.get_topics()}


@router.post("/start", response_model=TutorStartResponse)
def start_session(
    request: TutorStartRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        return service.start_session(request.topic_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/start-dynamic", response_model=TutorStartResponse)
def start_dynamic_session(
    request: TutorStartRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        return service.start_dynamic_session(request.topic_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/answer", response_model=TutorAnswerResponse)
def submit_answer(
    request: TutorAnswerRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        return service.submit_answer(request.answer, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/hypothetical/generate", response_model=HypotheticalGenerateResponse)
def generate_hypothetical(
    request: HypotheticalGenerateRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        result = service.generate_hypothetical(request.topic_id, request.difficulty)
        return HypotheticalGenerateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/hypothetical/evaluate", response_model=HypotheticalEvaluateResponse)
def evaluate_hypothetical(
    request: HypotheticalEvaluateRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        result = service.evaluate_hypothetical(
            request.topic_id, request.difficulty,
            request.fact_pattern, request.student_answer,
        )
        return HypotheticalEvaluateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/continue-learning", response_model=ContinueLearningResponse)
def continue_learning(
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        question = service.continue_learning(user_id)
        return ContinueLearningResponse(question=question)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/mc/start", response_model=MCStartResponse)
def start_mc_quiz(
    request: MCStartRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        return service.start_mc_quiz(request.topic_id, request.difficulty, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/mc/answer", response_model=MCAnswerResponse)
def submit_mc_answer(
    request: MCAnswerRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        return service.submit_mc_answer(request.selected_index, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/related", response_model=RelatedConceptsResponse)
def related_concepts(
    request: RelatedConceptsRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        cards = service.get_related_concepts(
            request.question, request.exclude_topic, request.top_k
        )
        return RelatedConceptsResponse(cards=cards)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/review/mark")
def mark_review(
    request: ReviewMarkRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_tutor_service()
        return service.mark_review(user_id, request.question, request.topic_id, request.got_it)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/review/queue", response_model=ReviewQueueResponse)
def review_queue(
    user_id: int = Depends(get_current_user_id),
    difficulty: Optional[int] = None,
):
    try:
        service = get_tutor_service()
        cards = service.get_review_queue(user_id, difficulty=difficulty)
        return ReviewQueueResponse(cards=cards, total=len(cards))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
