"""バックエンドで取得した映像をWebRTC映像トラックとして送る。"""

from __future__ import annotations

from aiortc.mediastreams import MediaStreamError, VideoStreamTrack
from av import VideoFrame

from .camera_capture import CameraCapture


class CameraVideoTrack(VideoStreamTrack):
    """バックエンドのカメラ映像を送信する映像トラック。"""

    def __init__(self, camera_capture: CameraCapture) -> None:
        super().__init__()
        self._camera_capture = camera_capture

    async def recv(self) -> VideoFrame:
        pts, time_base = await self.next_timestamp()

        try:
            image = self._camera_capture.read()
        except RuntimeError as error:
            raise MediaStreamError(str(error)) from error

        frame = VideoFrame.from_ndarray(image, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame

    def stop(self) -> None:
        self._camera_capture.close()
        super().stop()
