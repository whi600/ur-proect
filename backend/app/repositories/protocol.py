from __future__ import annotations

from typing import Protocol

from app.domain.documents import DocumentRecord


class DocumentRepository(Protocol):
    def list_documents(self, query: str | None, limit: int) -> list[DocumentRecord]:
        """Return the newest matching documents in a stable presentation order."""

    def get_document(self, document_id: str) -> DocumentRecord | None:
        """Return one public document identifier, if it exists."""
