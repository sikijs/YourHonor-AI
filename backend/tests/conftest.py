import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

_mock_search = patch("app.services.qdrant_store.search_similar", return_value=[])
_mock_search.start()

_mock_qdrant = patch("app.services.qdrant_store.get_qdrant_client")
_mock_qdrant_client = MagicMock()
_mock_qdrant.start()
_mock_qdrant_client.return_value = _mock_qdrant_client

_mock_embs = MagicMock()
_mock_embs.embed_query.return_value = [0.0] * 384
_mock_embs.embed_documents.return_value = [[0.0] * 384]
_mock_embeddings = patch("app.services.embeddings.get_embeddings", return_value=_mock_embs)
_mock_embeddings.start()

_mock_llm = MagicMock()
_mock_llm.choices = [MagicMock(message=MagicMock(content="Mocked LLM response"))]
_mock_completion = patch("litellm.completion", return_value=_mock_llm)
_mock_completion.start()

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def test_db(tmp_path):
    db_path = tmp_path / "test_yourhonor.db"
    from app import db
    old_path = db.DATABASE_PATH
    db.DATABASE_PATH = db_path
    db.init_db()
    yield db_path
    db.DATABASE_PATH = old_path


@pytest.fixture
def test_uploads(tmp_path):
    upload_path = tmp_path / "uploads"
    upload_path.mkdir()
    from app.services.document import file_storage
    old_dir = file_storage.upload_dir
    file_storage.upload_dir = upload_path
    yield upload_path
    file_storage.upload_dir = old_dir


@pytest.fixture
def client(test_db, test_uploads):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client):
    signup_resp = client.post("/api/auth/signup", json={
        "email": "test@example.com",
        "password": "testpassword123",
    })
    assert signup_resp.status_code == 200
    cookies = signup_resp.cookies
    signin_resp = client.post("/api/auth/signin", json={
        "email": "test@example.com",
        "password": "testpassword123",
    })
    assert signin_resp.status_code == 200
    token = signin_resp.cookies.get("access_token")
    return {"Cookie": f"access_token={token}"} if token else {}
