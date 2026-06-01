from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.debate import DebateRequest, DebateResponse
from app.services.auth import decode_token
from app.services.debate import get_debate_service

router = APIRouter(prefix="/api/legal", tags=["legal"])


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


@router.post("/debate", response_model=DebateResponse)
def analyze_debate(
    request: DebateRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_debate_service()
        result = service.analyze(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
