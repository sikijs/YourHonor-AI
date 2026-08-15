from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.dashboard import DashboardTodayResponse
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