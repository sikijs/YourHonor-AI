"""Tests for startup ingestion idempotency and point_exists.

The landing of landmark cases and local seed cases re-bloated the
legal_documents collection (observed ~162k points) because several code
paths re-added the same content on every boot. These tests cover the
self-healing Qdrant-existence checks that replace the fragile cache flags.
"""
from unittest.mock import MagicMock, patch

from app.services import qdrant_store as store


# -------------------------------------------------------------- point_exists

def test_point_exists_true_when_scroll_returns_points():
    client = MagicMock()
    client.scroll.return_value = ([MagicMock()], None)
    with patch.object(store, "get_qdrant_client", return_value=client):
        assert store.point_exists(store.COLLECTION_NAME, {"title": "Miranda", "source": "public_domain"}) is True
    call = client.scroll.call_args
    assert call.kwargs["collection_name"] == store.COLLECTION_NAME
    assert call.kwargs["limit"] == 1
    assert call.kwargs["with_payload"] is False
    assert call.kwargs["with_vectors"] is False
    f = call.kwargs["scroll_filter"]
    assert f.must[0].key == "title"
    assert f.must[0].match.value == "Miranda"
    assert f.must[1].key == "source"


def test_point_exists_false_when_no_points():
    client = MagicMock()
    client.scroll.return_value = ([], None)
    with patch.object(store, "get_qdrant_client", return_value=client):
        assert store.point_exists(store.COLLECTION_NAME, {"title": "Miranda"}) is False


def test_point_exists_false_on_error():
    client = MagicMock()
    client.scroll.side_effect = RuntimeError("down")
    with patch.object(store, "get_qdrant_client", return_value=client):
        assert store.point_exists(store.COLLECTION_NAME, {"title": "Miranda"}) is False


# ------------------------------------------------------------ seed_local_cases

def test_seed_local_cases_skips_when_already_present():
    svc = MagicMock()
    with patch("app.seed_local_cases._already_in_qdrant", return_value=True), \
         patch("app.seed_local_cases.get_ingestion_service", return_value=svc):
        from app.seed_local_cases import seed_local_cases
        result = seed_local_cases()
    assert result == 0
    svc.ingest_document.assert_not_called()


def test_seed_local_cases_ingests_all_when_absent():
    svc = MagicMock()
    with patch("app.seed_local_cases._already_in_qdrant", return_value=False), \
         patch("app.seed_local_cases.get_ingestion_service", return_value=svc):
        from app.seed_local_cases import seed_local_cases
        result = seed_local_cases()
    assert result == 5
    assert svc.ingest_document.call_count == 5


# ------------------------------------------------------------ ingest_landmark_cases

def test_landmark_ingest_skips_when_already_in_qdrant():
    from app.ingest_landmark_cases import ingest_landmark_cases, LANDMARK_CASES
    with patch("app.ingest_landmark_cases._already_in_qdrant", return_value=True), \
         patch("app.services.ingestion.get_ingestion_service") as get_svc, \
         patch("app.ingest_landmark_cases._get_or_fetch") as get_or_fetch:
        ingest_landmark_cases(max_cases=len(LANDMARK_CASES))
    get_svc.assert_not_called()
    get_or_fetch.assert_not_called()


def test_landmark_ingest_tracks_progress_lifecycle():
    from app.ingest_landmark_cases import ingest_landmark_cases, INGESTION_PROGRESS
    valid = {
        "opinion_text": "x" * 500, "citation": [], "court": "",
        "date_filed": "", "opinion_id": 1, "cluster_id": 1,
    }
    svc = MagicMock()
    with patch("app.ingest_landmark_cases._already_in_qdrant", return_value=False), \
         patch("app.ingest_landmark_cases._get_or_fetch", return_value=valid), \
         patch("app.services.ingestion.get_ingestion_service", return_value=svc), \
         patch("app.ingest_landmark_cases.time.sleep"):
        ingest_landmark_cases(max_cases=2)
    assert INGESTION_PROGRESS["running"] is False
    assert INGESTION_PROGRESS["total"] == 2
    assert INGESTION_PROGRESS["done"] == 2
    assert INGESTION_PROGRESS["current"] == ""
    assert svc.ingest_document.call_count == 2


def test_landmark_ingest_counts_failures_in_progress():
    from app.ingest_landmark_cases import ingest_landmark_cases, INGESTION_PROGRESS
    with patch("app.ingest_landmark_cases._already_in_qdrant", return_value=False), \
         patch("app.ingest_landmark_cases._get_or_fetch", return_value=None), \
         patch("app.ingest_landmark_cases.time.sleep"):
        ingest_landmark_cases(max_cases=1)
    assert INGESTION_PROGRESS["failed"] == 1
    assert INGESTION_PROGRESS["done"] == 1
    assert INGESTION_PROGRESS["running"] is False


def test_landmark_seed_names_match_list():
    """No orphan seed entries: every seed key must be usable by _get_or_fetch,
    which matches seeds by exact lowercase LANDMARK_CASES name."""
    import json
    from app.ingest_landmark_cases import LANDMARK_CASES, SEED_PATH
    seed = json.loads(SEED_PATH.read_text())
    list_names = {c["name"].lower() for c in LANDMARK_CASES}
    for entry in seed:
        assert entry["name"].lower() in list_names, f"Orphan seed entry: {entry['name']}"
    assert len(seed) >= len(LANDMARK_CASES) - 10, (
        f"Seed coverage dropped too low ({len(seed)}/{len(LANDMARK_CASES)})"
    )