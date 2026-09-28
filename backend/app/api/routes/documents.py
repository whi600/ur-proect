from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_services
from app.container import AppServices
from app.schemas.documents import (
    DocumentDetail,
    DocumentSummary,
    SearchResponse,
    detail_from_record,
    summary_from_record,
)

router = APIRouter()


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=50),
    services: AppServices = Depends(get_services),
) -> list[DocumentSummary]:
    """List starter catalogue cards, optionally filtered by a simple text query."""

    records = services.document_service.list_documents(q, limit)
    return [summary_from_record(record) for record in records]


def _search(
    q: str,
    limit: int,
    services: AppServices,
) -> SearchResponse:
    records = services.document_service.search(q, limit)
    return SearchResponse(query=q, results=[summary_from_record(record) for record in records])


@router.get("/search", response_model=SearchResponse)
def search_documents(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=50, ge=1, le=50),
    services: AppServices = Depends(get_services),
) -> SearchResponse:
    """Canonical text search over the starter catalogue and educational cards."""

    return _search(q=q, limit=limit, services=services)


@router.get("/documents/search", response_model=SearchResponse, include_in_schema=False)
def search_documents_compatibility(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=50, ge=1, le=50),
    services: AppServices = Depends(get_services),
) -> SearchResponse:
    """Compatibility endpoint retained for early mobile clients."""

    return _search(q=q, limit=limit, services=services)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    services: AppServices = Depends(get_services),
) -> DocumentDetail:
    record = services.document_service.get_document(document_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ с указанным идентификатором не найден.",
        )
    return detail_from_record(record)
