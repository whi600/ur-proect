from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies import get_services
from app.container import AppServices
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(services: AppServices = Depends(get_services)) -> HealthResponse:
    """Report whether the server started and which data source it is using."""

    return HealthResponse(
        status="ok",
        data_mode=services.settings.data_mode,
        database=services.database_status,
        version=services.settings.app_version,
    )
