from collections import deque


class JumpDetector:
    def __init__(self):
        self.frames = deque(maxlen=25)

    def detect(self, landmarks):
        self.frames.append(landmarks[23][1])
        if len(self.frames) < self.frames.maxlen:
            return False
        frames = list(self.frames)
        left_foot = sum(frames[0:3]) / 3
        left_side = sum(frames[5:8]) / 3
        top = sum(frames[10:13]) / 3
        right_side = sum(frames[15:18]) / 3
        right_foot = sum(frames[20:23]) / 3
        return left_foot > left_side > top < right_side < right_foot and left_foot - top >= 0.05
