from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.dashboard import (
    CitationDrill,
    DashboardTodayResponse,
    IssueAnswerResponse,
    IssuePromptOfTheDay,
    QuestionAnswerResponse,
)
from app.services import dashboard as dashboard_service
from app.services.auth import decode_token

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


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


@router.get("/today", response_model=DashboardTodayResponse)
def get_today(user_id: int = Depends(get_current_user_id)):
    try:
        return dashboard_service.get_today(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/citation-drill", response_model=CitationDrill)
def get_citation_drill(user_id: int = Depends(get_current_user_id)):
    """Today's Bluebook quiz for the Citations view's Daily Drill tab."""
    try:
        return dashboard_service.get_citation_drill()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/issue-prompt", response_model=IssuePromptOfTheDay)
def get_issue_prompt(user_id: int = Depends(get_current_user_id)):
    """Today's issue-spotting warm-up prompt for the Issue Spotter view."""
    try:
        return dashboard_service.get_issue_prompt()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/today/answer", response_model=QuestionAnswerResponse)
def get_today_answer(user_id: int = Depends(get_current_user_id)):
    try:
        return dashboard_service.get_today_answer()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/today/issue-answer", response_model=IssueAnswerResponse)
def get_today_issue_answer(user_id: int = Depends(get_current_user_id)):
    try:
        return dashboard_service.get_today_issue_answer()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")