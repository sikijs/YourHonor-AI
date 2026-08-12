from fastapi import APIRouter, HTTPException, Cookie, Depends, Response
from typing import Optional
from urllib.parse import quote

from app.models.export_request import ExportRequest
from app.services.auth import decode_token
from app.services.export import export_content, sanitize_filename, ExportError

router = APIRouter(prefix="/api/export", tags=["export"])

_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "md": "text/markdown; charset=utf-8",
}


def get_current_user_id(access_token: Optional[str] = Cookie(None)) -> int:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(user_id)


@router.post("")
def export_document(
    request: ExportRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        data = export_content(request.content, request.content_type, request.format, request.filename)
    except ExportError as e:
        raise HTTPException(status_code=400, detail=str(e))

    filename = sanitize_filename(request.filename) + "." + request.format
    content_disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=data,
        media_type=_MEDIA_TYPES[request.format],
        headers={"Content-Disposition": content_disposition},
    )