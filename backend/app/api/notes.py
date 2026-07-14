from fastapi import APIRouter, HTTPException, Cookie, Depends
from typing import List, Optional
from fastapi.responses import PlainTextResponse
from app.db import get_db
from app.models.note import NoteCreate, NoteUpdate, NoteResponse
from app.services.auth import decode_token

router = APIRouter(prefix="/api/notes", tags=["notes"])

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

@router.get("", response_model=List[NoteResponse])
def list_notes(user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    notes = cursor.execute(
        "SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in notes]

@router.post("", response_model=NoteResponse)
def create_note(note: NoteCreate, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
        (user_id, note.title, note.content)
    )
    conn.commit()
    note_id = cursor.lastrowid
    new_note = cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    conn.close()
    return dict(new_note)

@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    note = cursor.execute(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user_id)
    ).fetchone()
    conn.close()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return dict(note)

@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, note_update: NoteUpdate, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user_id)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")

    update_values = note_update.model_dump(exclude_unset=True)
    if update_values:
        set_clause = ", ".join([f"{k} = ?" for k in update_values.keys()] + ["updated_at = CURRENT_TIMESTAMP"])
        values = list(update_values.values()) + [note_id, user_id]
        cursor.execute(
            f"UPDATE notes SET {set_clause} WHERE id = ? AND user_id = ?",
            values
        )
        conn.commit()

    updated_note = cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    conn.close()
    return dict(updated_note)

@router.delete("/{note_id}")
def delete_note(note_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user_id)
    ).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")

    cursor.execute("DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))
    conn.commit()
    conn.close()
    return {"message": "Note deleted"}

@router.get("/{note_id}/download")
def download_note(note_id: int, user_id: int = Depends(get_current_user_id)):
    conn = get_db()
    cursor = conn.cursor()
    note = cursor.execute(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user_id)
    ).fetchone()
    conn.close()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    content = f"# {note['title']}\n\n{note['content']}"
    filename = f"{note['title'].replace(' ', '_')}.md"
    return PlainTextResponse(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
