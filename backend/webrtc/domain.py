from dataclasses import dataclass
from typing import Any, List

@dataclass
class PoseFrame:
    room_id: str
    updated_at: int
    image_width: int
    image_height: int
    landmarks: List[dict]

@dataclass
class ImageFrame:
    room_id: str
    image_data: str  # Base64 string
