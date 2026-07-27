from collections import deque


class SwingDetector:
    def __init__(self):
        self.frames = deque(maxlen=15)
        self.details = {
            "isPoseAvailable": False,
            "handsHeight": None,
            "top": None,
            "middle": None,
            "foot": None,
            "foot-top": None,
            "isHistoryFull": False,
            "isDirectionPassed": False,
            "isDistancePassed": False,
            "triggered": False
        }

    def detect(self, landmarks):
        if len(landmarks) <= 16:
            self.details["isPoseAvailable"] = False
            return False

        self.details["isPoseAvailable"] = True
        
        left_wrist_y = landmarks[15][1]
        right_wrist_y = landmarks[16][1]
        
        hands_height = (left_wrist_y + right_wrist_y) / 2
        self.details["handsHeight"] = hands_height
        self.frames.append(hands_height)
        
        is_history_full = len(self.frames) >= self.frames.maxlen
        self.details["isHistoryFull"] = is_history_full
        
        if not is_history_full:
            self.details["top"] = None
            self.details["middle"] = None
            self.details["foot"] = None
            self.details["foot-top"] = None
            self.details["isDirectionPassed"] = False
            self.details["isDistancePassed"] = False
            self.details["triggered"] = False
            return False
            
        frames = list(self.frames)
        top = sum(frames[0:3]) / 3
        middle = sum(frames[6:9]) / 3
        foot = sum(frames[12:15]) / 3
        foot_minus_top = foot - top
        
        is_direction_passed = top < middle < foot
        is_distance_passed = foot_minus_top >= 0.1
        triggered = is_direction_passed and is_distance_passed
        
        self.details["top"] = top
        self.details["middle"] = middle
        self.details["foot"] = foot
        self.details["foot-top"] = foot_minus_top
        self.details["isDirectionPassed"] = is_direction_passed
        self.details["isDistancePassed"] = is_distance_passed
        self.details["triggered"] = triggered
        
        return triggered

    def reset(self):
        self.frames.clear()
        self.details = {
            "isPoseAvailable": False,
            "handsHeight": None,
            "top": None,
            "middle": None,
            "foot": None,
            "foot-top": None,
            "isHistoryFull": False,
            "isDirectionPassed": False,
            "isDistancePassed": False,
            "triggered": False
        }

