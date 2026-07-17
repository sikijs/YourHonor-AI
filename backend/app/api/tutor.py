from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.tutor import (
    TutorStartRequest, TutorStartResponse, TutorAnswerRequest, TutorAnswerResponse, TutorQuestion,
    HypotheticalGenerateRequest, HypotheticalGenerateResponse,
    HypotheticalEvaluateRequest, HypotheticalEvaluateResponse,
)
from app.services.auth import decode_token
from app.services.tutor import get_tutor_service
from pydantic import BaseModel


class ContinueLearningResponse(BaseModel):
    question: TutorQuestion
    disclaimer: str = (
        "This will use an AI API call (approx. $0.02-0.04). "
        "The question is generated dynamically and is for educational purposes only."
    )

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
