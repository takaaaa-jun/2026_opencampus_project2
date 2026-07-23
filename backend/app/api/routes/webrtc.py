from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from aiortc import RTCSessionDescription
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.webrtc import (
    CloseSessionResponse,
    OfferRequest,
    OfferResponse,
)
from app.vision.processor import MediaPipeProcessor
from app.webrtc.manager import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webrtc", tags=["WebRTC"])


@router.post(
    "/offer/",
    response_model=OfferResponse,
    responses={400: {"description": "Invalid SDP offer"}, 503: {"description": "Models unavailable"}},
)
async def exchange_offer(
    request: OfferRequest,
) -> OfferResponse | JSONResponse:
    settings = get_settings()

    try:
        processor = await asyncio.to_thread(
            MediaPipeProcessor.from_settings,
            settings,
        )
    except FileNotFoundError as exc:
        return JSONResponse(status_code=503, content={"error": str(exc)})
    except Exception as exc:
        logger.exception("Failed to initialize MediaPipe.")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to initialize MediaPipe: {exc}"},
        )

    session = await session_manager.create(settings, processor)
    try:
        offer = RTCSessionDescription(sdp=request.sdp, type=request.type)
        answer = await session.negotiate(offer)
        return OfferResponse(
            sdp=answer.sdp,
            type="answer",
            sessionId=session.id,
        )
    except Exception as exc:
        logger.exception("WebRTC negotiation failed for session %s.", session.id)
        await session_manager.close(session.id)
        return JSONResponse(
            status_code=400,
            content={"error": f"WebRTC negotiation failed: {exc}"},
        )


@router.post(
    "/sessions/{session_id}/close/",
    response_model=CloseSessionResponse,
)
async def close_session(session_id: UUID) -> CloseSessionResponse:
    closed = await session_manager.close(session_id)
    return CloseSessionResponse(closed=closed)
