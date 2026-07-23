from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID, uuid4

from aiortc import (
    RTCDataChannel,
    RTCPeerConnection,
    RTCSessionDescription,
    MediaStreamTrack,
)
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.webrtc import ClientConfigMessage
from app.vision.processor import MediaPipeProcessor
from app.webrtc.analyzer import LatestFrameAnalyzer

logger = logging.getLogger(__name__)

CloseCallback = Callable[[UUID], Awaitable[bool]]


class PeerConnectionSession:
    def __init__(
        self,
        settings: Settings,
        processor: MediaPipeProcessor,
        close_callback: CloseCallback,
    ) -> None:
        self.id = uuid4()
        self.pc = RTCPeerConnection()
        self._settings = settings
        self._processor = processor
        self._close_callback = close_callback
        self._data_channel: RTCDataChannel | None = None
        self._analyzer: LatestFrameAnalyzer | None = None
        self._disconnect_task: asyncio.Task[None] | None = None
        self._closed = False
        self._register_peer_connection_handlers()

    async def negotiate(
        self,
        offer: RTCSessionDescription,
    ) -> RTCSessionDescription:
        await self.pc.setRemoteDescription(offer)
        answer = await self.pc.createAnswer()
        await self.pc.setLocalDescription(answer)
        await self._wait_for_ice_gathering_complete()
        local_description = self.pc.localDescription
        if local_description is None:
            raise RuntimeError("Failed to create local SDP answer.")
        return local_description

    def _register_peer_connection_handlers(self) -> None:
        @self.pc.on("datachannel")
        def on_datachannel(channel: RTCDataChannel) -> None:
            if channel.label != "detections":
                logger.info(
                    "Ignoring unsupported data channel %s for session %s.",
                    channel.label,
                    self.id,
                )
                return
            self.attach_data_channel(channel)

        @self.pc.on("track")
        def on_track(track: MediaStreamTrack) -> None:
            if track.kind != "video":
                logger.info(
                    "Ignoring unsupported %s track for session %s.",
                    track.kind,
                    self.id,
                )
                return
            self.attach_video_track(track)

            @track.on("ended")
            async def on_ended() -> None:
                logger.info("Video track ended for session %s.", self.id)
                await self._close_callback(self.id)

        @self.pc.on("connectionstatechange")
        async def on_connection_state_change() -> None:
            state = self.pc.connectionState
            logger.info("Session %s connection state: %s", self.id, state)
            if state == "connected":
                self._cancel_disconnect_timer()
            elif state == "disconnected":
                self._start_disconnect_timer()
            elif state in {"failed", "closed"}:
                await self._close_callback(self.id)

    def attach_data_channel(self, channel: RTCDataChannel) -> None:
        if self._data_channel is not None and self._data_channel is not channel:
            with contextlib.suppress(Exception):
                self._data_channel.close()
        self._data_channel = channel

        @channel.on("open")
        def on_open() -> None:
            logger.info("Detection channel opened for session %s.", self.id)

        @channel.on("close")
        def on_close() -> None:
            logger.info("Detection channel closed for session %s.", self.id)

        @channel.on("message")
        def on_message(message: Any) -> None:
            if not isinstance(message, str):
                return
            try:
                parsed = ClientConfigMessage.model_validate_json(message)
            except ValidationError:
                logger.debug(
                    "Ignoring invalid client message for session %s.",
                    self.id,
                )
                return
            self._processor.update_config(parsed.as_update_mapping())

    def attach_video_track(self, track: MediaStreamTrack) -> None:
        if self._analyzer is not None:
            logger.warning("Session %s already has a video track.", self.id)
            return
        self._analyzer = LatestFrameAnalyzer(
            track=track,
            processor=self._processor,
            on_result=self.send_detection,
            max_analysis_fps=self._settings.mediapipe_max_analysis_fps,
        )
        self._analyzer.start()

    def send_detection(self, payload: dict[str, Any]) -> None:
        channel = self._data_channel
        if channel is None or channel.readyState != "open":
            return
        if (
            getattr(channel, "bufferedAmount", 0)
            > self._settings.data_channel_max_buffered_amount
        ):
            logger.debug("Dropping detection payload for slow client %s.", self.id)
            return
        try:
            channel.send(
                json.dumps(
                    payload,
                    separators=(",", ":"),
                    ensure_ascii=False,
                )
            )
        except Exception:
            logger.exception("Failed to send detection for session %s.", self.id)

    async def _wait_for_ice_gathering_complete(self) -> None:
        if self.pc.iceGatheringState == "complete":
            return
        completed = asyncio.Event()

        @self.pc.on("icegatheringstatechange")
        def on_ice_gathering_state_change() -> None:
            if self.pc.iceGatheringState == "complete":
                completed.set()

        try:
            await asyncio.wait_for(
                completed.wait(),
                timeout=self._settings.webrtc_ice_gathering_timeout_seconds,
            )
        except TimeoutError:
            logger.warning("ICE gathering timed out for session %s.", self.id)

    def _start_disconnect_timer(self) -> None:
        self._cancel_disconnect_timer()
        if self._settings.webrtc_disconnect_grace_seconds <= 0:
            self._disconnect_task = asyncio.create_task(
                self._close_callback(self.id),
                name=f"close-disconnected-{self.id}",
            )
            return
        self._disconnect_task = asyncio.create_task(
            self._close_if_still_disconnected(),
            name=f"disconnect-grace-{self.id}",
        )

    async def _close_if_still_disconnected(self) -> None:
        try:
            await asyncio.sleep(
                self._settings.webrtc_disconnect_grace_seconds
            )
            if self.pc.connectionState == "disconnected":
                await self._close_callback(self.id)
        except asyncio.CancelledError:
            pass

    def _cancel_disconnect_timer(self) -> None:
        task = self._disconnect_task
        self._disconnect_task = None
        if task is not None and task is not asyncio.current_task():
            task.cancel()

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._cancel_disconnect_timer()

        if self._analyzer is not None:
            await self._analyzer.stop()
            self._analyzer = None

        channel = self._data_channel
        self._data_channel = None
        if channel is not None:
            with contextlib.suppress(Exception):
                channel.close()

        await asyncio.to_thread(self._processor.close)
        with contextlib.suppress(Exception):
            await self.pc.close()
