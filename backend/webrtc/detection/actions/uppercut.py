"""アッパーの軌跡を判定する状態モジュール。"""

from collections import deque
import time


class UppercutDetector:
    """片手ずつ、下から上への動きを検出する。"""

    def __init__(self, window_size=10, cooldown_seconds=0.5):
        self._frames = {
            "left": deque(maxlen=window_size),
            "right": deque(maxlen=window_size),
        }
        self._cooldown_seconds = cooldown_seconds
        self._last_detected_at = 0.0

    def detect(self, landmarks):
        """左右どちらかがアッパーの軌跡ならTrueを返す。"""
        shoulder_width = abs(landmarks[12][0] - landmarks[11][0])
        if shoulder_width == 0:
            return False

        self._append(
            "left", landmarks[15], landmarks[11], landmarks[11], landmarks[12], shoulder_width
        )
        self._append(
            "right", landmarks[16], landmarks[12], landmarks[11], landmarks[12], shoulder_width
        )

        now = time.monotonic()
        if now - self._last_detected_at < self._cooldown_seconds:
            return False

        for side in self._frames:
            if self._is_uppercut(self._frames[side]):
                self._last_detected_at = now
                self._frames[side].clear()
                return True
        return False

    def _append(self, side, wrist, shoulder, left_shoulder, right_shoulder, shoulder_width):
        self._frames[side].append(
            (wrist[0], wrist[1], shoulder[1], left_shoulder[0], right_shoulder[0], shoulder_width)
        )

    @staticmethod
    def _is_uppercut(frames):
        if len(frames) < frames.maxlen:
            return False

        samples = list(frames)
        start = samples[:3]
        end = samples[-3:]
        start_wrist_y = sum(sample[1] for sample in start) / len(start)
        end_wrist_y = sum(sample[1] for sample in end) / len(end)
        start_shoulder_y = sum(sample[2] for sample in start) / len(start)
        end_shoulder_y = sum(sample[2] for sample in end) / len(end)
        shoulder_width = sum(sample[3] for sample in samples) / len(samples)

        # 1. 下から上へ、肩幅の半分以上だけ上昇している。
        rises_enough = start_wrist_y - end_wrist_y >= shoulder_width * 0.5
        # 2. 肩より下で始まり、肩の高さまで到達している。
        starts_below_shoulder = start_wrist_y > start_shoulder_y
        ends_near_or_above_shoulder = end_wrist_y <= end_shoulder_y + shoulder_width * 0.1
        # 4. 肩の高さを通過する地点で、手首が左右の肩の間にある。
        shoulder_level_sample = min(samples, key=lambda sample: abs(sample[1] - sample[2]))
        left_shoulder_x, right_shoulder_x = shoulder_level_sample[3:5]
        horizontal_margin = shoulder_width * 0.1
        passes_between_shoulders = (
            min(left_shoulder_x, right_shoulder_x) - horizontal_margin <= shoulder_level_sample[0] <=
            max(left_shoulder_x, right_shoulder_x) + horizontal_margin
        )

        return (rises_enough and starts_below_shoulder and
                ends_near_or_above_shoulder and passes_between_shoulders)
