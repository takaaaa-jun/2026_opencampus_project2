"""MediaPipeの検知結果を骨格映像として描画する。"""

from __future__ import annotations

import numpy as np

from .mediapipe_detector import MediaPipeDetector


class SkeletonRenderer:
    def __init__(self, detector: MediaPipeDetector) -> None:
        self._detector = detector

    def render(self, camera_frame: np.ndarray, pose_results, hands_results) -> np.ndarray:
        """カメラ映像を変更せず、骨格を重ねた別フレームを返す。"""
        skeleton_frame = camera_frame.copy()

        if pose_results.pose_landmarks:
            self._detector.drawing_utils.draw_landmarks(
                skeleton_frame,
                pose_results.pose_landmarks,
                self._detector.pose_connections,
            )

        if hands_results.multi_hand_landmarks:
            for hand_landmarks in hands_results.multi_hand_landmarks:
                self._detector.drawing_utils.draw_landmarks(
                    skeleton_frame,
                    hand_landmarks,
                    self._detector.hand_connections,
                )

        return skeleton_frame
