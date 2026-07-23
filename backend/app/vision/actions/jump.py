from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from app.vision.shared.geometry import clamp

Landmark = Mapping[str, float]
Pose = Mapping[str, Any] | None


@dataclass
class JumpDetector:
    ankle_baseline_y: float | None = None

    def reset(self) -> None:
        self.ankle_baseline_y = None

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
            return False, 0.0, {
                'reason': 'pose_not_detected',
                'baselineY': self.ankle_baseline_y,
            }

        ankle_y = (float(landmarks[27]['y']) + float(landmarks[28]['y'])) / 2.0
        if self.ankle_baseline_y is None:
            self.ankle_baseline_y = ankle_y

        lift = self.ankle_baseline_y - ankle_y
        active = lift > 0.06
        confidence = clamp((lift - 0.03) / 0.09)

        if not active:
            self.ankle_baseline_y = 0.97 * self.ankle_baseline_y + 0.03 * ankle_y

        return active, confidence, {
            'ankleY': round(ankle_y, 4),
            'baselineY': round(self.ankle_baseline_y, 4),
            'verticalLift': round(lift, 4),
            'threshold': 0.06,
        }
