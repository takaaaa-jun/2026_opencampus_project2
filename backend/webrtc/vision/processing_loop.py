"""カメラ取得からMediaPipe検知・WebRTC送信までを実行する処理ループ。"""

from __future__ import annotations

import threading
from collections.abc import Callable

import numpy as np

from ..detection.action_evaluator import ActionEvaluator
from ..detection.serializer import serialize_detection
from .camera import CameraCapture
from .mediapipe_detector import MediaPipeDetector
from .skeleton_renderer import SkeletonRenderer


class LatestFrameStore:
    """映像トラックが読む最新の1フレームだけを保持する。"""

    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._frame: np.ndarray | None = None

    def publish(self, frame: np.ndarray) -> None:
        with self._condition:
            self._frame = frame.copy()
            self._condition.notify_all()

    def get_latest(self) -> np.ndarray:
        with self._condition:
            while self._frame is None:
                self._condition.wait()
            return self._frame.copy()


class ProcessingLoop:
    """カメラを唯一所有し、同じフレームから映像と検知データを生成する。"""

    def __init__(self, send_detection: Callable[[dict], None]) -> None:
        self.camera_frames = LatestFrameStore()
        self.skeleton_frames = LatestFrameStore()
        self._send_detection = send_detection
        self._capture = CameraCapture()
        self._detector = MediaPipeDetector()
        self._renderer = SkeletonRenderer(self._detector)
        self._action_evaluator = ActionEvaluator()
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True, name="camera-processing")

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=2)
        self._detector.close()
        self._capture.close()

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                camera_frame = self._capture.read()
                pose_results, hands_results = self._detector.detect(camera_frame)
                actions, action_details = self._action_evaluator.evaluate(pose_results, hands_results)
                skeleton_frame = self._renderer.render(camera_frame, pose_results, hands_results)
                payload = serialize_detection(pose_results, hands_results, actions, action_details)
            except RuntimeError:
                break

            self.camera_frames.publish(camera_frame)
            self.skeleton_frames.publish(skeleton_frame)
            self._send_detection(payload)
