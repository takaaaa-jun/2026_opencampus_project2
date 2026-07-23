from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OfferRequest(BaseModel):
    sdp: str = Field(min_length=1)
    type: Literal["offer"]


class OfferResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sdp: str
    type: Literal["answer"]
    session_id: UUID = Field(alias="sessionId")


class CloseSessionResponse(BaseModel):
    closed: bool


class ModelFileStatus(BaseModel):
    path: str
    available: bool


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    activeSessions: int
    models: dict[str, ModelFileStatus]


class RuntimeConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    clap_threshold: float | None = Field(
        default=None,
        alias="clapThreshold",
        ge=0.03,
        le=0.5,
    )


class ClientConfigMessage(BaseModel):
    type: Literal["config"]
    config: RuntimeConfig

    def as_update_mapping(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        if self.config.clap_threshold is not None:
            result["clapThreshold"] = self.config.clap_threshold
        return result
