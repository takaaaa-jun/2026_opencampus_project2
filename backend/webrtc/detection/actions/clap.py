"""Poseの手のひら中心を使った拍手判定。"""

import time

from .geometry import distance, point_xy


class ClapDetector:
    """手のひらが近づき、接触位置で止まったときに拍手を検出する。"""

    def __init__(
        self,
        approach_speed=0.4,
        contact_distance=0.35,
        stop_speed=0.15,
        rebound_speed=0.15,
        approach_hold_seconds=1.0,
        cooldown_seconds=0.2,
        clock=time.monotonic,
    ):
        self._approach_speed = approach_speed
        self._contact_distance = contact_distance
        self._stop_speed = stop_speed
        self._rebound_speed = rebound_speed
        self._approach_hold_seconds = approach_hold_seconds
        self._cooldown_seconds = cooldown_seconds
        self._clock = clock
        self._previous_distance = None
        self._previous_time = None
        self._approach_frames = 0
        self._last_approach_at = None
        self._has_been_close = False
        self._cooldown_until = 0.0
        self._details = self._empty_details()

    @property
    def details(self):
        """直近フレームの判定途中値を返す。"""
        return self._details

    def reset(self):
        """Poseを検出できないときに判定状態をリセットする。"""
        self._previous_distance = None
        self._previous_time = None
        self._reset_motion()
        self._details = self._empty_details()

    def detect(self, landmarks):
        """拍手の接触時に一度だけTrueを返す。"""
        now = self._clock()
        metrics = self._palm_metrics(landmarks)
        if metrics is None:
            self._reset_motion()
            self._details = self._empty_details()
            return False

        left_palm, right_palm, shoulder_width, current_distance = metrics
        if self._previous_distance is None:
            self._store(current_distance, now)
            self._update_details(left_palm, right_palm, shoulder_width, current_distance, None, now)
            return False

        elapsed = now - self._previous_time
        if elapsed <= 0:
            self._store(current_distance, now)
            self._update_details(left_palm, right_palm, shoulder_width, current_distance, None, now)
            return False

        closing_speed = (self._previous_distance - current_distance) / elapsed
        self._store(current_distance, now)

        if now < self._cooldown_until:
            self._update_details(left_palm, right_palm, shoulder_width, current_distance, closing_speed, now)
            return False

        if current_distance > 1:
            self._reset_motion()
        elif closing_speed >= self._approach_speed:
            self._approach_frames += 1
            self._last_approach_at = now

        # 最後に速く近づいた時点から一定時間だけ履歴を保持し、その間に接触・停止を確認する。
        if self._last_approach_at is not None and now - self._last_approach_at > self._approach_hold_seconds:
            self._reset_motion()

        is_close_enough = current_distance <= self._contact_distance
        is_stopped = abs(closing_speed) <= self._stop_speed
        has_approached = self._approach_frames >= 2
        if has_approached and is_close_enough:
            self._has_been_close = True

        is_separating_after_close = self._has_been_close and closing_speed <= -self._rebound_speed
        is_contact_stopped = is_close_enough and is_stopped
        if has_approached and (is_contact_stopped or is_separating_after_close):
            self._cooldown_until = now + self._cooldown_seconds
            self._update_details(
                left_palm,
                right_palm,
                shoulder_width,
                current_distance,
                closing_speed,
                now,
                triggered=True,
            )
            self._reset_motion()
            return True

        self._update_details(left_palm, right_palm, shoulder_width, current_distance, closing_speed, now)
        return False

    @staticmethod
    def _palm_center(landmarks, indices):
        points = [point_xy(landmarks[index]) for index in indices]
        return (
            sum(point[0] for point in points) / len(points),
            sum(point[1] for point in points) / len(points),
        )

    def _palm_metrics(self, landmarks):
        shoulder_width = distance(landmarks[11], landmarks[12])
        if shoulder_width == 0:
            return None
        left_palm = self._palm_center(landmarks, (15, 17, 19, 21))
        right_palm = self._palm_center(landmarks, (16, 18, 20, 22))
        return left_palm, right_palm, shoulder_width, distance(left_palm, right_palm) / shoulder_width

    def _update_details(self, left_palm, right_palm, shoulder_width, normalized_distance, closing_speed, now, *, triggered=False):
        self._details = {
            "isPoseAvailable": True,
            "leftPalmCenter": {"x": left_palm[0], "y": left_palm[1]},
            "rightPalmCenter": {"x": right_palm[0], "y": right_palm[1]},
            "shoulderWidth": shoulder_width,
            "normalizedDistance": normalized_distance,
            "closingSpeed": closing_speed,
            "approachFrames": self._approach_frames,
            "approachSpeedThreshold": self._approach_speed,
            "approachHoldSeconds": self._approach_hold_seconds,
            "contactDistanceThreshold": self._contact_distance,
            "stopSpeedThreshold": self._stop_speed,
            "reboundSpeedThreshold": self._rebound_speed,
            "hasApproached": self._approach_frames >= 2,
            "isCloseEnough": normalized_distance <= self._contact_distance,
            "isStopped": closing_speed is not None and abs(closing_speed) <= self._stop_speed,
            "isSeparatingAfterClose": self._has_been_close and closing_speed is not None and closing_speed <= -self._rebound_speed,
            "isCoolingDown": now < self._cooldown_until,
            "triggered": triggered,
        }

    @staticmethod
    def _empty_details():
        return {
            "isPoseAvailable": False,
            "leftPalmCenter": None,
            "rightPalmCenter": None,
            "shoulderWidth": None,
            "normalizedDistance": None,
            "closingSpeed": None,
            "approachFrames": 0,
            "approachSpeedThreshold": 0.4,
            "approachHoldSeconds": 1.0,
            "contactDistanceThreshold": 0.35,
            "stopSpeedThreshold": 0.15,
            "reboundSpeedThreshold": 0.15,
            "hasApproached": False,
            "isCloseEnough": False,
            "isStopped": False,
            "isSeparatingAfterClose": False,
            "isCoolingDown": False,
            "triggered": False,
        }

    def _store(self, current_distance, now):
        self._previous_distance = current_distance
        self._previous_time = now

    def _reset_motion(self):
        self._approach_frames = 0
        self._last_approach_at = None
        self._has_been_close = False
