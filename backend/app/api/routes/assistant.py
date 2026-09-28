from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies import get_services
from app.container import AppServices
from app.schemas.assistant import AssistantAnswer, AssistantQuestion

router = APIRouter()


@router.post("/assistant/ask", response_model=AssistantAnswer)
def ask_assistant(
    payload: AssistantQuestion,
    services: AppServices = Depends(get_services),
) -> AssistantAnswer:
    """Return the explicitly labelled non-AI demonstration response."""

    return services.assistant_service.ask(
        question=payload.question,
        as_of_date=payload.as_of_date,
        circumstances=payload.circumstances,
    )
