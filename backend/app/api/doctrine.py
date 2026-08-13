from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException

from app.models.doctrine import DoctrineMapResponse
from app.models.compare import CaseCompareRequest, CaseCompareResponse
from app.services.auth import decode_token
from app.services.doctrine_map import get_doctrine_map
from app.services.compare import get_case_compare_service

router = APIRouter(prefix="/api/doctrine", tags=["doctrine"])


def get_current_user_id(access_token: Optional[str] = Cookie(None)) -> int:
    """Auth dependency for LLM-backed doctrine endpoints (the map itself is public)."""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(user_id)


@router.get("/map", response_model=DoctrineMapResponse)
def get_map():
    """Return the curated doctrine map (doctrines -> landmark cases).

    Public and static: no auth and no LLM involved, mirroring the
    template catalog endpoint.
    """
    data = get_doctrine_map()
    return DoctrineMapResponse(**data)


@router.post("/compare", response_model=CaseCompareResponse)
def compare_cases(
    request: CaseCompareRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Compare two landmark cases: curated facts + LLM narrative comparison."""
    try:
        service = get_case_compare_service()
        return service.compare(request, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")