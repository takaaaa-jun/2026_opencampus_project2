"""バックエンドで取得した映像をWebRTC映像トラックとして送る。"""

from __future__ import annotations

import asyncio

from aiortc.mediastreams import MediaStreamError, VideoStreamTrack
from av import VideoFrame

from ..vision.processing_loop import LatestFrameStore


class LatestFrameVideoTrack(VideoStreamTrack):
    """処理ループが生成した最新フレームを送信する映像トラック。"""

    def __init__(self, frame_store: LatestFrameStore) -> None:
        super().__init__()
        self._frame_store = frame_store

    async def recv(self) -> VideoFrame:
        pts, time_base = await self.next_timestamp()

        try:
            image = await asyncio.to_thread(self._frame_store.get_latest)
        except RuntimeError as error:
            raise MediaStreamError(str(error)) from error

        frame = VideoFrame.from_ndarray(image, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


class CameraVideoTrack(LatestFrameVideoTrack):
    """カメラ映像を送信する映像トラック。"""


class SkeletonVideoTrack(LatestFrameVideoTrack):
    """骨格映像を送信する映像トラック。"""
