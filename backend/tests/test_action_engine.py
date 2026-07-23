from __future__ import annotations

from app.vision.action_engine import ActionEngine
from app.vision.actions.clap import ClapDetector
from app.vision.actions.grab import GrabDetector
from app.vision.actions.jump import JumpDetector
from app.vision.actions.sit import SitDetector
from app.vision.actions.tpose import TPoseDetector


def hand(x: float, handedness: str = 'left') -> dict:
    landmarks = [{'x': x, 'y': 0.5, 'z': 0.0} for _ in range(21)]
    landmarks[0] = {'x': x, 'y': 0.75, 'z': 0.0}
    landmarks[9] = {'x': x, 'y': 0.6, 'z': 0.0}
    landmarks[12] = {'x': x, 'y': 0.4, 'z': 0.0}
    return {'handedness': handedness, 'landmarks': landmarks}


def pose_for_tpose() -> dict:
    landmarks = [
        {'x': 0.5, 'y': 0.5, 'z': 0.0, 'visibility': 1.0}
        for _ in range(33)
    ]
    landmarks[11] = {'x': 0.55, 'y': 0.4, 'z': 0.0, 'visibility': 1.0}
    landmarks[13] = {'x': 0.70, 'y': 0.4, 'z': 0.0, 'visibility': 1.0}
    landmarks[15] = {'x': 0.85, 'y': 0.4, 'z': 0.0, 'visibility': 1.0}
    landmarks[12] = {'x': 0.45, 'y': 0.4, 'z': 0.0, 'visibility': 1.0}
    landmarks[14] = {'x': 0.30, 'y': 0.4, 'z': 0.0, 'visibility': 1.0}
    landmarks[16] = {'x': 0.15, 'y': 0.4, 'z': 0.0, 'visibility': 1.0}
    return {'landmarks': landmarks}


def pose_for_sit() -> dict:
    landmarks = [
        {'x': 0.5, 'y': 0.5, 'z': 0.0, 'visibility': 1.0}
        for _ in range(33)
    ]
    landmarks[23] = {'x': 0.45, 'y': 0.50, 'z': 0.0, 'visibility': 1.0}
    landmarks[24] = {'x': 0.55, 'y': 0.50, 'z': 0.0, 'visibility': 1.0}
    landmarks[25] = {'x': 0.35, 'y': 0.65, 'z': 0.0, 'visibility': 1.0}
    landmarks[26] = {'x': 0.60, 'y': 0.62, 'z': 0.0, 'visibility': 1.0}
    landmarks[27] = {'x': 0.50, 'y': 0.80, 'z': 0.0, 'visibility': 1.0}
    landmarks[28] = {'x': 0.55, 'y': 0.76, 'z': 0.0, 'visibility': 1.0}
    return {'landmarks': landmarks}


def pose_for_jump() -> dict:
    landmarks = [
        {'x': 0.5, 'y': 0.5, 'z': 0.0, 'visibility': 1.0}
        for _ in range(33)
    ]
    landmarks[27] = {'x': 0.40, 'y': 0.55, 'z': 0.0, 'visibility': 1.0}
    landmarks[28] = {'x': 0.60, 'y': 0.55, 'z': 0.0, 'visibility': 1.0}
    return {'landmarks': landmarks}


def test_clap_triggers_only_on_rising_edge() -> None:
    engine = ActionEngine()

    opened = engine.evaluate(None, [hand(0.2), hand(0.8)])['clap']
    assert opened['active'] is False
    assert opened['triggered'] is False

    first_clap = engine.evaluate(None, [hand(0.48), hand(0.52)])['clap']
    assert first_clap['active'] is True
    assert first_clap['triggered'] is True

    held_clap = engine.evaluate(None, [hand(0.49), hand(0.51)])['clap']
    assert held_clap['active'] is True
    assert held_clap['triggered'] is False


def test_clap_detector_updates_threshold() -> None:
    detector = ClapDetector()
    detector.update_config({'clapThreshold': 0.2})
    active, confidence, metrics = detector.evaluate([hand(0.4), hand(0.55)])
    assert active is True
    assert confidence > 0
    assert metrics['threshold'] == 0.2


def test_jump_detector_establishes_baseline() -> None:
    detector = JumpDetector()
    first_active, _, first_metrics = detector.evaluate(pose_for_jump())
    assert first_active is False
    assert first_metrics['baselineY'] is not None


def test_tpose_detector_works() -> None:
    detector = TPoseDetector()
    active, _, metrics = detector.evaluate(pose_for_tpose())
    assert active is True
    assert metrics['armsPointOutward'] is True


def test_sit_detector_works() -> None:
    detector = SitDetector()
    active, _, metrics = detector.evaluate(pose_for_sit())
    assert active is True
    assert metrics['hipAboveKnee'] is True


def test_grab_detector_works() -> None:
    detector = GrabDetector()
    active, _, metrics = detector.evaluate([hand(0.5)])
    assert isinstance(active, bool)
    assert metrics['detectedHands'] == 1
