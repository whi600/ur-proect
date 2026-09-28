from __future__ import annotations

from app.domain.documents import DocumentRecord
from app.repositories.protocol import DocumentRepository


class DocumentService:
    def __init__(self, repository: DocumentRepository) -> None:
        self._repository = repository

    def list_documents(self, query: str | None, limit: int) -> list[DocumentRecord]:
        normalized_query = query.strip() if query else None
        return self._repository.list_documents(normalized_query or None, limit)

    def get_document(self, document_id: str) -> DocumentRecord | None:
        return self._repository.get_document(document_id)

    def search(self, query: str, limit: int) -> list[DocumentRecord]:
        return self.list_documents(query=query, limit=limit)
