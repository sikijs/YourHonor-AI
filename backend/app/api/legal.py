from fastapi import APIRouter, Cookie, Depends, HTTPException
from typing import Optional

from app.models.case_brief import CaseBriefRequest, CaseBriefResponse
from app.models.legal_summary import LegalSummaryRequest, LegalSummaryResponse
from app.models.argument_extraction import ArgumentExtractionRequest, ArgumentExtractionResponse
from app.models.citation_map import CitationMapRequest, CitationMapResponse
from app.models.document_generator import GenerateDocumentRequest, GenerateDocumentResponse
from app.models.memorandum import MemorandumRequest, MemorandumResponse
from app.models.legal_glossary import GlossaryRequest, GlossaryResponse
from app.models.issue_spotter import IssueSpotterRequest, IssueSpotterResponse
from app.services.auth import decode_token
from app.services.case_brief import get_case_brief_service
from app.services.legal_summary import get_legal_summary_service
from app.services.argument_extraction import get_argument_extraction_service
from app.services.citation_map import get_citation_map_service
from app.services.document_generator import get_document_generator
from app.services.template_catalog import get_template_catalog
from app.services.memorandum import get_memorandum_service
from app.services.legal_glossary import get_glossary_service
from app.services.issue_spotter import get_issue_spotter_service

router = APIRouter(prefix="/api/legal", tags=["legal"])


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


@router.post("/case-brief", response_model=CaseBriefResponse)
def generate_case_brief(
    request: CaseBriefRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_case_brief_service()
        result = service.generate(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
            complexity=request.complexity or "standard",
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/summary", response_model=LegalSummaryResponse)
def generate_legal_summary(
    request: LegalSummaryRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_legal_summary_service()
        result = service.generate(
            request.query,
            request.summary_type or "general",
            document_id=request.document_id,
            user_id=user_id,
            complexity=request.complexity or "standard",
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/arguments", response_model=ArgumentExtractionResponse)
def extract_arguments(
    request: ArgumentExtractionRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_argument_extraction_service()
        result = service.extract(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/citations", response_model=CitationMapResponse)
def generate_citation_map(
    request: CitationMapRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_citation_map_service()
        result = service.generate(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/memorandum", response_model=MemorandumResponse)
def generate_memorandum(
    request: MemorandumRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_memorandum_service()
        result = service.generate(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/generate-document", response_model=GenerateDocumentResponse)
def generate_document(
    request: GenerateDocumentRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_document_generator()
        result = service.generate(
            request.template_name,
            request.field_values,
            user_id=user_id,
            title=request.title,
        )
        return GenerateDocumentResponse(
            id=result["id"],
            title=result["title"],
            content=result["content"],
            doc_type=result["doc_type"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/template-fields")
def get_template_fields(template_name: str):
    catalog = get_template_catalog()
    template = catalog.find_by_name(template_name)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")
    service = get_document_generator()
    fields = service.get_fields_for_template(template_name)
    return {"template_name": template_name, "fields": fields}


@router.post("/glossary", response_model=GlossaryResponse)
def lookup_glossary(
    request: GlossaryRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_glossary_service()
        result = service.lookup(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/issue-spotter", response_model=IssueSpotterResponse)
def spot_issues(
    request: IssueSpotterRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        service = get_issue_spotter_service()
        result = service.generate(
            request.query,
            document_id=request.document_id,
            user_id=user_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

