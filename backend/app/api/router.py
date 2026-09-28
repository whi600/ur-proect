from fastapi import APIRouter

from app.api.routes.assistant import router as assistant_router
from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.api.routes.local_snapshot import router as local_snapshot_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router, tags=["service"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(local_snapshot_router, tags=["local snapshot"])
api_router.include_router(assistant_router, tags=["assistant"])
