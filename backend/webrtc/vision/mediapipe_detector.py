"""MediaPipe Pose・Handsによる骨格検知。"""

from __future__ import annotations

import numpy as np


class MediaPipeDetector:
    """1フレームからPoseとHandsの検知結果を返す。"""

    def __init__(self) -> None:
        # Django起動時ではなく、WebRTC接続開始時にMediaPipeを読み込む。
        import mediapipe as mp

        self._mp_pose = mp.solutions.pose
        self._mp_hands = mp.solutions.hands
        self.drawing_utils = mp.solutions.drawing_utils
        self.pose_connections = self._mp_pose.POSE_CONNECTIONS
        self.hand_connections = self._mp_hands.HAND_CONNECTIONS
        self._pose = self._mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._hands = self._mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def detect(self, frame: np.ndarray):
        """BGRフレームを解析し、PoseとHandsの検知結果を返す。"""
        import cv2

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return self._pose.process(rgb), self._hands.process(rgb)

    def close(self) -> None:
        self._pose.close()
        self._hands.close()
