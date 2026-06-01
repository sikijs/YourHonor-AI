from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    title: str
    content: Optional[str] = None
    doc_type: Optional[str] = None

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doc_type: Optional[str] = None

class DocumentResponse(BaseModel):
    id: int
    user_id: int
    title: str
    content: Optional[str]
    doc_type: Optional[str]
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True