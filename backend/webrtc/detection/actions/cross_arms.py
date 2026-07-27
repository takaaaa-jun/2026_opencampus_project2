"""十字腕判定の途中値と結果を管理する。"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

from .geometry import point_xy, segment_distance

ArmRole = Literal["horizontal", "vertical"]
CrossArmsPattern = Literal["left-horizontal", "left-vertical"]

ARM_TOLERANCE_DEG = 30.0
DISTANCE_THRESHOLD = 0.1


@dataclass(frozen=True, slots=True)
class ArmEvaluation:
    """片腕の角度、担当する役割、その条件を満たすかを表す。"""

    angle: float = 0.0
    display_angle: float = 0.0
    role: ArmRole = "horizontal"
    role_ok: bool = False


@dataclass(frozen=True, slots=True)
class CrossArmsEvaluation:
    """1フレーム分の十字腕判定結果。"""

    pose_detected: bool = False
    result: bool = False
    active_pattern: CrossArmsPattern = "left-horizontal"
    left: ArmEvaluation = field(default_factory=ArmEvaluation)
    right: ArmEvaluation = field(
        default_factory=lambda: ArmEvaluation(role="vertical")
    )
    forearm_distance: float = 0.0
    distance_threshold: float = DISTANCE_THRESHOLD
    distance_ok: bool = False
    angle_tolerance_deg: float = ARM_TOLERANCE_DEG

    def to_payload(self) -> dict[str, object]:
        """フロントエンドへ送信しやすいcamelCase形式へ変換する。"""

        return {
            "poseDetected": self.pose_detected,
            "result": self.result,
            "activePattern": self.active_pattern,
            "leftAngle": self.right.angle,
            "rightAngle": self.left.angle,
            "displayLeftAngle": self.right.display_angle,
            "displayRightAngle": self.left.display_angle,
            "leftRole": self.right.role,
            "rightRole": self.left.role,
            "leftRoleOk": self.right.role_ok,
            "rightRoleOk": self.left.role_ok,
            "forearmDistance": self.forearm_distance,
            "distanceThreshold": self.distance_threshold,
            "distanceOk": self.distance_ok,
            "angleToleranceDeg": self.angle_tolerance_deg,
        }


class CrossArmsDetector:
    """十字腕の途中値を計算し、最新状態を保持する。"""

    def __init__(
        self,
        arm_tolerance_deg: float = ARM_TOLERANCE_DEG,
        distance_threshold: float = DISTANCE_THRESHOLD,
    ) -> None:
        self._arm_tolerance_deg = arm_tolerance_deg
        self._distance_threshold = distance_threshold
        self._state = self._empty_state()

    @property
    def state(self) -> CrossArmsEvaluation:
        return self._state

    def reset(self) -> CrossArmsEvaluation:
        self._state = self._empty_state()
        return self._state

    def update(self, landmarks) -> CrossArmsEvaluation:
        """ランドマークから最新の十字腕判定を作る。"""

        left_elbow, right_elbow = landmarks[13], landmarks[14]
        left_wrist, right_wrist = landmarks[15], landmarks[16]

        left_angle = self._forearm_angle(left_elbow, left_wrist)
        right_angle = self._forearm_angle(right_elbow, right_wrist)

        left_horizontal_ok = self._is_horizontal(left_angle)
        left_vertical_ok = self._is_vertical(left_angle)
        right_horizontal_ok = self._is_horizontal(right_angle)
        right_vertical_ok = self._is_vertical(right_angle)

        left_horizontal_score = self._role_distance(left_angle, "horizontal")
        left_vertical_score = self._role_distance(left_angle, "vertical")
        right_horizontal_score = self._role_distance(right_angle, "horizontal")
        right_vertical_score = self._role_distance(right_angle, "vertical")

        score_left_horizontal = left_horizontal_score + right_vertical_score
        score_left_vertical = left_vertical_score + right_horizontal_score

        if score_left_horizontal <= score_left_vertical:
            active_pattern: CrossArmsPattern = "left-horizontal"
            left_role: ArmRole = "horizontal"
            right_role: ArmRole = "vertical"
            left_role_ok = left_horizontal_ok
            right_role_ok = right_vertical_ok
        else:
            active_pattern = "left-vertical"
            left_role = "vertical"
            right_role = "horizontal"
            left_role_ok = left_vertical_ok
            right_role_ok = right_horizontal_ok

        forearm_distance = segment_distance(
            left_elbow,
            left_wrist,
            right_elbow,
            right_wrist,
        )
        distance_ok = forearm_distance <= self._distance_threshold

        # pose.is_crossed_arms() と同じ最終条件を維持する。
        role_pair_ok = (
            left_horizontal_ok and right_vertical_ok
        ) or (
            left_vertical_ok and right_horizontal_ok
        )

        self._state = CrossArmsEvaluation(
            pose_detected=True,
            result=distance_ok and role_pair_ok,
            active_pattern=active_pattern,
            left=ArmEvaluation(
                angle=left_angle,
                display_angle=self._mirror_angle(left_angle),
                role=left_role,
                role_ok=left_role_ok,
            ),
            right=ArmEvaluation(
                angle=right_angle,
                display_angle=self._mirror_angle(right_angle),
                role=right_role,
                role_ok=right_role_ok,
            ),
            forearm_distance=forearm_distance,
            distance_threshold=self._distance_threshold,
            distance_ok=distance_ok,
            angle_tolerance_deg=self._arm_tolerance_deg,
        )
        return self._state

    def _empty_state(self) -> CrossArmsEvaluation:
        return CrossArmsEvaluation(
            distance_threshold=self._distance_threshold,
            angle_tolerance_deg=self._arm_tolerance_deg,
        )

    @staticmethod
    def _normalize_angle(angle: float) -> float:
        normalized = (angle + 180.0) % 360.0 - 180.0
        return 180.0 if normalized == -180.0 else normalized

    @classmethod
    def _angle_distance(cls, first: float, second: float) -> float:
        return abs(cls._normalize_angle(first - second))

    @staticmethod
    def _forearm_angle(elbow, wrist) -> float:
        elbow_x, elbow_y = point_xy(elbow)
        wrist_x, wrist_y = point_xy(wrist)
        return math.degrees(math.atan2(wrist_y - elbow_y, wrist_x - elbow_x))

    @classmethod
    def _mirror_angle(cls, angle: float) -> float:
        """CSSで左右反転した映像に合わせる表示用角度。"""

        return cls._normalize_angle(180.0 - angle)

    def _is_horizontal(self, angle: float) -> bool:
        return min(
            self._angle_distance(angle, 0.0),
            self._angle_distance(angle, 180.0),
        ) <= self._arm_tolerance_deg

    def _is_vertical(self, angle: float) -> bool:
        return min(
            self._angle_distance(angle, 90.0),
            self._angle_distance(angle, -90.0),
        ) <= self._arm_tolerance_deg

    def _role_distance(self, angle: float, role: ArmRole) -> float:
        if role == "horizontal":
            return min(
                self._angle_distance(angle, 0.0),
                self._angle_distance(angle, 180.0),
            )

        return min(
            self._angle_distance(angle, 90.0),
            self._angle_distance(angle, -90.0),
        )
