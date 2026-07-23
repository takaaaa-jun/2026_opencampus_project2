from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.core.config import Settings
from app.vision.processor import MediaPipeProcessor
from app.webrtc.session import PeerConnectionSession

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[UUID, PeerConnectionSession] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        settings: Settings,
        processor: MediaPipeProcessor,
    ) -> PeerConnectionSession:
        session = PeerConnectionSession(
            settings=settings,
            processor=processor,
            close_callback=self.close,
        )
        async with self._lock:
            self._sessions[session.id] = session
        logger.info("Created WebRTC session %s.", session.id)
        return session

    async def close(self, session_id: UUID) -> bool:
        async with self._lock:
            session = self._sessions.pop(session_id, None)
        if session is None:
            return False
        await session.close()
        logger.info("Closed WebRTC session %s.", session_id)
        return True

    async def close_all(self) -> None:
        async with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        if sessions:
            await asyncio.gather(
                *(session.close() for session in sessions),
                return_exceptions=True,
            )
        logger.info("Closed all WebRTC sessions.")

    async def count(self) -> int:
        async with self._lock:
            return len(self._sessions)


session_manager = SessionManager()
