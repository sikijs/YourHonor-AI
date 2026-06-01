from app.db import get_db


def save_document(user_id: int, title: str, content: str, doc_type: str) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (user_id, title, content, doc_type) VALUES (?, ?, ?, ?)",
        (user_id, title, content, doc_type),
    )
    conn.commit()
    doc_id = cursor.lastrowid
    conn.close()
    return doc_id
