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
