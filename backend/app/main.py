from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.container import AppServices
from app.core.config import Settings, get_settings
from app.db.session import create_db_engine, create_session_factory, verify_database_connection
from app.repositories.demo_documents import DemoDocumentRepository
from app.repositories.protocol import DocumentRepository
from app.repositories.sqlalchemy_documents import SqlAlchemyDocumentRepository
from app.services.assistant import DemoAssistantService
from app.services.documents import DocumentService


def build_services(settings: Settings) -> AppServices:
    """Choose the deterministic demo repository or the prepared PostgreSQL adapter."""

    repository: DocumentRepository
    database_status: Literal["not_used", "connected"] = "not_used"
    if settings.data_mode == "postgres":
        if settings.database_url is None:  # Guarded by Settings, retained for type safety.
            raise RuntimeError("APP_DATABASE_URL is required for PostgreSQL mode.")
        engine = create_db_engine(settings.database_url)
        try:
            verify_database_connection(engine)
        except Exception as exc:  # pragma: no cover - needs a live local database.
            raise RuntimeError(
                "PostgreSQL mode is selected, but the database cannot be reached. "
                "Start Docker Compose, check backend/.env, then run Alembic migrations."
            ) from exc
        repository = SqlAlchemyDocumentRepository(create_session_factory(engine))
        database_status = "connected"
    else:
        repository = DemoDocumentRepository()

    document_service = DocumentService(repository)
    # This stage intentionally has no provider implementation. Even if a future provider
    # is configured, the endpoint remains an honest demo response until an adapter is added.
    assistant_service = DemoAssistantService(document_service)
    return AppServices(
        settings=settings,
        document_service=document_service,
        assistant_service=assistant_service,
        database_status=database_status,
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API application; optional settings make unit tests deterministic."""

    effective_settings = settings or get_settings()
    app = FastAPI(
        title=effective_settings.app_name,
        version=effective_settings.app_version,
        description=(
            "Учебный API-каркас. Данные и ответы в режиме demo не являются "
            "действующим законодательством или юридической консультацией."
        ),
    )
    # The React Native app does not need CORS, but the optional web preview at
    # localhost:8081 does. Keep the development allow-list deliberately narrow.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:8081", "http://127.0.0.1:8081"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )
    app.state.services = build_services(effective_settings)
    app.include_router(api_router)

    @app.get("/health", include_in_schema=False)
    def root_health() -> dict[str, str]:
        """Compact alias for a browser or shell check of a newly started service."""

        return {"status": "ok"}

    return app


app = create_app()
