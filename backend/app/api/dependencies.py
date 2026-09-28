from __future__ import annotations

from typing import cast

from fastapi import Request

from app.container import AppServices


def get_services(request: Request) -> AppServices:
    """Expose the immutable application service container to route handlers."""

    return cast(AppServices, request.app.state.services)
