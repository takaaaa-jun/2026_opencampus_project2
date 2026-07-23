from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from app.vision.shared.geometry import clamp, distance

Landmark = Mapping[str, float]
Hand = Mapping[str, Any]


@dataclass
class ClapDetector:
    threshold: float = 0.12

    def update_config(self, config: Mapping[str, Any]) -> None:
        threshold = config.get('clapThreshold')
        if isinstance(threshold, (int, float)):
            self.threshold = clamp(float(threshold), 0.03, 0.5)

    def evaluate(self, hands: Sequence[Hand]) -> tuple[bool, float, dict[str, Any]]:
        if len(hands) < 2:
            return False, 0.0, {
                'middleFingertipDistance': None,
                'threshold': self.threshold,
                'detectedHands': len(hands),
            }

        first = hands[0].get('landmarks', [])
        second = hands[1].get('landmarks', [])
        if len(first) < 13 or len(second) < 13:
            return False, 0.0, {
                'middleFingertipDistance': None,
                'threshold': self.threshold,
                'detectedHands': len(hands),
            }

        middle_distance = distance(first[12], second[12])
        active = middle_distance < self.threshold
        confidence = clamp(1.0 - middle_distance / max(self.threshold, 1e-6)) if active else 0.0
        return active, confidence, {
            'middleFingertipDistance': round(middle_distance, 4),
            'threshold': round(self.threshold, 4),
            'detectedHands': len(hands),
        }
