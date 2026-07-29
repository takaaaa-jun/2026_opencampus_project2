"""十字腕と同じ要領で、腕上げ判定の途中値と結果を管理する。"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Literal, Sequence

from .geometry import point_xy, segment_distance

ArmSide = Literal["left", "right"]

HISTORY_WINDOW = 10
FIRST_AVG_WINDOW = 3
LAST_AVG_WINDOW = 3
DEFAULT_THRESHOLD = 0.1

@dataclass(frozen=True, slots=True)
class HandEvaluation:
    """片手分の途中値と条件結果。"""

    current_x: float | None = None
    current_y: float | None = None
    shoulder_x: float | None = None
    shoulder_y: float | None = None
    history: list[float] = field(default_factory=list)
    history_x: list[float] = field(default_factory=list)
    history_shoulder_x: list[float] = field(default_factory=list)
    history_shoulder_y: list[float] = field(default_factory=list)
    start_avg: float | None = None
    end_avg: float | None = None
    dy: float | None = None
    above_shoulder: bool | None = None
    passed_dy: bool | None = None
    ok: bool | None = None

    def to_payload(self) -> dict[str, object]:
        return {
            "currentX": self.current_x,
            "currentY": self.current_y,
            "shoulderX": self.shoulder_x,
            "shoulderY": self.shoulder_y,
            "history": self.history,
            "historyX": self.history_x,
            "historyShoulderX": self.history_shoulder_x,
            "historyShoulderY": self.history_shoulder_y,
            "startAvg": self.start_avg,
            "endAvg": self.end_avg,
            "dy": self.dy,
            "aboveShoulder": self.above_shoulder,
            "passedDy": self.passed_dy,
            "ok": self.ok,
        }


@dataclass(frozen=True, slots=True)
class UpperEvaluation:
    """1フレーム分の腕上げ判定結果。"""

    pose_detected: bool = False
    result: bool = False
    threshold: float = DEFAULT_THRESHOLD
    frame_height: float | None = None

    left: HandEvaluation = field(default_factory=HandEvaluation)
    right: HandEvaluation = field(default_factory=HandEvaluation)

    shoulder_width: float | None = None
    rise_threshold: float | None = None
    shoulder_reach_margin: float | None = None

    left_rises_enough: bool | None = None
    right_rises_enough: bool | None = None
    left_starts_below_shoulder: bool | None = None
    right_starts_below_shoulder: bool | None = None
    left_ends_near_or_above_shoulder: bool | None = None
    right_ends_near_or_above_shoulder: bool | None = None
    left_between_shoulders: bool | None = None
    right_between_shoulders: bool | None = None

    def to_payload(self) -> dict[str, object]:
        """フロントエンドへ送る camelCase 形式。"""

        return {
            "poseDetected": self.pose_detected,
            "result": self.result,
            "isOk": self.result,
            "ok": self.result,
            "threshold": self.threshold,
            "frameHeight": self.frame_height,
            "shoulderWidth": self.shoulder_width,
            "riseThreshold": self.rise_threshold,
            "shoulderReachMargin": self.shoulder_reach_margin,
            "leftRisesEnough": self.right_rises_enough,
            "rightRisesEnough": self.left_rises_enough,
            "leftStartsBelowShoulder": self.right_starts_below_shoulder,
            "rightStartsBelowShoulder": self.left_starts_below_shoulder,
            "leftEndsNearOrAboveShoulder": self.right_ends_near_or_above_shoulder,
            "rightEndsNearOrAboveShoulder": self.left_ends_near_or_above_shoulder,
            "leftBetweenShoulders": self.right_between_shoulders,
            "rightBetweenShoulders": self.left_between_shoulders,
            "left": self.right.to_payload(),
            "right": self.left.to_payload(),
            "leftHand": self.right.to_payload(),
            "rightHand": self.left.to_payload(),
        }


@dataclass
class _FrameSample:
    left_wrist_x: float | None = None
    left_wrist_y: float | None = None
    right_wrist_x: float | None = None
    right_wrist_y: float | None = None
    left_shoulder_x: float | None = None
    left_shoulder_y: float | None = None
    right_shoulder_x: float | None = None
    right_shoulder_y: float | None = None

    @property
    def shoulder_y(self) -> float | None:
        values = [value for value in (self.left_shoulder_y, self.right_shoulder_y) if value is not None]
        if not values:
            return None
        return sum(values) / len(values)


class UpperDetector:
    """腕上げの途中値を計算し、最新状態を保持する。"""

    LEFT_WRIST = 15
    LEFT_SHOULDER = 11
    RIGHT_WRIST = 16
    RIGHT_SHOULDER = 12

    def __init__(
        self,
        threshold: float = DEFAULT_THRESHOLD,
        frame_height: float | None = None,
    ) -> None:
        self._threshold = threshold
        self._frame_height = frame_height
        self._left_samples: Deque[_FrameSample] = deque(maxlen=HISTORY_WINDOW)
        self._right_samples: Deque[_FrameSample] = deque(maxlen=HISTORY_WINDOW)
        self._state = self._empty_state()

    @property
    def state(self) -> UpperEvaluation:
        return self._state

    def reset(self) -> UpperEvaluation:
        self._left_samples.clear()
        self._right_samples.clear()
        self._state = self._empty_state()
        return self._state

    def update(self, landmarks: Sequence[object] | None, frame_height: float | None = None) -> UpperEvaluation:
        """ランドマークから最新の腕上げ判定を作る。"""

        if not landmarks or len(landmarks) <= self.RIGHT_SHOULDER:
            self._state = self._empty_state()
            return self._state

        if frame_height is not None:
            self._frame_height = frame_height

        left_wrist = landmarks[self.LEFT_WRIST]
        left_shoulder = landmarks[self.LEFT_SHOULDER]
        right_wrist = landmarks[self.RIGHT_WRIST]
        right_shoulder = landmarks[self.RIGHT_SHOULDER]

        left_wrist_x, left_wrist_y = point_xy(left_wrist)
        left_shoulder_x, left_shoulder_y = point_xy(left_shoulder)
        right_wrist_x, right_wrist_y = point_xy(right_wrist)
        right_shoulder_x, right_shoulder_y = point_xy(right_shoulder)

        self._left_samples.append(
            _FrameSample(
                left_wrist_x=left_wrist_x,
                left_wrist_y=left_wrist_y,
                left_shoulder_x=left_shoulder_x,
                left_shoulder_y=left_shoulder_y,
                right_shoulder_x=right_shoulder_x,
                right_shoulder_y=right_shoulder_y,
            )
        )
        self._right_samples.append(
            _FrameSample(
                right_wrist_x=right_wrist_x,
                right_wrist_y=right_wrist_y,
                left_shoulder_x=left_shoulder_x,
                left_shoulder_y=left_shoulder_y,
                right_shoulder_x=right_shoulder_x,
                right_shoulder_y=right_shoulder_y,
            )
        )

        left = self._resolve_hand("left", list(self._left_samples), self._threshold)
        right = self._resolve_hand("right", list(self._right_samples), self._threshold)

        left_between_shoulders = self._resolve_between_shoulders(list(self._left_samples))
        right_between_shoulders = self._resolve_between_shoulders(list(self._right_samples))

        left_rises_enough = self._rises_enough(left)
        right_rises_enough = self._rises_enough(right)

        left_starts_below_shoulder = self._starts_below_shoulder(left)
        right_starts_below_shoulder = self._starts_below_shoulder(right)

        left_ends_near_or_above_shoulder = self._ends_near_or_above_shoulder(left)
        right_ends_near_or_above_shoulder = self._ends_near_or_above_shoulder(right)

        left_ok = bool(
            left_rises_enough
            and left_starts_below_shoulder
            and left_ends_near_or_above_shoulder
            and left_between_shoulders
        )
        right_ok = bool(
            right_rises_enough
            and right_starts_below_shoulder
            and right_ends_near_or_above_shoulder
            and right_between_shoulders
        )

        result = left_ok or right_ok

        shoulder_width = self._resolve_shoulder_width(list(self._left_samples) or list(self._right_samples))
        rise_threshold = shoulder_width * 0.5 if shoulder_width is not None else None
        shoulder_reach_margin = shoulder_width * 0.1 if shoulder_width is not None else None

        self._state = UpperEvaluation(
            pose_detected=True,
            result=result,
            threshold=self._threshold,
            frame_height=self._frame_height,
            left=left,
            right=right,
            shoulder_width=shoulder_width,
            rise_threshold=rise_threshold,
            shoulder_reach_margin=shoulder_reach_margin,
            left_rises_enough=left_rises_enough,
            right_rises_enough=right_rises_enough,
            left_starts_below_shoulder=left_starts_below_shoulder,
            right_starts_below_shoulder=right_starts_below_shoulder,
            left_ends_near_or_above_shoulder=left_ends_near_or_above_shoulder,
            right_ends_near_or_above_shoulder=right_ends_near_or_above_shoulder,
            left_between_shoulders=left_between_shoulders,
            right_between_shoulders=right_between_shoulders,
        )
        return self._state

    def _empty_state(self) -> UpperEvaluation:
        return UpperEvaluation(threshold=self._threshold, frame_height=self._frame_height)

    @staticmethod
    def _to_float(value: object | None) -> float | None:
        if value is None:
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if math.isfinite(number):
            return number
        return None

    @classmethod
    def _landmark_xy(cls, landmark: object | None) -> tuple[float | None, float | None]:
        if landmark is None:
            return None, None
        x, y = point_xy(landmark)
        return cls._to_float(x), cls._to_float(y)

    @staticmethod
    def _avg(values: Sequence[float | None]) -> float | None:
        filtered = [value for value in values if value is not None]
        if not filtered:
            return None
        return sum(filtered) / len(filtered)

    def _resolve_history(self, samples: Sequence[_FrameSample], side: ArmSide) -> list[float]:
        if side == "left":
            values = [sample.left_wrist_y for sample in samples]
        else:
            values = [sample.right_wrist_y for sample in samples]
        return [value for value in values if value is not None][-HISTORY_WINDOW:]

    def _resolve_shoulder_history(self, samples: Sequence[_FrameSample], side: ArmSide) -> tuple[list[float], list[float]]:
        if side == "left":
            x_values = [sample.left_shoulder_x for sample in samples]
        else:
            x_values = [sample.right_shoulder_x for sample in samples]
        y_values = [sample.shoulder_y for sample in samples]
        return (
            [value for value in x_values if value is not None][-HISTORY_WINDOW:],
            [value for value in y_values if value is not None][-HISTORY_WINDOW:],
        )

    def _resolve_hand(self, side: ArmSide, samples: Sequence[_FrameSample], threshold: float) -> HandEvaluation:
        if not samples:
            return HandEvaluation()

        if side == "left":
            current_x = samples[-1].left_wrist_x
            current_y = samples[-1].left_wrist_y
            shoulder_x = samples[-1].left_shoulder_x
            shoulder_y = samples[-1].left_shoulder_y
        else:
            current_x = samples[-1].right_wrist_x
            current_y = samples[-1].right_wrist_y
            shoulder_x = samples[-1].right_shoulder_x
            shoulder_y = samples[-1].right_shoulder_y

        history = self._resolve_history(samples, side)
        history_shoulder_x, history_shoulder_y = self._resolve_shoulder_history(samples, side)
        history_x = [
            sample.left_wrist_x if side == "left" else sample.right_wrist_x
            for sample in samples
        ]
        history_x = [value for value in history_x if value is not None][-HISTORY_WINDOW:]

        start_avg = self._avg(history[:FIRST_AVG_WINDOW]) if len(history) >= FIRST_AVG_WINDOW else None
        end_avg = self._avg(history[-LAST_AVG_WINDOW:]) if len(history) >= LAST_AVG_WINDOW else None
        dy = start_avg - end_avg if start_avg is not None and end_avg is not None else None

        above_shoulder = (
            current_y < shoulder_y
            if current_y is not None and shoulder_y is not None
            else None
        )
        passed_dy = dy > threshold if dy is not None else None
        ok = bool(passed_dy and above_shoulder)

        return HandEvaluation(
            current_x=current_x,
            current_y=current_y,
            shoulder_x=shoulder_x,
            shoulder_y=shoulder_y,
            history=history,
            history_x=history_x,
            history_shoulder_x=history_shoulder_x,
            history_shoulder_y=history_shoulder_y,
            start_avg=start_avg,
            end_avg=end_avg,
            dy=dy,
            above_shoulder=above_shoulder,
            passed_dy=passed_dy,
            ok=ok,
        )

    def _starts_below_shoulder(self, hand: HandEvaluation) -> bool | None:
        if hand.start_avg is None or hand.shoulder_y is None:
            return None
        return hand.start_avg > hand.shoulder_y

    def _ends_near_or_above_shoulder(self, hand: HandEvaluation) -> bool | None:
        if hand.end_avg is None or hand.shoulder_y is None:
            return None
        margin = (self._resolve_shoulder_width(list(self._left_samples) or list(self._right_samples)) or 0.0) * 0.1
        return hand.end_avg <= hand.shoulder_y + margin

    def _rises_enough(self, hand: HandEvaluation) -> bool | None:
        if hand.start_avg is None or hand.end_avg is None:
            return None
        shoulder_width = self._resolve_shoulder_width(list(self._left_samples) or list(self._right_samples))
        if shoulder_width is None:
            return None
        threshold = shoulder_width * 0.5
        return (hand.start_avg - hand.end_avg) >= threshold

    def _resolve_shoulder_width(self, samples: Sequence[_FrameSample]) -> float | None:
        widths: list[float] = []
        for sample in samples:
            if sample.left_shoulder_x is None or sample.right_shoulder_x is None:
                continue
            widths.append(abs(sample.right_shoulder_x - sample.left_shoulder_x))
        return self._avg(widths)

    def _resolve_between_shoulders(self, samples: Sequence[_FrameSample]) -> bool | None:
        candidates = [
            sample
            for sample in samples
            if sample.left_shoulder_x is not None
            and sample.right_shoulder_x is not None
            and sample.shoulder_y is not None
        ]
        if not candidates:
            return None

        target = min(
            candidates,
            key=lambda sample: abs((sample.left_wrist_y or 0.0) - (sample.shoulder_y or 0.0)),
        )

        if target.left_shoulder_x is None or target.right_shoulder_x is None:
            return None
        wrist_x = target.left_wrist_x if target.left_wrist_x is not None else target.right_wrist_x
        if wrist_x is None:
            return None

        shoulder_width = abs(target.right_shoulder_x - target.left_shoulder_x)
        margin = shoulder_width * 0.1
        min_x = min(target.left_shoulder_x, target.right_shoulder_x) - margin
        max_x = max(target.left_shoulder_x, target.right_shoulder_x) + margin
        return min_x <= wrist_x <= max_x

    def _history_point(self, samples: Sequence[_FrameSample], side: ArmSide) -> list[float]:
        if side == "left":
            values = [sample.left_wrist_y for sample in samples]
        else:
            values = [sample.right_wrist_y for sample in samples]
        return [value for value in values if value is not None][-HISTORY_WINDOW:]

