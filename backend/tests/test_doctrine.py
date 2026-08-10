"""Tests for the Doctrine Explorer API.

The doctrine map is curated static data served at GET /api/doctrine/map.
The parity tests here keep it in sync with LANDMARK_CASES: every doctrine
map case must exist in the landmark list AND every landmark case must appear
in the map (full coverage, years matching). This mirrors the seed-key parity
test in test_ingest_cleanup.py.
"""
import json

from app.ingest_landmark_cases import LANDMARK_CASES
from app.services.doctrine_map import MAP_PATH, reset_cache


def _load_map():
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def test_doctrine_map_endpoint_shape(client):
    resp = client.get("/api/doctrine/map")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == 1
    assert data["updated"]
    assert len(data["doctrines"]) >= 15
    ids = [d["id"] for d in data["doctrines"]]
    assert len(ids) == len(set(ids)), "Doctrine ids must be unique"
    for d in data["doctrines"]:
        assert d["name"]
        assert d["subject"]
        assert d["description"]
        assert d["cases"], f"Doctrine {d['id']} has no cases"
        for c in d["cases"]:
            assert c["name"] and c["citation"] and c["year"] and c["holding"]


def test_doctrine_map_endpoint_is_public(client):
    # No auth fixture used — endpoint must not require a session.
    resp = client.get("/api/doctrine/map")
    assert resp.status_code == 200


def test_all_map_cases_exist_in_landmark_list():
    """No orphan case entries: every map case must be a known landmark case."""
    data = _load_map()
    list_names = {c["name"].lower() for c in LANDMARK_CASES}
    list_by_name = {c["name"].lower(): c for c in LANDMARK_CASES}
    for d in data["doctrines"]:
        for c in d["cases"]:
            key = c["name"].lower()
            assert key in list_names, f"Map case not in LANDMARK_CASES: {c['name']}"
            assert list_by_name[key]["year"] == c["year"], (
                f"Year mismatch for {c['name']}: map {c['year']} vs list {list_by_name[key]['year']}"
            )


def test_all_landmark_cases_covered_by_map():
    """Full coverage: every landmark case must appear under at least one doctrine."""
    data = _load_map()
    map_names = {c["name"].lower() for d in data["doctrines"] for c in d["cases"]}
    uncovered = [c["name"] for c in LANDMARK_CASES if c["name"].lower() not in map_names]
    assert not uncovered, f"Landmark cases missing from doctrine map: {uncovered}"


def test_doctrine_map_cache_reset(client):
    """reset_cache() forces a fresh load (used by tests to avoid stale data)."""
    reset_cache()
    resp = client.get("/api/doctrine/map")
    assert resp.status_code == 200
    reset_cache()
