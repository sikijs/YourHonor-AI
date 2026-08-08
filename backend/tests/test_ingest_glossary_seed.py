"""Tests for the glossary seed point builder and startup seeding."""
from unittest.mock import patch

from app.ingest_glossary_seed import build_glossary_seed_points, seed_glossary_seed_collection, GLOSSARY_KIND
from app.services.qdrant_store import GLOSSARY_SEED_COLLECTION_NAME


def test_build_glossary_seed_points_one_per_entry():
    points = build_glossary_seed_points()
    assert len(points) >= 100
    for p in points:
        assert p["content"]
        payload = p["payload"]
        assert payload["kind"] == GLOSSARY_KIND
        assert payload["term"]
        assert payload["definition"]


def test_build_glossary_seed_points_content_carries_term_and_definition():
    points = build_glossary_seed_points()
    actus = next(p for p in points if p["payload"]["term"] == "actus reus")
    assert actus["content"].startswith("Term: actus reus")
    assert "Definition:" in actus["content"]
    assert "mens rea" in actus["content"]
    assert actus["payload"]["jurisdiction"]
    assert actus["payload"]["related_terms"]


def test_seed_glossary_seed_collection_deletes_then_upserts_into_glossary_collection():
    points = build_glossary_seed_points()
    with patch("app.ingest_glossary_seed.add_points") as mock_add, \
         patch("app.ingest_glossary_seed.delete_collection") as mock_delete:
        result = seed_glossary_seed_collection()

    assert result == len(points)
    mock_delete.assert_called_once_with(GLOSSARY_SEED_COLLECTION_NAME)
    call = mock_add.call_args
    assert call.kwargs["collection_name"] == GLOSSARY_SEED_COLLECTION_NAME
    assert len(call.args[0]) == len(points)


def test_seed_glossary_seed_collection_returns_zero_on_error():
    with patch("app.ingest_glossary_seed.add_points", side_effect=RuntimeError("down")), \
         patch("app.ingest_glossary_seed.delete_collection"):
        result = seed_glossary_seed_collection()
    assert result == 0
