from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class AssistantQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=2_000)
    as_of_date: date | None = None
    circumstances: str | None = Field(default=None, max_length=2_000)


class AssistantCitation(BaseModel):
    document_id: str
    title: str
    fragment_label: str
    excerpt: str
    source_url: str | None
    is_demo: bool


class AssistantAnswer(BaseModel):
    mode: Literal["demo"]
    answer: str
    sources: list[AssistantCitation]
    disclaimer: str
