from fastapi import APIRouter
from app.models.template import CatalogResponse
from app.services.template_catalog import get_template_catalog

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=CatalogResponse)
def list_templates():
    catalog = get_template_catalog()
    templates = catalog.get_catalog()
    return CatalogResponse(templates=templates, total=len(templates))
