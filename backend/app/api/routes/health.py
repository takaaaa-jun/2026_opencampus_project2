from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.webrtc import HealthResponse, ModelFileStatus
from app.webrtc.manager import session_manager

router = APIRouter(tags=["Health"])


async def _health_payload() -> HealthResponse:
    settings = get_settings()
    models = {
        name: ModelFileStatus(path=str(path), available=path.is_file())
        for name, path in settings.model_files().items()
    }
    status = "ok" if all(item.available for item in models.values()) else "degraded"
    return HealthResponse(
        status=status,
        activeSessions=await session_manager.count(),
        models=models,
    )


@router.get("/health/", response_model=HealthResponse)
async def health() -> HealthResponse:
    return await _health_payload()


@router.get("/webrtc/health/", response_model=HealthResponse)
async def webrtc_health() -> HealthResponse:
    return await _health_payload()
