def test_rag_retrieve_returns_200_without_auth(client):
    resp = client.post("/api/rag/retrieve", json={"query": "test query", "top_k": 3})
    assert resp.status_code == 200
    data = resp.json()
    assert "query" in data
    assert "results" in data
    assert "count" in data


def test_rag_ingest_returns_200_without_auth(client):
    resp = client.post("/api/rag/ingest", json={
        "content": "test content",
        "title": "test doc",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"


def test_rag_collection_stats_returns_200_without_auth(client):
    resp = client.get("/api/rag/collection/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "name" in data
    assert "vectors_count" in data
    assert "points_count" in data
    assert "status" in data


def test_rag_collection_stats_accepts_collection_param(client):
    resp = client.get("/api/rag/collection/stats?collection=tutor_curriculum")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "tutor_curriculum"


def test_rag_collection_stats_rejects_unknown_collection(client):
    resp = client.get("/api/rag/collection/stats?collection=unknown")
    assert resp.status_code == 400


def test_rag_ingestion_status_returns_progress_shape(client):
    resp = client.get("/api/rag/ingestion-status")
    assert resp.status_code == 200
    data = resp.json()
    assert "running" in data
    assert "total" in data
    assert "done" in data
    assert "failed" in data
    assert "current" in data
    assert isinstance(data["running"], bool)
