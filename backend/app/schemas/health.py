from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    data_mode: Literal["demo", "postgres"]
    database: Literal["not_used", "connected"]
    version: str
