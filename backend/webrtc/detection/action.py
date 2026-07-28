"""動作判定の集約窓口。"""

from .actions import geometry, hands, pose
from .actions.clap import ClapDetector
from .actions.commands import ACTION_NAMES
from .actions.hold import HoldDetector
from .actions.jump import JumpDetector
from .actions.swing import SwingDetector
from .actions.uppercut import UppercutDetector


class action:
    def __init__(self):
        self._jump = JumpDetector()
        self._swing = SwingDetector()
        self._uppercut = UppercutDetector()
        self._clap = ClapDetector()
        self._tpose = HoldDetector(duration=1)
        self._surprise = HoldDetector(duration=1)
        self._kamehameha = HoldDetector(duration=3)
        self._message = dict.fromkeys(ACTION_NAMES, False)

    @property
    def jump_last_frames(self):
        return self._jump.frames

    @property
    def swing_last_frames(self):
        return self._swing.frames

    @property
    def message(self):
        return self._message

    @property
    def clap_details(self):
        return self._clap.details

    @property
    def tpose_start_time(self):
        return self._tpose.start_time

    @property
    def tpose_detected(self):
        return self._tpose.detected

    @property
    def surprise_start_time(self):
        return self._surprise.start_time

    @property
    def surprise_detected(self):
        return self._surprise.detected

    @property
    def kamehameha_start_time(self):
        return self._kamehameha.start_time

    @property
    def kamehameha_detected(self):
        return self._kamehameha.detected

    def check_jumping(self, landmarks):
        return self._jump.detect(landmarks)

    def judge_swing(self, landmarks):
        return self._swing.detect(landmarks)

    def judge_uppercut(self, landmarks):
        return self._uppercut.detect(landmarks)

    def judge_clap(self, landmarks):
        return self._clap.detect(landmarks)

    def reset_clap(self):
        self._clap.reset()

    def check_sitting(self, landmarks):
        return pose.is_sitting(landmarks)

    def check_tpose(self, landmarks):
        return pose.is_tpose(landmarks)

    def is_tpose(self, landmarks):
        return self._tpose.update(self.check_tpose(landmarks))

    def check_surprise(self, landmarks):
        return pose.is_surprise(landmarks)

    def is_surprise(self, landmarks):
        return self._surprise.update(self.check_surprise(landmarks))

    def check_kick(self, landmarks):
        return pose.is_kick(landmarks)

    def judge_closs_arms(self, landmarks):
        return pose.is_crossed_arms(landmarks)

    def judge_grab(self, hand):
        return hands.is_grab(hand)

    def judge_kamehameha(self, first_hand, second_hand):
        return hands.is_kamehameha(first_hand, second_hand)

    def is_kamehameha(self, first_hand, second_hand):
        return self._kamehameha.update(self.judge_kamehameha(first_hand, second_hand))

    def calc_angle(self, first, vertex, third):
        return geometry.angle(first, vertex, third)

    def distance(self, first, second):
        return geometry.distance(first, second)

    def change_message(self, message):
        if message in self._message:
            self._message[message] = True

    def reset_message(self):
        for message in self._message:
            self._message[message] = False
