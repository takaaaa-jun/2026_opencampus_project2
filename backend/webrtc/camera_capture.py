"""バックエンドが所有するカメラ入力。"""

from __future__ import annotations

import threading

import cv2
import numpy as np


class CameraCapture:
    """Webカメラを1回だけ開き、最新フレームを返す。"""

    def __init__(self, device_index: int = 0) -> None:
        self._lock = threading.Lock()
        self._capture = cv2.VideoCapture(device_index)

        if not self._capture.isOpened():
            self._capture.release()
            raise RuntimeError("カメラを起動できませんでした。")

        self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    def read(self) -> np.ndarray:
        """左右反転済みのBGRフレームを返す。"""
        with self._lock:
            if self._capture is None:
                raise RuntimeError("カメラは停止しています。")

            success, frame = self._capture.read()

        if not success:
            raise RuntimeError("カメラ映像を取得できませんでした。")

        return cv2.flip(frame, 1)

    def close(self) -> None:
        with self._lock:
            if self._capture is not None:
                self._capture.release()
                self._capture = None
