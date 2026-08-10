"""Loader for the curated doctrine map (app/data/doctrine_map.json).

The map is static, hand-curated educational data describing the landmark
cases in LANDMARK_CASES and the doctrines they illustrate. It is served to
the frontend Doctrine Explorer; it never involves an LLM.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MAP_PATH = Path(__file__).resolve().parent.parent / "data" / "doctrine_map.json"

_cache: dict | None = None


def get_doctrine_map() -> dict:
    """Return the doctrine map, loaded once and cached in memory."""
    global _cache
    if _cache is not None:
        return _cache
    if not MAP_PATH.exists():
        logger.error("Doctrine map not found at %s", MAP_PATH)
        return {"version": 1, "updated": "", "doctrines": []}
    with open(MAP_PATH, encoding="utf-8") as f:
        _cache = json.load(f)
    return _cache


def reset_cache() -> None:
    """Clear the cached map (used by tests)."""
    global _cache
    _cache = None
