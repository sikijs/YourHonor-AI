from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.retrieval import get_retrieval_service
from app.services.ingestion import get_ingestion_service

router = APIRouter(prefix="/api/rag", tags=["rag"])


class RetrievalRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    min_score: Optional[float] = 0.5
    filters: Optional[dict] = None


class IngestRequest(BaseModel):
    content: str
    title: str
    source: Optional[str] = "user_upload"
    metadata: Optional[dict] = None


@router.post("/retrieve")
def retrieve_documents(request: RetrievalRequest):
    try:
        retrieval_service = get_retrieval_service()
        results = retrieval_service.retrieve(
            query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            filters=request.filters,
        )
        return {
            "query": request.query,
            "results": results,
            "count": len(results),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest")
def ingest_document(request: IngestRequest):
    try:
        ingestion_service = get_ingestion_service()
        result = ingestion_service.ingest_document(
            content=request.content,
            title=request.title,
            source=request.source or "user_upload",
            metadata=request.metadata,
        )
        return {
            "status": "success",
            "result": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collection/stats")
def get_collection_stats():
    try:
        retrieval_service = get_retrieval_service()
        stats = retrieval_service.get_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collection/rebuild")
def rebuild_collection():
    from app.services.qdrant_store import delete_collection, create_collection_if_not_exists
    try:
        delete_collection()
        create_collection_if_not_exists()
        return {"status": "success", "message": "Collection rebuilt"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))