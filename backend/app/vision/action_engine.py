from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

Landmark = Mapping[str, float]
Pose = Mapping[str, Any] | None
Hand = Mapping[str, Any]

ACTION_IDS = ("jump", "sit", "tpose", "clap", "grab")


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _distance(a: Landmark, b: Landmark) -> float:
    return math.hypot(
        float(a["x"]) - float(b["x"]),
        float(a["y"]) - float(b["y"]),
    )


def _angle(a: Landmark, b: Landmark, c: Landmark) -> float:
    """Return angle ABC in degrees."""
    bax = float(a["x"]) - float(b["x"])
    bay = float(a["y"]) - float(b["y"])
    bcx = float(c["x"]) - float(b["x"])
    bcy = float(c["y"]) - float(b["y"])
    norm_a = math.hypot(bax, bay)
    norm_c = math.hypot(bcx, bcy)
    if norm_a < 1e-8 or norm_c < 1e-8:
        return 0.0
    cosine = _clamp(
        (bax * bcx + bay * bcy) / (norm_a * norm_c),
        -1.0,
        1.0,
    )
    return math.degrees(math.acos(cosine))


def _action(
    active: bool,
    confidence: float,
    metrics: Mapping[str, Any],
    triggered: bool,
) -> dict[str, Any]:
    return {
        "active": bool(active),
        "triggered": bool(triggered),
        "confidence": round(_clamp(float(confidence)), 4),
        "metrics": dict(metrics),
    }


