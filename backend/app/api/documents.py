import logging
from fastapi import APIRouter, HTTPException, Cookie, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
from app.db import get_db
from app.models.document import DocumentCreate, DocumentUpdate, DocumentResponse
from app.services.auth import decode_token
from app.services.document import file_storage, MAX_FILE_SIZE
from app.services.ingestion import get_ingestion_service

class BatchDeleteRequest(BaseModel):
    ids: list[int]

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

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

@router.get("", response_model=List[DocumentResponse])
def list_documents(user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    docs = cursor.execute(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in docs]

@router.post("", response_model=DocumentResponse)
def create_document(doc: DocumentCreate, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (user_id, title, content, doc_type) VALUES (?, ?, ?, ?)",
        (user_id, doc.title, doc.content, doc.doc_type)
    )
    conn.commit()
    doc_id = cursor.lastrowid
    new_doc = cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(new_doc)

@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    doc_type: Optional[str] = Form(None),
    user_id: int = Depends(get_current_user_id),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail=f"Only PDF files are allowed")

    file_info = file_storage.save_upload(file, user_id)
    doc_title = title or Path(file_info["original_filename"]).stem

    ingestion = get_ingestion_service()
    content = ingestion.load_pdf(file_info["file_path"])
    if content is None:
        file_storage.delete_file(file_info["file_path"])
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")
    if len(content.strip()) < 100:
        file_storage.delete_file(file_info["file_path"])
        raise HTTPException(
            status_code=400,
            detail="This PDF appears to be a scanned document (no readable text found). "
                   "OCR support is not yet available — please upload a text-based PDF.",
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO documents (user_id, title, content, doc_type, file_path, original_filename, file_size, file_type, mime_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            user_id, doc_title, content, doc_type,
            file_info["file_path"], file_info["original_filename"],
            file_info["file_size"], file_info["file_type"], file_info["mime_type"],
        ),
    )
    conn.commit()
    doc_id = cursor.lastrowid
    doc = cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(doc)

@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    doc = cursor.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?",
        (doc_id, user_id)
    ).fetchone()
    conn.close()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return dict(doc)

@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: int, doc_update: DocumentUpdate, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?",
        (doc_id, user_id)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    update_values = doc_update.model_dump(exclude_unset=True)
    if update_values:
        set_clause = ", ".join([f"{k} = ?" for k in update_values.keys()] + ["updated_at = CURRENT_TIMESTAMP"])
        values = list(update_values.values()) + [doc_id, user_id]
        cursor.execute(
            f"UPDATE documents SET {set_clause} WHERE id = ? AND user_id = ?",
            values
        )
        conn.commit()

    updated_doc = cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(updated_doc)

@router.delete("/batch")
def delete_documents_batch(request: BatchDeleteRequest, user_id: int = Depends(get_current_user_id)):
    if not request.ids:
        raise HTTPException(status_code=400, detail="No document IDs provided")

    conn = get_db()
    cursor = conn.cursor()
    deleted_count = 0

    for doc_id in request.ids:
        existing = cursor.execute(
            "SELECT * FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id)
        ).fetchone()
        if not existing:
            continue

        if existing["file_path"]:
            try:
                file_storage.delete_file(existing["file_path"])
            except Exception as e:
                logger.warning(f"Failed to delete file {existing['file_path']}: {e}")

        cursor.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
        deleted_count += 1

    conn.commit()
    conn.close()

    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="No matching documents found")

    return {"message": f"{deleted_count} document(s) deleted", "deleted_count": deleted_count}

@router.delete("/{doc_id}")
def delete_document(doc_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?",
        (doc_id, user_id)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    if existing["file_path"]:
        try:
            file_storage.delete_file(existing["file_path"])
        except Exception as e:
            logger.warning(f"Failed to delete file {existing['file_path']}: {e}")

    cursor.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
    conn.commit()
    conn.close()
    return {"message": "Document deleted"}