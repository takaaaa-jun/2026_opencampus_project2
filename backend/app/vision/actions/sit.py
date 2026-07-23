from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from app.vision.shared.geometry import angle, clamp

Landmark = Mapping[str, float]
Pose = Mapping[str, Any] | None


@dataclass
class SitDetector:
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

        left_angle = angle(landmarks[23], landmarks[25], landmarks[27])
        right_angle = angle(landmarks[24], landmarks[26], landmarks[28])
        average_angle = (left_angle + right_angle) / 2.0
        hip_y = (float(landmarks[23]['y']) + float(landmarks[24]['y'])) / 2.0
        knee_y = (float(landmarks[25]['y']) + float(landmarks[26]['y'])) / 2.0
        hip_above_knee = hip_y < knee_y

        bend_score = clamp((165.0 - average_angle) / 65.0)
        confidence = bend_score * (1.0 if hip_above_knee else 0.5)
        active = average_angle < 135.0 and hip_above_knee
        return active, confidence, {
            'leftKneeAngleDeg': round(left_angle, 1),
            'rightKneeAngleDeg': round(right_angle, 1),
            'averageKneeAngleDeg': round(average_angle, 1),
            'hipAboveKnee': hip_above_knee,
        }
