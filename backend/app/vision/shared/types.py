from __future__ import annotations

from typing import Any, Mapping, TypedDict


class LandmarkDict(TypedDict, total=False):
    x: float
    y: float
    z: float
    visibility: float
    presence: float


class HandDict(TypedDict, total=False):
    handedness: str
    landmarks: list[LandmarkDict]


class PoseDict(TypedDict, total=False):
    landmarks: list[LandmarkDict]


class ActionResultDict(TypedDict):
    active: bool
    triggered: bool
    confidence: float
    metrics: dict[str, Any]


class DetectionFrameDict(TypedDict):
    id: int
    capturedAtMs: int
    receivedAtMs: int
    processedAtMs: int
    processingTimeMs: float
    width: int
    height: int
    mirrored: bool


class DetectionPayloadDict(TypedDict):
    type: str
    schemaVersion: int
    source: str
    frame: DetectionFrameDict
    pose: PoseDict | None
    hands: list[HandDict]
    actions: dict[str, ActionResultDict]
