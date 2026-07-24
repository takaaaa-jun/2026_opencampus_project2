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
        cooldown_seconds=0.4,
        clock=time.monotonic,
    ):
        self._approach_speed = approach_speed
        self._contact_distance = contact_distance
        self._stop_speed = stop_speed
        self._cooldown_seconds = cooldown_seconds
        self._clock = clock
        self._previous_distance = None
        self._previous_time = None
        self._approach_frames = 0
        self._approach_started_at = None
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

        is_close_enough = current_distance <= self._contact_distance
        is_stopped = abs(closing_speed) <= self._stop_speed
        has_approached = self._approach_frames >= 2
        if has_approached and is_close_enough and is_stopped:
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

        if closing_speed >= self._approach_speed:
            self._approach_frames += 1
            if self._approach_started_at is None:
                self._approach_started_at = now
        elif closing_speed < 0:
            self._reset_motion()

        if self._approach_started_at is not None and now - self._approach_started_at > 0.75:
            self._reset_motion()

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
            "contactDistanceThreshold": self._contact_distance,
            "stopSpeedThreshold": self._stop_speed,
            "hasApproached": self._approach_frames >= 2,
            "isCloseEnough": normalized_distance <= self._contact_distance,
            "isStopped": closing_speed is not None and abs(closing_speed) <= self._stop_speed,
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
            "contactDistanceThreshold": 0.35,
            "stopSpeedThreshold": 0.15,
            "hasApproached": False,
            "isCloseEnough": False,
            "isStopped": False,
            "isCoolingDown": False,
            "triggered": False,
        }

    def _store(self, current_distance, now):
        self._previous_distance = current_distance
        self._previous_time = now

    def _reset_motion(self):
        self._approach_frames = 0
        self._approach_started_at = None
