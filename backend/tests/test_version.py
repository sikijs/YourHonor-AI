"""Guard against version drift across the canonical version constants.

The app version is defined independently in four code locations (backend
main.py, backend pyproject.toml, frontend package.json, frontend
next.config.js) plus the docs landing page. They drifted apart before
(1.3.0 vs 1.2.1 in the lockfile); this test fails loudly if that ever
happens again.
"""
import json
import re
import tomllib
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


def _backend_main_version() -> str:
    from app.main import APP_VERSION
    return APP_VERSION


def _backend_pyproject_version() -> str:
    with open(BACKEND_DIR / "pyproject.toml", "rb") as f:
        return tomllib.load(f)["project"]["version"]


def _frontend_package_version() -> str:
    with open(REPO_ROOT / "frontend" / "package.json") as f:
        return json.load(f)["version"]


def _frontend_env_version() -> str:
    content = (REPO_ROOT / "frontend" / "next.config.js").read_text()
    match = re.search(r"NEXT_PUBLIC_APP_VERSION:\s*['\"]([^'\"]+)['\"]", content)
    assert match, "NEXT_PUBLIC_APP_VERSION not found in next.config.js"
    return match.group(1)


def test_all_version_constants_match():
    versions = {
        "backend/app/main.py (APP_VERSION)": _backend_main_version(),
        "backend/pyproject.toml (version)": _backend_pyproject_version(),
        "frontend/package.json (version)": _frontend_package_version(),
        "frontend/next.config.js (NEXT_PUBLIC_APP_VERSION)": _frontend_env_version(),
    }
    unique = set(versions.values())
    assert len(unique) == 1, f"Version constants drifted: {versions}"


def test_landing_page_shows_current_version():
    app_version = _backend_main_version()
    landing = (REPO_ROOT / "docs" / "index.html").read_text()
    assert f"Version {app_version}" in landing, (
        f"docs/index.html does not advertise Version {app_version}"
    )