@dataclass
class ActionEngine:
    clap_threshold: float = 0.12
    previous_active: dict[str, bool] = field(
        default_factory=lambda: {key: False for key in ACTION_IDS}
    )
    ankle_baseline_y: float | None = None

    def update_config(self, config: Mapping[str, Any]) -> None:
        threshold = config.get("clapThreshold")
        if isinstance(threshold, (int, float)):
            self.clap_threshold = _clamp(float(threshold), 0.03, 0.5)

    def evaluate(
        self,
        pose: Pose,
        hands: Sequence[Hand],
    ) -> dict[str, dict[str, Any]]:
        evaluations = {
            "jump": self._jump(pose),
            "sit": self._sit(pose),
            "tpose": self._tpose(pose),
            "clap": self._clap(hands),
            "grab": self._grab(hands),
        }

        results: dict[str, dict[str, Any]] = {}
        for action_id, (active, confidence, metrics) in evaluations.items():
            triggered = active and not self.previous_active[action_id]
            self.previous_active[action_id] = active
            results[action_id] = _action(
                active,
                confidence,
                metrics,
                triggered,
            )
        return results

    @staticmethod
    def _pose_landmarks(pose: Pose) -> Sequence[Landmark] | None:
        if not pose:
            return None
        landmarks = pose.get("landmarks")
        if not isinstance(landmarks, Sequence) or len(landmarks) < 33:
            return None
        return landmarks

    def _clap(
        self,
        hands: Sequence[Hand],
    ) -> tuple[bool, float, dict[str, Any]]:
        if len(hands) < 2:
            return False, 0.0, {
                "middleFingertipDistance": None,
                "threshold": self.clap_threshold,
                "detectedHands": len(hands),
            }

        first = hands[0].get("landmarks", [])
        second = hands[1].get("landmarks", [])
        if len(first) < 13 or len(second) < 13:
            return False, 0.0, {
                "middleFingertipDistance": None,
                "threshold": self.clap_threshold,
                "detectedHands": len(hands),
            }

        distance = _distance(first[12], second[12])
        active = distance < self.clap_threshold
        confidence = (
            _clamp(1.0 - distance / max(self.clap_threshold, 1e-6))
            if active
            else 0.0
        )
        return active, confidence, {
            "middleFingertipDistance": round(distance, 4),
            "threshold": round(self.clap_threshold, 4),
            "detectedHands": len(hands),
        }

    def _tpose(self, pose: Pose) -> tuple[bool, float, dict[str, Any]]:
        landmarks = self._pose_landmarks(pose)
        if landmarks is None:
            return False, 0.0, {"reason": "pose_not_detected"}

        left_shoulder, right_shoulder = landmarks[11], landmarks[12]
        left_elbow, right_elbow = landmarks[13], landmarks[14]
        left_wrist, right_wrist = landmarks[15], landmarks[16]

        left_angle = _angle(left_shoulder, left_elbow, left_wrist)
        right_angle = _angle(right_shoulder, right_elbow, right_wrist)
        left_height_error = abs(
            float(left_wrist["y"]) - float(left_shoulder["y"])
        )
        right_height_error = abs(
            float(right_wrist["y"]) - float(right_shoulder["y"])
        )
        outward = (
            float(left_wrist["x"]) > float(left_shoulder["x"])
            and float(right_wrist["x"]) < float(right_shoulder["x"])
        )

        straight_score = _clamp((min(left_angle, right_angle) - 130.0) / 40.0)
        horizontal_score = _clamp(
            1.0 - max(left_height_error, right_height_error) / 0.18
        )
        confidence = straight_score * horizontal_score * (1.0 if outward else 0.4)
        active = (
            left_angle > 155.0
            and right_angle > 155.0
            and left_height_error < 0.12
            and right_height_error < 0.12
            and outward
        )
        return active, confidence, {
            "leftElbowAngleDeg": round(left_angle, 1),
            "rightElbowAngleDeg": round(right_angle, 1),
            "leftWristHeightError": round(left_height_error, 4),
            "rightWristHeightError": round(right_height_error, 4),
            "armsPointOutward": outward,
        }

    def _sit(self, pose: Pose) -> tuple[bool, float, dict[str, Any]]:
        landmarks = self._pose_landmarks(pose)
        if landmarks is None:
            return False, 0.0, {"reason": "pose_not_detected"}

        left_angle = _angle(landmarks[23], landmarks[25], landmarks[27])
        right_angle = _angle(landmarks[24], landmarks[26], landmarks[28])
        average_angle = (left_angle + right_angle) / 2.0
        hip_y = (
            float(landmarks[23]["y"]) + float(landmarks[24]["y"])
        ) / 2.0
        knee_y = (
            float(landmarks[25]["y"]) + float(landmarks[26]["y"])
        ) / 2.0
        hip_above_knee = hip_y < knee_y

        bend_score = _clamp((165.0 - average_angle) / 65.0)
        confidence = bend_score * (1.0 if hip_above_knee else 0.5)
        active = average_angle < 135.0 and hip_above_knee
        return active, confidence, {
            "leftKneeAngleDeg": round(left_angle, 1),
            "rightKneeAngleDeg": round(right_angle, 1),
            "averageKneeAngleDeg": round(average_angle, 1),
            "hipAboveKnee": hip_above_knee,
        }

    def _jump(self, pose: Pose) -> tuple[bool, float, dict[str, Any]]:
        landmarks = self._pose_landmarks(pose)
        if landmarks is None:
            return False, 0.0, {
                "reason": "pose_not_detected",
                "baselineY": self.ankle_baseline_y,
            }

        ankle_y = (
            float(landmarks[27]["y"]) + float(landmarks[28]["y"])
        ) / 2.0
        if self.ankle_baseline_y is None:
            self.ankle_baseline_y = ankle_y

        lift = self.ankle_baseline_y - ankle_y
        active = lift > 0.06
        confidence = _clamp((lift - 0.03) / 0.09)

        if not active:
            self.ankle_baseline_y = 0.97 * self.ankle_baseline_y + 0.03 * ankle_y

        return active, confidence, {
            "ankleY": round(ankle_y, 4),
            "baselineY": round(self.ankle_baseline_y, 4),
            "verticalLift": round(lift, 4),
            "threshold": 0.06,
        }

    def _grab(
        self,
        hands: Sequence[Hand],
    ) -> tuple[bool, float, dict[str, Any]]:
        hand_metrics: list[dict[str, Any]] = []
        best_confidence = 0.0
        any_grab = False

        for hand in hands:
            landmarks = hand.get("landmarks", [])
            if len(landmarks) < 21:
                continue
            wrist = landmarks[0]
            palm_scale = max(_distance(wrist, landmarks[9]), 1e-6)
            ratios = [
                _distance(wrist, landmarks[index]) / palm_scale
                for index in (8, 12, 16, 20)
            ]
            average_ratio = sum(ratios) / len(ratios)
            active = average_ratio < 2.0
            confidence = _clamp((2.35 - average_ratio) / 0.7)
            best_confidence = max(best_confidence, confidence)
            any_grab = any_grab or active
            hand_metrics.append(
                {
                    "handedness": hand.get("handedness", "unknown"),
                    "averageFingertipRadiusRatio": round(average_ratio, 4),
                    "threshold": 2.0,
                    "active": active,
                }
            )

        return any_grab, best_confidence if any_grab else 0.0, {
            "hands": hand_metrics,
            "detectedHands": len(hands),
        }
