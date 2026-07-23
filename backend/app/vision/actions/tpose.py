from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from app.vision.shared.geometry import angle, clamp

Landmark = Mapping[str, float]
Pose = Mapping[str, Any] | None


@dataclass
class TPoseDetector:
    @staticmethod
    def _pose_landmarks(pose: Pose) -> Sequence[Landmark] | None:
        if not pose:
            return None
        landmarks = pose.get('landmarks')
        if not isinstance(landmarks, Sequence) or len(landmarks) < 33:
            return None
        return landmarks

    def evaluate(self, pose: Pose) -> tuple[bool, float, dict[str, Any]]:
        landmarks = self._pose_landmarks(pose)
        if landmarks is None:
            return False, 0.0, {'reason': 'pose_not_detected'}

        left_shoulder, right_shoulder = landmarks[11], landmarks[12]
        left_elbow, right_elbow = landmarks[13], landmarks[14]
        left_wrist, right_wrist = landmarks[15], landmarks[16]

        left_angle = angle(left_shoulder, left_elbow, left_wrist)
        right_angle = angle(right_shoulder, right_elbow, right_wrist)
        left_height_error = abs(float(left_wrist['y']) - float(left_shoulder['y']))
        right_height_error = abs(float(right_wrist['y']) - float(right_shoulder['y']))
        outward = (
            float(left_wrist['x']) > float(left_shoulder['x'])
            and float(right_wrist['x']) < float(right_shoulder['x'])
        )

        straight_score = clamp((min(left_angle, right_angle) - 130.0) / 40.0)
        horizontal_score = clamp(1.0 - max(left_height_error, right_height_error) / 0.18)
        confidence = straight_score * horizontal_score * (1.0 if outward else 0.4)
        active = (
            left_angle > 155.0
            and right_angle > 155.0
            and left_height_error < 0.12
            and right_height_error < 0.12
            and outward
        )
        return active, confidence, {
            'leftElbowAngleDeg': round(left_angle, 1),
            'rightElbowAngleDeg': round(right_angle, 1),
            'leftWristHeightError': round(left_height_error, 4),
            'rightWristHeightError': round(right_height_error, 4),
            'armsPointOutward': outward,
        }
