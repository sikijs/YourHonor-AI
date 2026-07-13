import threading
import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pathlib import Path
from app.api import auth, documents, chat, rag, legal, templates, tutor, debate, about
from app.services.document import file_storage

APP_VERSION = "1.2.1"

app = FastAPI(title="YourHonor AI", description="Legal AI Education Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(rag.router)
app.include_router(legal.router)
app.include_router(templates.router)
app.include_router(tutor.router)
app.include_router(debate.router)
app.include_router(about.router)


@app.on_event("startup")
def pre_ingest_landmark_cases():
    file_storage.ensure_dir()
    threading.Thread(target=_run_startup_tasks, daemon=True).start()


def _run_startup_tasks():
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.seed_local_cases import seed_local_cases
        seed_local_cases()
    except Exception as e:
        logger.warning(f"Local case seeding skipped: {e}")
    try:
        from app.ingest_landmark_cases import ingest_landmark_cases
        ingest_landmark_cases()
    except Exception as e:
        logger.warning(f"Landmark case pre-ingestion skipped: {e}")

static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

    @app.get("/_next/{path:path}")
    def serve_next_assets(path: str):
        file_path = static_path / "_next" / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return Response(status_code=404)

    @app.get("/logo.png")
    def serve_logo():
        logo = static_path / "logo.png"
        if logo.exists():
            return FileResponse(str(logo))
        return Response(status_code=404)

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "YourHonor AI Backend"}

@app.get("/api/check-update")
def check_update():
    try:
        resp = httpx.get(
            "https://api.github.com/repos/sikijs/YourHonor-AI/git/refs/tags",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )
        if resp.status_code == 200:
            tags = resp.json()
            latest = None
            latest_parts = (0, 0, 0)
            for tag in tags:
                ref = tag.get("ref", "")
                if ref.startswith("refs/tags/v"):
                    ver = ref[len("refs/tags/v"):]
                    parts = ver.split(".")
                    if len(parts) == 3 and all(p.isdigit() for p in parts):
                        ver_tuple = tuple(map(int, parts))
                        if ver_tuple > latest_parts:
                            latest_parts = ver_tuple
                            latest = ver
            if latest is not None:
                return {
                    "up_to_date": latest == APP_VERSION,
                    "latest_version": latest,
                }
    except Exception:
        pass
    return {
        "up_to_date": False,
        "latest_version": "unknown",
    }

@app.get("/")
def serve_index():
    static_index = Path(__file__).parent / "static" / "index.html"
    if static_index.exists():
        return FileResponse(str(static_index))
    return {"message": "YourHonor AI Backend - API running"}

@app.get("/{path:path}")
def serve_spa_fallback(path: str):
    if path.startswith("api/") or path.startswith("_next/") or path.startswith("static/"):
        return Response(status_code=404)
    static_index = static_path / "index.html"
    if static_index.exists():
        return FileResponse(str(static_index))
    return Response(status_code=404)