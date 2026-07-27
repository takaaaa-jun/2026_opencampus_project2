import unittest

from .clap import ClapDetector


class ClapDetectorTest(unittest.TestCase):
    def test_detects_when_hands_stop_near_each_other_after_approaching(self):
        times = iter((0.0, 0.1, 0.2, 1.0, 1.1, 1.2))
        detector = ClapDetector(clock=lambda: next(times))

        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.9)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.75)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.6)))

        # 近づく動きが一度ゆるやかになっても、手が離れてはいない。
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.58)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.5)))

        self.assertTrue(detector.detect(self._landmarks(right_palm_x=0.5)))

    def test_does_not_detect_after_approach_history_expires(self):
        times = iter((0.0, 0.1, 0.2, 1.6, 1.7, 1.8))
        detector = ClapDetector(clock=lambda: next(times))

        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.9)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.75)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.6)))

        # 最後に速く近づいてから1秒を超えたため、履歴は無効になる。
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.58)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.5)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.5)))

    def test_extends_approach_history_while_hands_keep_moving_quickly(self):
        times = iter([0.0, *[index / 10 for index in range(1, 15)]])
        detector = ClapDetector(clock=lambda: next(times))
        palm_positions = [0.95 - (0.04 * index) for index in range(14)]

        self.assertFalse(detector.detect(self._landmarks(right_palm_x=palm_positions[0])))
        for right_palm_x in palm_positions[1:]:
            self.assertFalse(detector.detect(self._landmarks(right_palm_x=right_palm_x)))

        # 最初の接近からは1.25秒を超えているが、最後の速い接近の直後なら検知できる。
        self.assertTrue(detector.detect(self._landmarks(right_palm_x=palm_positions[-1])))

    def test_keeps_approach_history_when_hands_move_apart_briefly(self):
        times = iter((0.0, 0.1, 0.2, 0.3, 0.4, 0.5))
        detector = ClapDetector(clock=lambda: next(times))

        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.9)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.75)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.6)))

        # 検出の揺れなどで一時的に離れる動きになっても、接近履歴は残す。
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.65)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.5)))
        self.assertTrue(detector.detect(self._landmarks(right_palm_x=0.5)))

    def test_resets_approach_history_when_palm_distance_exceeds_shoulder_width(self):
        times = iter((0.0, 0.1, 0.2, 0.3))
        detector = ClapDetector(clock=lambda: next(times))

        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.9)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.75)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.6)))
        self.assertTrue(detector.details["hasApproached"])

        # 手のひら中心間の距離が肩幅を超えたら、接近履歴を捨てる。
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.95)))
        self.assertFalse(detector.details["hasApproached"])

    def test_detects_when_hands_rebound_after_becoming_close(self):
        times = iter((0.0, 0.1, 0.2, 0.3, 0.4))
        detector = ClapDetector(clock=lambda: next(times))

        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.9)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.75)))
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.6)))

        # 近い位置まで到達した後、止まらずに離れ始めても拍手として検知する。
        self.assertFalse(detector.detect(self._landmarks(right_palm_x=0.5)))
        self.assertTrue(detector.detect(self._landmarks(right_palm_x=0.56)))
        self.assertTrue(detector.details["isSeparatingAfterClose"])

    @staticmethod
    def _landmarks(right_palm_x):
        landmarks = [[0.0, 0.0] for _ in range(33)]
        landmarks[11] = [0.2, 0.3]
        landmarks[12] = [0.8, 0.3]

        for index in (15, 17, 19, 21):
            landmarks[index] = [0.3, 0.5]
        for index in (16, 18, 20, 22):
            landmarks[index] = [right_palm_x, 0.5]

        return landmarks
