from pydantic import BaseModel
from typing import Optional


class TemplateField(BaseModel):
    name: str
    category: str
    placeholder: str
    hint: str = ""


class CatalogTemplate(BaseModel):
    name: str
    description: str
    filename: str
    fields: list[TemplateField]
    cover_page_fields: Optional[list[TemplateField]] = None


class CatalogResponse(BaseModel):
    templates: list[CatalogTemplate]
    total: int
