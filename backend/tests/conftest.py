from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture()
def client() -> TestClient:
    settings = Settings(data_mode="demo", ai_provider="demo")
    with TestClient(create_app(settings)) as test_client:
        yield test_client
