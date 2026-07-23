from __future__ import annotations

from app.vision.action_engine import ActionEngine


def hand(x: float, handedness: str = "left") -> dict:
    landmarks = [{"x": x, "y": 0.5, "z": 0.0} for _ in range(21)]
    landmarks[0] = {"x": x, "y": 0.75, "z": 0.0}
    landmarks[9] = {"x": x, "y": 0.6, "z": 0.0}
    landmarks[12] = {"x": x, "y": 0.4, "z": 0.0}
    return {"handedness": handedness, "landmarks": landmarks}


def tpose() -> dict:
    landmarks = [
        {"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 1.0}
        for _ in range(33)
    ]
    landmarks[11] = {"x": 0.55, "y": 0.4, "z": 0.0, "visibility": 1.0}
    landmarks[13] = {"x": 0.70, "y": 0.4, "z": 0.0, "visibility": 1.0}
    landmarks[15] = {"x": 0.85, "y": 0.4, "z": 0.0, "visibility": 1.0}
    landmarks[12] = {"x": 0.45, "y": 0.4, "z": 0.0, "visibility": 1.0}
    landmarks[14] = {"x": 0.30, "y": 0.4, "z": 0.0, "visibility": 1.0}
    landmarks[16] = {"x": 0.15, "y": 0.4, "z": 0.0, "visibility": 1.0}
    return {"landmarks": landmarks}


def test_clap_triggers_only_on_rising_edge() -> None:
    engine = ActionEngine(clap_threshold=0.12)

    opened = engine.evaluate(None, [hand(0.2), hand(0.8)])["clap"]
    assert opened["active"] is False
    assert opened["triggered"] is False

    first_clap = engine.evaluate(None, [hand(0.48), hand(0.52)])["clap"]
    assert first_clap["active"] is True
    assert first_clap["triggered"] is True

    held_clap = engine.evaluate(None, [hand(0.49), hand(0.51)])["clap"]
    assert held_clap["active"] is True
    assert held_clap["triggered"] is False


def test_clap_threshold_can_be_updated() -> None:
    engine = ActionEngine(clap_threshold=0.05)
    engine.update_config({"clapThreshold": 0.2})
    result = engine.evaluate(None, [hand(0.4), hand(0.55)])["clap"]
    assert result["active"] is True
    assert result["metrics"]["threshold"] == 0.2


def test_clap_threshold_is_clamped() -> None:
    engine = ActionEngine()
    engine.update_config({"clapThreshold": 10.0})
    assert engine.clap_threshold == 0.5


def test_tpose_uses_subject_left_and_right_coordinates() -> None:
    engine = ActionEngine()
    result = engine.evaluate(tpose(), [])["tpose"]
    assert result["active"] is True
    assert result["metrics"]["armsPointOutward"] is True
