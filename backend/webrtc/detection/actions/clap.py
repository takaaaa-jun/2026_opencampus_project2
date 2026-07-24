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

    def detect(self, landmarks):
        """拍手の接触時に一度だけTrueを返す。"""
        now = self._clock()
        current_distance = self._normalized_palm_distance(landmarks)
        if current_distance is None:
            self._reset_motion()
            return False

        if self._previous_distance is None:
            self._store(current_distance, now)
            return False

        elapsed = now - self._previous_time
        if elapsed <= 0:
            self._store(current_distance, now)
            return False

        closing_speed = (self._previous_distance - current_distance) / elapsed
        self._store(current_distance, now)

        if now < self._cooldown_until:
            return False

        # 接近状態のあと、十分近い位置で速度が止まった瞬間を接触とみなす。
        if (self._approach_frames >= 2 and
                current_distance <= self._contact_distance and
                abs(closing_speed) <= self._stop_speed):
            self._cooldown_until = now + self._cooldown_seconds
            self._reset_motion()
            return True

        if closing_speed >= self._approach_speed:
            self._approach_frames += 1
            if self._approach_started_at is None:
                self._approach_started_at = now
        elif closing_speed < 0:
            self._reset_motion()

        if (self._approach_started_at is not None and
                now - self._approach_started_at > 0.75):
            self._reset_motion()
        return False

    @staticmethod
    def _palm_center(landmarks, indices):
        points = [point_xy(landmarks[index]) for index in indices]
        return (
            sum(point[0] for point in points) / len(points),
            sum(point[1] for point in points) / len(points),
        )

    def _normalized_palm_distance(self, landmarks):
        shoulder_width = distance(landmarks[11], landmarks[12])
        if shoulder_width == 0:
            return None
        left_palm = self._palm_center(landmarks, (15, 17, 19, 21))
        right_palm = self._palm_center(landmarks, (16, 18, 20, 22))
        return distance(left_palm, right_palm) / shoulder_width

    def _store(self, current_distance, now):
        self._previous_distance = current_distance
        self._previous_time = now

    def _reset_motion(self):
        self._approach_frames = 0
        self._approach_started_at = None
