from __future__ import annotations

from datetime import date

from app.schemas.assistant import AssistantAnswer, AssistantCitation
from app.services.documents import DocumentService


class DemoAssistantService:
    """Rule-based placeholder; it intentionally makes no external AI request."""

    def __init__(self, document_service: DocumentService) -> None:
        self._document_service = document_service

    def ask(
        self,
        question: str,
        as_of_date: date | None,
        circumstances: str | None,
    ) -> AssistantAnswer:
        matching_documents = [
            document
            for document in self._document_service.search(question, limit=10)
            if document.is_demo
        ][:3]
        citations = [
            AssistantCitation(
                document_id=document.id,
                title=document.title,
                fragment_label="Демонстрационный фрагмент",
                excerpt=_excerpt(document.content),
                source_url=document.source_url,
                is_demo=document.is_demo,
            )
            for document in matching_documents
        ]

        date_note = (
            f" Указанная дата для будущей проверки редакции: {as_of_date.isoformat()}."
            if as_of_date
            else " Для реального запроса необходимо уточнить дату, на которую нужен ответ."
        )
        circumstances_note = (
            " Обстоятельства получены, но в demo-режиме они не анализируются."
            if circumstances
            else ""
        )
        if citations:
            citation_titles = ", ".join(source.title for source in citations)
            answer = (
                "Демонстрационный ответ: это правило поиска, а не работа модели ИИ. "
                f"По тексту вопроса найдены учебные карточки: {citation_titles}."
                f"{date_note}{circumstances_note}"
            )
        else:
            answer = (
                "Демонстрационный ответ: модель ИИ и правовая база ещё не подключены. "
                "По учебным карточкам совпадений не найдено."
                f"{date_note}{circumstances_note}"
            )

        return AssistantAnswer(
            mode="demo",
            answer=answer,
            sources=citations,
            disclaimer=(
                "Демонстрационный режим: это не юридическая консультация и не подтверждение "
                "действующей редакции законодательства."
            ),
        )


def _excerpt(content: str, length: int = 220) -> str:
    normalized = " ".join(content.split())
    return normalized if len(normalized) <= length else f"{normalized[: length - 1]}…"
