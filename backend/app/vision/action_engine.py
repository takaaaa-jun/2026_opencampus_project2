from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from app.vision.actions import ClapDetector, GrabDetector, JumpDetector, SitDetector, TPoseDetector

Pose = Mapping[str, Any] | None
Hand = Mapping[str, Any]
ACTION_IDS = ('jump', 'sit', 'tpose', 'clap', 'grab')


def _action(
    active: bool,
    confidence: float,
    metrics: Mapping[str, Any],
    triggered: bool,
) -> dict[str, Any]:
    return {
        'active': bool(active),
        'triggered': bool(triggered),
        'confidence': round(max(0.0, min(1.0, float(confidence))), 4),
        'metrics': dict(metrics),
    }


@dataclass
class ActionEngine:
    clap: ClapDetector = field(default_factory=ClapDetector)
    jump: JumpDetector = field(default_factory=JumpDetector)
    sit: SitDetector = field(default_factory=SitDetector)
    tpose: TPoseDetector = field(default_factory=TPoseDetector)
    grab: GrabDetector = field(default_factory=GrabDetector)
    previous_active: dict[str, bool] = field(
        default_factory=lambda: {key: False for key in ACTION_IDS}
    )

    def update_config(self, config: Mapping[str, Any]) -> None:
        self.clap.update_config(config)

    def reset(self) -> None:
        self.previous_active = {key: False for key in ACTION_IDS}
        self.jump.reset()

    def evaluate(
        self,
        pose: Pose,
        hands: Sequence[Hand],
    ) -> dict[str, dict[str, Any]]:
        evaluations = {
            'jump': self.jump.evaluate(pose),
            'sit': self.sit.evaluate(pose),
            'tpose': self.tpose.evaluate(pose),
            'clap': self.clap.evaluate(hands),
            'grab': self.grab.evaluate(hands),
        }

        results: dict[str, dict[str, Any]] = {}
        for action_id, (active, confidence, metrics) in evaluations.items():
            triggered = active and not self.previous_active[action_id]
            self.previous_active[action_id] = active
            results[action_id] = _action(active, confidence, metrics, triggered)
        return results
