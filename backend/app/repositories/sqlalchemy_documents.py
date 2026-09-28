from __future__ import annotations

from typing import cast

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload, sessionmaker

from app.db.models import DocumentVersion, LegalDocument
from app.domain.documents import ContentState, DocumentRecord


class SqlAlchemyDocumentRepository:
    """PostgreSQL adapter ready for licensed source data and migration-managed schema."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def list_documents(self, query: str | None, limit: int) -> list[DocumentRecord]:
        statement = select(LegalDocument).options(selectinload(LegalDocument.versions))
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    LegalDocument.title.ilike(pattern),
                    LegalDocument.document_number.ilike(pattern),
                    LegalDocument.source_name.ilike(pattern),
                )
            )
        statement = statement.order_by(LegalDocument.updated_at.desc()).limit(limit)

        with self._session_factory() as session:
            documents = session.scalars(statement).unique().all()
        return [self._to_record(document) for document in documents]

    def get_document(self, document_id: str) -> DocumentRecord | None:
        statement = (
            select(LegalDocument)
            .options(selectinload(LegalDocument.versions))
            .where(LegalDocument.public_id == document_id)
        )
        with self._session_factory() as session:
            document = session.scalar(statement)
        return self._to_record(document) if document else None

    @staticmethod
    def _to_record(document: LegalDocument) -> DocumentRecord:
        version = _current_version(document.versions)
        return DocumentRecord(
            id=document.public_id,
            title=document.title,
            document_type=document.document_type,
            source_name=document.source_name,
            source_url=document.source_url,
            document_number=document.document_number,
            published_at=document.published_at,
            revision_label=version.revision_label if version else "Редакция не загружена",
            effective_from=version.effective_from if version else None,
            effective_to=version.effective_to if version else None,
            content=version.content if version else "",
            is_demo=document.is_demo,
            jurisdiction=document.jurisdiction,
            legal_level=document.legal_level,
            content_state=cast(ContentState, version.content_state) if version else "planned",
            source_checked_at=version.source_checked_at if version else None,
        )


def _current_version(versions: list[DocumentVersion]) -> DocumentVersion | None:
    if not versions:
        return None
    return next((version for version in versions if version.is_current), versions[0])
