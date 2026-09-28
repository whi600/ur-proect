from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

ContentState = Literal[
    "demo",
    "offline_metadata",
    "source_metadata",
    "planned",
    "source_snapshot",
    "verified_text",
]


@dataclass(frozen=True, slots=True)
class DocumentRecord:
    """A read model shared by demo and PostgreSQL repositories."""

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
    content: str
    is_demo: bool
    jurisdiction: str | None
    legal_level: str | None
    content_state: ContentState
    source_checked_at: date | None
