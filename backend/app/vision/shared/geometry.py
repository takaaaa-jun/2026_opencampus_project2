from __future__ import annotations

import math
from typing import Mapping

Landmark = Mapping[str, float]


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def distance(a: Landmark, b: Landmark) -> float:
    return math.hypot(float(a['x']) - float(b['x']), float(a['y']) - float(b['y']))


def angle(a: Landmark, b: Landmark, c: Landmark) -> float:
    """Return angle ABC in degrees."""
    bax = float(a['x']) - float(b['x'])
    bay = float(a['y']) - float(b['y'])
    bcx = float(c['x']) - float(b['x'])
    bcy = float(c['y']) - float(b['y'])
    norm_a = math.hypot(bax, bay)
    norm_c = math.hypot(bcx, bcy)
    if norm_a < 1e-8 or norm_c < 1e-8:
        return 0.0
    cosine = clamp((bax * bcx + bay * bcy) / (norm_a * norm_c), -1.0, 1.0)
    return math.degrees(math.acos(cosine))
