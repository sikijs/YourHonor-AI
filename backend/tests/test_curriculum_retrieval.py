"""Tests for tutor-curriculum retrieval helpers and the RAG endpoint's
collection parameter (items: dynamic-generation grounding + glossary cards)."""
from unittest.mock import patch

from app.services.retrieval import retrieve_curriculum, curriculum_card_from_payload


def _payload(question="What is consideration?", topic="contracts"):
    return {
        "kind": "curriculum",
        "topic": topic,
        "topic_name": "Contracts" if topic == "contracts" else topic.capitalize(),
        "question": question,
        "answer": "A bargained-for exchange.",
        "expected_concepts": ["consideration"],
        "difficulty": 2,
    }


# ----------------------------------------------------------- retrieve_curriculum

def test_retrieve_curriculum_targets_tutor_collection_with_topic_filter():
    captured = {}

    def fake_search(query, top_k=5, min_score=0.5, filters=None, collection_name=None):
        captured.update(query=query, top_k=top_k, min_score=min_score, filters=filters, collection_name=collection_name)
        return [{"content": "Question: test", "payload": _payload()}]

    with patch("app.services.retrieval.search_similar", side_effect=fake_search):
        results = retrieve_curriculum("offer", top_k=4, min_score=0.3, topic="contracts")

    assert captured["collection_name"] == "tutor_curriculum"
    assert captured["filters"] == {"topic": "contracts"}
    assert captured["top_k"] == 4
    assert captured["min_score"] == 0.3
    assert len(results) == 1


def test_retrieve_curriculum_without_topic_uses_no_filter():
    captured = {}

    def fake_search(query, top_k=5, min_score=0.5, filters=None, collection_name=None):
        captured["filters"] = filters
        return []

    with patch("app.services.retrieval.search_similar", side_effect=fake_search):
        results = retrieve_curriculum("offer")

    assert captured["filters"] is None
    assert results == []


def test_retrieve_curriculum_drops_empty_content_results():
    with patch("app.services.retrieval.search_similar", return_value=[
        {"content": "Question: keep me", "payload": _payload("keep me")},
        {"content": "", "payload": _payload("")},
    ]):
        results = retrieve_curriculum("anything")

    assert len(results) == 1
    assert results[0]["content"] == "Question: keep me"


# ------------------------------------------------- curriculum_card_from_payload

def test_curriculum_card_from_payload_builds_card_dict():
    card = curriculum_card_from_payload(_payload())
    assert card["question"] == "What is consideration?"
    assert card["topic_id"] == "contracts"
    assert card["topic_name"] == "Contracts"
    assert card["difficulty"] == 2
    assert card["expected_concepts"] == ["consideration"]


def test_curriculum_card_from_payload_rejects_missing_question():
    assert curriculum_card_from_payload({}) is None
    assert curriculum_card_from_payload(None) is None
    assert curriculum_card_from_payload({"question": "", "topic": "contracts"}) is None


# ------------------------------------------------------------- RAG API endpoint

def test_rag_retrieve_rejects_unknown_collection(client):
    resp = client.post("/api/rag/retrieve", json={
        "query": "test", "collection": "nope",
    })
    assert resp.status_code == 400


def test_rag_retrieve_allows_tutor_curriculum(client):
    resp = client.post("/api/rag/retrieve", json={
        "query": "consideration", "collection": "tutor_curriculum",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["collection"] == "tutor_curriculum"
    assert "results" in data
    assert data["count"] == 0


def test_rag_retrieve_defaults_to_legal_documents(client):
    resp = client.post("/api/rag/retrieve", json={"query": "test"})
    assert resp.status_code == 200
    assert resp.json()["collection"] == "legal_documents"
