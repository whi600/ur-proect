from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.domain.documents import DocumentRecord


class DocumentSummary(BaseModel):
    id: str
    title: str
    document_type: str
    source_name: str
    source_url: str | None
    document_number: str | None
    published_at: date | None
    revision_label: str
    effective_from: date | None
    effective_to: date | None
    is_demo: bool
    jurisdiction: str | None
    legal_level: str | None
    content_state: Literal[
        "demo",
        "offline_metadata",
        "source_metadata",
        "planned",
        "source_snapshot",
        "verified_text",
    ]
    source_checked_at: date | None


class DocumentDetail(DocumentSummary):
    content: str
    fragments: list[DocumentFragment] = []
    fragments_total: int | None = None


class DocumentFragment(BaseModel):
    id: int
    ordinal: int
    kind: Literal["metadata", "preamble", "section", "chapter", "article", "paragraph", "appendix"]
    label: str | None
    heading: str
    body: str
    legal_status: str | None
    revision_label: str | None
    valid_from: date | None
    valid_to: date | None


class DocumentFragmentPage(BaseModel):
    fragments: list[DocumentFragment]
    total: int


class SearchResponse(BaseModel):
    query: str
    results: list[DocumentSummary]


def summary_from_record(record: DocumentRecord) -> DocumentSummary:
    return DocumentSummary(
        id=record.id,
        title=record.title,
        document_type=record.document_type,
        source_name=record.source_name,
        source_url=record.source_url,
        document_number=record.document_number,
        published_at=record.published_at,
        revision_label=record.revision_label,
        effective_from=record.effective_from,
        effective_to=record.effective_to,
        is_demo=record.is_demo,
        jurisdiction=record.jurisdiction,
        legal_level=record.legal_level,
        content_state=record.content_state,
        source_checked_at=record.source_checked_at,
    )


def detail_from_record(record: DocumentRecord) -> DocumentDetail:
    return DocumentDetail(content=record.content, **summary_from_record(record).model_dump())
