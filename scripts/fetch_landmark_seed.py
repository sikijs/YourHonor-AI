#!/usr/bin/env python3
"""Dev-time tool: rebuild backend/app/data/landmark_seed.json so every
LANDMARK_CASES entry has its full opinion text bundled in the Docker image.

Seeded cases load instantly at boot (no network, no 12s rate-limit sleep),
so the goal is 100% seed coverage. Cases CourtListener cannot resolve
(typically old state-court opinions) are skipped with a warning and fall
back to runtime fetching.

Usage (from the repo root, with COURTLISTENER_TOKEN set in backend/.env or
the environment):

    cd backend && uv run python ../scripts/fetch_landmark_seed.py [--limit N]

--limit N processes only the first N cases (useful for a quick smoke test).
"""
import argparse
import json
import logging
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))


def _load_root_env() -> None:
    """Load repo-root .env so COURTLISTENER_TOKEN works without exporting it."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


import os  # noqa: E402

_load_root_env()

from app.ingest_landmark_cases import LANDMARK_CASES, SEED_PATH  # noqa: E402
from connectors.courtlistener import _has_auth, case_brief_from_query  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("fetch_landmark_seed")

RATE_LIMIT_SLEEP = 12
MIN_TEXT_LENGTH = 200
OUT_PATH = BACKEND_DIR / "app" / "data" / "landmark_seed.json"


def _write_seed(entries: list[dict]) -> None:
    """Persist incrementally so an interrupted run never loses fetched text."""
    with open(OUT_PATH, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def _load_existing() -> dict:
    if not SEED_PATH.exists():
        return {}
    with open(SEED_PATH) as f:
        return {c["name"].lower(): c for c in json.load(f)}


def _seed_entry(case: dict, result: dict) -> dict:
    return {
        "name": case["name"],
        "citation": case["citation"],
        "year": case["year"],
        "case_name": result.get("case_name", case["name"]),
        "court": result.get("court", ""),
        "date_filed": result.get("date_filed", ""),
        "citations": result.get("citation", []),
        "opinion_text": result.get("opinion_text", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N cases")
    parser.add_argument("--sleep", type=int, default=RATE_LIMIT_SLEEP, help="Seconds between fetches (default 12)")
    args = parser.parse_args()

    if not _has_auth():
        logger.error("COURTLISTENER_TOKEN is not set — add it to backend/.env and retry.")
        return 1

    existing = _load_existing()
    cases = LANDMARK_CASES[: args.limit] if args.limit else LANDMARK_CASES
    logger.info(f"Rebuilding landmark seed: {len(cases)} cases, {len(existing)} existing entries")

    updated: dict[str, dict] = {}
    kept = fetched = failed = 0

    for case in cases:
        name = case["name"]
        key = name.lower()
        prior = existing.get(key)

        if prior and len(prior.get("opinion_text", "")) >= MIN_TEXT_LENGTH:
            updated[key] = prior
            kept += 1
            logger.info(f"  [keep] {name}")
            continue

        logger.info(f"  [fetch] {name} ({case['citation']}) ...")
        try:
            result = case_brief_from_query(f"{name} {case['citation']}")
        except Exception as e:
            logger.warning(f"  [fail] {name} — exception: {e}")
            result = None

        if result and len(result.get("opinion_text", "")) >= MIN_TEXT_LENGTH:
            updated[key] = _seed_entry(case, result)
            fetched += 1
            logger.info(f"  [ok]   {name} ({len(result['opinion_text'])} chars)")
        else:
            failed += 1
            logger.warning(f"  [fail] {name} — no usable opinion text (will fetch at runtime)")

        time.sleep(args.sleep)
        _write_seed(list(updated.values()))

    logger.info(f"Summary: {kept} kept, {fetched} fetched, {failed} failed — total {len(updated)}/{len(cases)}")
    logger.info(f"Seed file: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
