from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any, Mapping

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from app.core.config import Settings
from app.vision.action_engine import ActionEngine


class MediaPipeProcessor:
    def __init__(
        self,
        hand_model_path: Path,
        pose_model_path: Path,
        clap_threshold: float,
        mirrored: bool,
    ) -> None:
        missing = [
            path
            for path in (hand_model_path, pose_model_path)
            if not path.is_file()
        ]
        if missing:
            joined = ", ".join(str(path) for path in missing)
            raise FileNotFoundError(
                f"MediaPipe model file not found: {joined}. "
                "Run `python scripts/download_models.py` from backend/."
            )

        hand_options = vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(
                model_asset_path=str(hand_model_path)
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        pose_options = vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(
                model_asset_path=str(pose_model_path)
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_segmentation_masks=False,
        )

        self._hand_landmarker = vision.HandLandmarker.create_from_options(
            hand_options
        )
        self._pose_landmarker = vision.PoseLandmarker.create_from_options(
            pose_options
        )
        self._actions = ActionEngine(clap_threshold=clap_threshold)
        self._mirrored = mirrored
        self._last_timestamp_ms = 0
        self._frame_id = 0
        self._lock = threading.RLock()
        self._closed = False

    @classmethod
    def from_settings(cls, settings: Settings) -> "MediaPipeProcessor":
        return cls(
            hand_model_path=settings.hand_landmarker_model,
            pose_model_path=settings.pose_landmarker_model,
            clap_threshold=settings.clap_threshold,
            mirrored=settings.frame_is_mirrored_in_ui,
        )

    def update_config(self, config: Mapping[str, Any]) -> None:
        with self._lock:
            if self._closed:
                return
            self._actions.update_config(config)

    def process(
        self,
        frame_rgb: np.ndarray,
        received_at_ms: int,
    ) -> dict[str, Any]:
        with self._lock:
            if self._closed:
                raise RuntimeError("MediaPipeProcessor is closed.")
            return self._process_locked(frame_rgb, received_at_ms)

    def _process_locked(
        self,
        frame_rgb: np.ndarray,
        received_at_ms: int,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        height, width = frame_rgb.shape[:2]

        timestamp_ms = max(
            int(time.monotonic_ns() // 1_000_000),
            self._last_timestamp_ms + 1,
        )
        self._last_timestamp_ms = timestamp_ms

        image = np.ascontiguousarray(frame_rgb, dtype=np.uint8)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image)
        hand_result = self._hand_landmarker.detect_for_video(
            mp_image,
            timestamp_ms,
        )
        pose_result = self._pose_landmarker.detect_for_video(
            mp_image,
            timestamp_ms,
        )

        pose = self._serialize_pose(pose_result)
        hands = self._serialize_hands(hand_result)
        actions = self._actions.evaluate(pose, hands)

        self._frame_id += 1
        processed_at_ms = int(time.time() * 1000)
        return {
            "type": "detection",
            "schemaVersion": 1,
            "frame": {
                "id": self._frame_id,
                "receivedAtMs": received_at_ms,
                "processedAtMs": processed_at_ms,
                "processingTimeMs": round(
                    (time.perf_counter() - started) * 1000.0,
                    2,
                ),
                "width": int(width),
                "height": int(height),
                "mirrored": self._mirrored,
            },
            "pose": pose,
            "hands": hands,
            "actions": actions,
        }

    @staticmethod
    def _serialize_pose(result: Any) -> dict[str, Any] | None:
        if not result.pose_landmarks:
            return None
        landmarks = result.pose_landmarks[0]
        return {
            "landmarks": [
                {
                    "x": float(landmark.x),
                    "y": float(landmark.y),
                    "z": float(landmark.z),
                    "visibility": float(
                        getattr(landmark, "visibility", 0.0) or 0.0
                    ),
                    "presence": float(
                        getattr(landmark, "presence", 0.0) or 0.0
                    ),
                }
                for landmark in landmarks
            ]
        }

    @staticmethod
    def _serialize_hands(result: Any) -> list[dict[str, Any]]:
        hands: list[dict[str, Any]] = []
        handedness_list = result.handedness or []
        for index, landmarks in enumerate(result.hand_landmarks or []):
            handedness = "unknown"
            if index < len(handedness_list) and handedness_list[index]:
                category = handedness_list[index][0]
                handedness = str(
                    getattr(category, "category_name", "unknown")
                ).lower()
            hands.append(
                {
                    "handedness": handedness,
                    "landmarks": [
                        {
                            "x": float(landmark.x),
                            "y": float(landmark.y),
                            "z": float(landmark.z),
                        }
                        for landmark in landmarks
                    ],
                }
            )
        return hands

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            self._hand_landmarker.close()
            self._pose_landmarker.close()
