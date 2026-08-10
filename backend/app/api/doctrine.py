from fastapi import APIRouter

from app.models.doctrine import DoctrineMapResponse
from app.services.doctrine_map import get_doctrine_map

router = APIRouter(prefix="/api/doctrine", tags=["doctrine"])


@router.get("/map", response_model=DoctrineMapResponse)
def get_map():
    """Return the curated doctrine map (doctrines -> landmark cases).

    Public and static: no auth and no LLM involved, mirroring the
    template catalog endpoint.
    """
    data = get_doctrine_map()
    return DoctrineMapResponse(**data)
