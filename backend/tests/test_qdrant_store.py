"""Tests for the Qdrant store: multi-collection support, filters, add_points.

conftest.py patches `app.services.qdrant_store.search_similar` and
`get_qdrant_client` at import time so the rest of the suite never touches a
real Qdrant. To test the REAL store functions here, we reload the module
(the patch object is replaced by the fresh function objects) and then patch
`get_qdrant_client` with a fake client per test. The reload also clobbers
conftest's suite-level mocks, so a module-scoped teardown re-applies them
after this module finishes to keep the remaining test modules isolated
from a real Qdrant. No other test module imports qdrant_store names
directly, so reloading is safe for the session.
"""
import importlib
from unittest.mock import MagicMock, patch

import pytest
from qdrant_client.models import Filter, FieldCondition, MatchValue

from app.services import qdrant_store as store

importlib.reload(store)


@pytest.fixture(scope="module", autouse=True)
def _restore_conftest_mocks():
    """Re-apply the suite-level Qdrant mocks after this module's tests.

    The reload above replaced the module's attributes, silently discarding
    the mocks conftest installed at import time. Tests collected later
    would otherwise fall through to real Qdrant connections, so the mocks
    are restored in this module's teardown (after the real-function tests
    here have already run).
    """
    yield
    store.search_similar = MagicMock(return_value=[])
    store.get_qdrant_client = MagicMock(return_value=MagicMock())


def _mock_client():
    client = MagicMock()
    client.query_points.return_value = MagicMock(points=[])
    client.get_collection.return_value = MagicMock(points_count=0)
    return client


# ---------------------------------------------------------------- filters

def test_build_query_filter_none_returns_none():
    assert store.build_query_filter(None) is None
    assert store.build_query_filter({}) is None


def test_build_query_filter_single_field():
    result = store.build_query_filter({"topic": "contracts"})
    assert isinstance(result, Filter)
    assert len(result.must) == 1
    cond = result.must[0]
    assert isinstance(cond, FieldCondition)
    assert cond.key == "topic"
    assert cond.match == MatchValue(value="contracts")


def test_build_query_filter_multiple_fields():
    result = store.build_query_filter({"topic": "contracts", "kind": "curriculum"})
    assert len(result.must) == 2


# ---------------------------------------------------------------- search

def test_search_similar_uses_default_collection_and_no_filter():
    client = _mock_client()
    with patch.object(store, "get_qdrant_client", return_value=client):
        results = store.search_similar("consideration", top_k=3)

    assert results == []
    assert client.query_points.call_count == 1
    kwargs = client.query_points.call_args.kwargs
    assert kwargs["collection_name"] == store.COLLECTION_NAME
    assert kwargs["limit"] == 3
    assert kwargs["query_filter"] is None


def test_search_similar_applies_filters_and_tutor_collection():
    client = _mock_client()
    with patch.object(store, "get_qdrant_client", return_value=client):
        results = store.search_similar(
            "consideration",
            filters={"topic": "contracts"},
            collection_name=store.TUTOR_COLLECTION_NAME,
        )

    assert results == []
    kwargs = client.query_points.call_args.kwargs
    assert kwargs["collection_name"] == store.TUTOR_COLLECTION_NAME
    query_filter = kwargs["query_filter"]
    assert isinstance(query_filter, Filter)
    assert query_filter.must[0].key == "topic"
    assert query_filter.must[0].match.value == "contracts"


def test_search_similar_fallback_when_query_points_raises():
    client = _mock_client()
    client.query_points.side_effect = [RuntimeError("qdrant down"), MagicMock(points=[])]
    with patch.object(store, "get_qdrant_client", return_value=client):
        results = store.search_similar("offer", filters={"topic": "contracts"})

    assert results == []
    assert client.query_points.call_count == 2
    for call in client.query_points.call_args_list:
        assert call.kwargs["query_filter"] is not None


def test_search_similar_tolerates_curriculum_payloads():
    """Curriculum points store text only as the embedding surface, never in
    the payload — content must fall back to the payload question, and the
    full payload must pass through for structured card fields."""
    client = _mock_client()
    point = MagicMock()
    point.score = 0.82
    point.payload = {
        "kind": "curriculum",
        "topic": "contracts",
        "topic_name": "Contracts",
        "question": "What is consideration?",
        "answer": "A bargained-for exchange.",
        "expected_concepts": ["consideration", "legal detriment"],
        "difficulty": 2,
    }
    client.query_points.return_value = MagicMock(points=[point])
    with patch.object(store, "get_qdrant_client", return_value=client):
        results = store.search_similar("consideration", collection_name=store.TUTOR_COLLECTION_NAME)

    assert len(results) == 1
    result = results[0]
    assert result["content"] == "What is consideration?"
    assert result["score"] == 0.82
    assert result["payload"]["topic"] == "contracts"
    assert result["payload"]["difficulty"] == 2
    assert result["payload"]["expected_concepts"] == ["consideration", "legal detriment"]


