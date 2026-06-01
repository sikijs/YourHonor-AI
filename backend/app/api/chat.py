from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.services.auth import decode_token
from app.services.chat import get_chat_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


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


class ChatMessage(BaseModel):
    message: str


class SourceInfo(BaseModel):
    title: str
    source: str
    relevance_score: float


class ChatMessageResponse(BaseModel):
    response: str
    sources: list[SourceInfo]
    retrieval_count: int
    suggested_tool: Optional[str] = None
    suggested_name: Optional[str] = None
    suggested_description: Optional[str] = None
    suggested_query: Optional[str] = None


@router.get("/greeting")
def get_greeting(user_id: int = Depends(get_current_user_id)):
    return {
        "greeting": "Hello! I'm YourHonor AI, your legal education assistant. I can help you with legal research, document drafting, and learning about legal concepts. What would you like to explore today?"
    }


@router.post("/message", response_model=ChatMessageResponse)
def send_message(chat: ChatMessage, user_id: int = Depends(get_current_user_id)):
    try:
        chat_service = get_chat_service()
        result = chat_service.generate_response(
            user_message=chat.message,
            user_id=user_id,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
