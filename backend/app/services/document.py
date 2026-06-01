import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from app.db import get_db

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024


class FileStorageService:
    def __init__(self, upload_dir: Optional[str] = None):
        if upload_dir:
            self.upload_dir = Path(upload_dir)
        else:
            self.upload_dir = Path(
                os.environ.get(
                    "UPLOAD_DIR",
                    str(Path(__file__).parent.parent / "uploads"),
                )
            )

    def ensure_dir(self):
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, file: UploadFile, user_id: int) -> dict:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        user_dir = self.upload_dir / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = user_dir / unique_name

        content = file.file.read()
        if len(content) > MAX_FILE_SIZE:
            raise ValueError(
                f"File too large. Max size: {MAX_FILE_SIZE // (1024 * 1024)} MB"
            )

        file_path.write_bytes(content)

        return {
            "file_path": str(file_path),
            "original_filename": file.filename,
            "file_size": len(content),
            "file_type": ext,
            "mime_type": file.content_type or "application/pdf",
        }

    def delete_file(self, file_path: str):
        path = Path(file_path)
        if path.exists():
            path.unlink()


file_storage = FileStorageService()


def get_file_storage() -> FileStorageService:
    return file_storage


def load_user_document_content(doc_id: int, user_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    doc = cursor.execute(
        "SELECT id, title, content FROM documents WHERE id = ? AND user_id = ?",
        (doc_id, user_id),
    ).fetchone()
    conn.close()
    if not doc:
        return None
    return {
        "id": doc["id"],
        "title": doc["title"] or f"Document {doc_id}",
        "content": doc["content"] or "",
    }