def test_search_similar_keeps_legal_document_content_key():
    """Legal document points DO carry a payload content key; it must win
    over the question fallback so existing consumers are unaffected."""
    client = _mock_client()
    point = MagicMock()
    point.score = 0.75
    point.payload = {"content": "Chunk of an opinion.", "title": "Some Case"}
    client.query_points.return_value = MagicMock(points=[point])
    with patch.object(store, "get_qdrant_client", return_value=client):
        results = store.search_similar("test")

    assert results[0]["content"] == "Chunk of an opinion."
    assert results[0]["title"] == "Some Case"


# ---------------------------------------------------------------- add_points

def test_add_points_embeds_and_upserts_payloads():
    client = _mock_client()
    points = [
        {"content": "What is consideration?", "payload": {"topic": "contracts", "answer": "A bargained-for exchange."}},
        {"content": "What is adverse possession?", "payload": {"topic": "property", "answer": "Open and notorious use."}},
    ]
    with patch.object(store, "get_qdrant_client", return_value=client), \
         patch.object(store, "generate_embeddings_batch",
                      side_effect=lambda texts: [[0.0] * 384 for _ in texts]):
        store.add_points(points, collection_name=store.TUTOR_COLLECTION_NAME)

    assert client.upsert.call_count == 1
    kwargs = client.upsert.call_args.kwargs
    assert kwargs["collection_name"] == store.TUTOR_COLLECTION_NAME
    uploaded = kwargs["points"]
    assert len(uploaded) == 2
    assert uploaded[0]["payload"]["topic"] == "contracts"
    assert uploaded[0]["payload"]["answer"] == "A bargained-for exchange."
    assert len(uploaded[0]["vector"]) == 384
    assert len({p["id"] for p in uploaded}) == 2


# ---------------------------------------------------------------- add_documents (backward compat)

def test_add_documents_defaults_to_legal_documents():
    client = _mock_client()
    chunks = [
        {
            "content": "Some legal text here.",
            "index": 0,
            "doc_type": "case_opinion",
            "source": "test",
            "title": "Test Case",
            "heading": None,
        }
    ]
    with patch.object(store, "get_qdrant_client", return_value=client), \
         patch.object(store, "generate_embeddings_batch",
                      side_effect=lambda texts: [[0.0] * 384 for _ in texts]):
        store.add_documents(chunks)

    kwargs = client.upsert.call_args.kwargs
    assert kwargs["collection_name"] == store.COLLECTION_NAME
    assert kwargs["points"][0]["payload"]["doc_type"] == "case_opinion"


# ---------------------------------------------------------------- stats / count

def test_collection_point_count():
    client = _mock_client()
    client.get_collection.return_value = MagicMock(points_count=42)
    with patch.object(store, "get_qdrant_client", return_value=client):
        assert store.collection_point_count(store.TUTOR_COLLECTION_NAME) == 42
        assert store.collection_point_count(store.TUTOR_COLLECTION_NAME) == 42
    client.get_collection.assert_called_with(collection_name=store.TUTOR_COLLECTION_NAME)


def test_collection_point_count_returns_zero_on_error():
    client = _mock_client()
    client.get_collection.side_effect = RuntimeError("down")
    with patch.object(store, "get_qdrant_client", return_value=client):
        assert store.collection_point_count() == 0


def test_get_collection_stats_threads_collection_name():
    client = _mock_client()
    client.get_collection.return_value = MagicMock(points_count=7, status=MagicMock(name="green"))
    with patch.object(store, "get_qdrant_client", return_value=client):
        stats = store.get_collection_stats(store.TUTOR_COLLECTION_NAME)

    assert stats["name"] == store.TUTOR_COLLECTION_NAME
    assert stats["points_count"] == 7
    client.get_collection.assert_called_with(collection_name=store.TUTOR_COLLECTION_NAME)


def test_delete_collection_threads_collection_name():
    client = _mock_client()
    with patch.object(store, "get_qdrant_client", return_value=client):
        store.delete_collection(store.TUTOR_COLLECTION_NAME)
    client.delete_collection.assert_called_with(collection_name=store.TUTOR_COLLECTION_NAME)
