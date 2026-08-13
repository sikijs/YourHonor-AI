from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.stats import StatsResponse
from app.services import stats as stats_service
from app.services.auth import decode_token

router = APIRouter(prefix="/api/stats", tags=["stats"])


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


@router.get("/me", response_model=StatsResponse)
def get_my_stats(user_id: int = Depends(get_current_user_id)):
    try:
        return stats_service.get_user_stats(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")