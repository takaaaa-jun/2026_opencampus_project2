from collections import deque


class SwingDetector:
    def __init__(self):
        self.frames = deque(maxlen=15)

    def detect(self, landmarks):
        self.frames.append((landmarks[15][1] + landmarks[16][1]) / 2)
        if len(self.frames) < self.frames.maxlen:
            return False
        frames = list(self.frames)
        top = sum(frames[0:3]) / 3
        middle = sum(frames[6:9]) / 3
        bottom = sum(frames[12:15]) / 3
        return top < middle < bottom and bottom - top >= 0.1
