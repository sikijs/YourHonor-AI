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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT 'Untitled Note',
            content TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS review_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            topic_id TEXT NOT NULL,
            question TEXT NOT NULL,
            got_it INTEGER NOT NULL,
            box_level INTEGER DEFAULT 1,
            next_due TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, topic_id, question),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tutor_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            topic_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            correct_count INTEGER NOT NULL,
            wrong_count INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    # One resumable session per user (latest wins). The payload is an opaque
    # JSON blob owned by the frontend — the backend stores and serves it
    # without interpreting it.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS active_sessions (
            user_id INTEGER PRIMARY KEY,
            topic_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            payload TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    try:
        cursor.execute("ALTER TABLE opinions_cache ADD COLUMN qdrant_ingested INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE opinions_cache ADD COLUMN opinion_id INTEGER")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE opinions_cache ADD COLUMN cluster_id INTEGER")
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

    # Spaced-repetition upgrade (Leitner boxes). SQLite rejects non-constant
    # defaults in ALTER TABLE, so next_due is added nullable and backfilled:
    # every pre-existing weak card becomes due immediately, preserving the old
    # "weak cards are always in the queue" behavior after the migration.
    try:
        cursor.execute("ALTER TABLE review_progress ADD COLUMN box_level INTEGER DEFAULT 1")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE review_progress ADD COLUMN next_due TIMESTAMP")
    except Exception:
        pass
    cursor.execute(
        "UPDATE review_progress SET next_due = CURRENT_TIMESTAMP "
        "WHERE next_due IS NULL AND got_it = 0"
    )

    conn.commit()
    conn.close()

init_db()