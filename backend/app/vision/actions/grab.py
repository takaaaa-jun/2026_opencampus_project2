from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from app.vision.shared.geometry import clamp, distance

Hand = Mapping[str, Any]


@dataclass
class GrabDetector:
    def evaluate(self, hands: Sequence[Hand]) -> tuple[bool, float, dict[str, Any]]:
        hand_metrics: list[dict[str, Any]] = []
        best_confidence = 0.0
        any_grab = False

        for hand in hands:
            landmarks = hand.get('landmarks', [])
            if len(landmarks) < 21:
                continue
            wrist = landmarks[0]
            palm_scale = max(distance(wrist, landmarks[9]), 1e-6)
            ratios = [
                distance(wrist, landmarks[index]) / palm_scale
                for index in (8, 12, 16, 20)
            ]
            average_ratio = sum(ratios) / len(ratios)
            active = average_ratio < 2.0
            confidence = clamp((2.35 - average_ratio) / 0.7)
            best_confidence = max(best_confidence, confidence)
            any_grab = any_grab or active
            hand_metrics.append(
                {
                    'handedness': hand.get('handedness', 'unknown'),
                    'averageFingertipRadiusRatio': round(average_ratio, 4),
                    'threshold': 2.0,
                    'active': active,
                }
            )

        return any_grab, best_confidence if any_grab else 0.0, {
            'hands': hand_metrics,
            'detectedHands': len(hands),
        }
