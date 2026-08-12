from typing import Literal
from pydantic import BaseModel, Field


class ExportRequest(BaseModel):
    content: str = Field(..., description="Markdown or HTML content to export")
    filename: str = Field(..., min_length=1, description="Base filename without extension")
    format: Literal["pdf", "docx", "md"] = "pdf"
    content_type: Literal["markdown", "html"] = "markdown"