from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import Callable
from typing import Any

from aiortc import MediaStreamTrack
from aiortc.mediastreams import MediaStreamError

from app.vision.processor import MediaPipeProcessor

logger = logging.getLogger(__name__)


class LatestFrameAnalyzer:
    """Consume a track continuously while keeping only the latest frame."""

    def __init__(
        self,
        track: MediaStreamTrack,
        processor: MediaPipeProcessor,
        on_result: Callable[[dict[str, Any]], None],
        max_analysis_fps: float = 15.0,
    ) -> None:
        self._track = track
        self._processor = processor
        self._on_result = on_result
        self._minimum_interval = 1.0 / max(max_analysis_fps, 1.0)
        self._queue: asyncio.Queue[tuple[Any, int] | None] = asyncio.Queue(
            maxsize=1
        )
        self._reader_task: asyncio.Task[None] | None = None
        self._worker_task: asyncio.Task[None] | None = None
        self._closed = False

    def start(self) -> None:
        if self._reader_task is not None:
            return
        self._reader_task = asyncio.create_task(
            self._reader(),
            name="webrtc-frame-reader",
        )
        self._worker_task = asyncio.create_task(
            self._worker(),
            name="webrtc-frame-worker",
        )

    async def _reader(self) -> None:
        try:
            while not self._closed:
                frame = await self._track.recv()
                item = (frame, int(time.time() * 1000))
                if self._queue.full():
                    with contextlib.suppress(asyncio.QueueEmpty):
                        self._queue.get_nowait()
                self._queue.put_nowait(item)
        except MediaStreamError:
            logger.info("Video track ended.")
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Video track reader failed.")
        finally:
            self._enqueue_stop_marker()

    async def _worker(self) -> None:
        last_started = 0.0
        try:
            while not self._closed:
                item = await self._queue.get()
                if item is None:
                    break

                elapsed = time.monotonic() - last_started
                if elapsed < self._minimum_interval:
                    await asyncio.sleep(self._minimum_interval - elapsed)

                while not self._queue.empty():
                    newer = self._queue.get_nowait()
                    if newer is None:
                        return
                    item = newer

                last_started = time.monotonic()
                frame, received_at_ms = item
                try:
                    frame_rgb = frame.to_ndarray(format="rgb24")
                    payload = await asyncio.to_thread(
                        self._processor.process,
                        frame_rgb,
                        received_at_ms,
                    )
                    self._on_result(payload)
                except Exception:
                    logger.exception("MediaPipe frame analysis failed.")
        except asyncio.CancelledError:
            pass

    def _enqueue_stop_marker(self) -> None:
        if self._queue.full():
            with contextlib.suppress(asyncio.QueueEmpty):
                self._queue.get_nowait()
        with contextlib.suppress(asyncio.QueueFull):
            self._queue.put_nowait(None)

    async def stop(self) -> None:
        if self._closed:
            return
        self._closed = True

        if self._reader_task is not None:
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._reader_task

        self._enqueue_stop_marker()

        if self._worker_task is not None:
            with contextlib.suppress(asyncio.CancelledError):
                await self._worker_task
