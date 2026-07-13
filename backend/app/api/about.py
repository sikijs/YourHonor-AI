from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter(prefix="/api/about", tags=["about"])

_candidates = [
    Path(__file__).resolve().parent.parent.parent.parent,  # 4 levels up (host dev)
    Path(__file__).resolve().parent.parent.parent,         # 3 levels up (Docker)
]
PROJECT_ROOT = next((p for p in _candidates if (p / "docs" / "about.md").exists()), _candidates[0])
ABOUT_MD = PROJECT_ROOT / "docs" / "about.md"
ABOUT_LOGO = PROJECT_ROOT / "docs" / "images" / "yourhonor-ai-logo.png"


@router.get("")
def get_about():
    if not ABOUT_MD.exists():
        raise HTTPException(status_code=404, detail="About page not found")
    content = ABOUT_MD.read_text(encoding="utf-8")
    content = content.replace(
        "images/yourhonor-ai-logo.png",
        "/api/about/logo",
    )
    return {"content": content}


@router.get("/logo")
def get_about_logo():
    if not ABOUT_LOGO.exists():
        raise HTTPException(status_code=404, detail="Logo not found")
    return FileResponse(str(ABOUT_LOGO))
