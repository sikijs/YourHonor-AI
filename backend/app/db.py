import sqlite3
import os
from pathlib import Path

DATABASE_PATH = Path(__file__).parent.parent / "data" / "yourhonor.db"

def get_db():
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            doc_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS opinions_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_key TEXT UNIQUE NOT NULL,
            case_name TEXT NOT NULL,
            court TEXT,
            date_filed TEXT,
            citations TEXT,
            opinion_text TEXT,
            qdrant_ingested INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    try:
        cursor.execute("ALTER TABLE opinions_cache ADD COLUMN qdrant_ingested INTEGER DEFAULT 0")
    except Exception:
        pass

    for col in ["file_path", "original_filename", "file_type", "mime_type"]:
        try:
            cursor.execute(f"ALTER TABLE documents ADD COLUMN {col} TEXT")
        except Exception:
            pass
    try:
        cursor.execute("ALTER TABLE documents ADD COLUMN file_size INTEGER")
    except Exception:
        pass

    conn.commit()
    conn.close()

init_db()