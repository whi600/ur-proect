from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.config import Settings
from app.services.assistant import DemoAssistantService
from app.services.documents import DocumentService


@dataclass(frozen=True, slots=True)
class AppServices:
    """Small dependency container so routes do not select storage themselves."""

    settings: Settings
    document_service: DocumentService
    assistant_service: DemoAssistantService
    database_status: Literal["not_used", "connected"]
