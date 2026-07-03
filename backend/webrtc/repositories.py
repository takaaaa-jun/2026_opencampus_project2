import threading
from typing import Dict, Optional
from .domain import PoseFrame, ImageFrame

class InMemoryRoomRepository:
    def __init__(self):
        self._poses: Dict[str, PoseFrame] = {}
        self._images: Dict[str, ImageFrame] = {}
        self._lock = threading.Lock()

    def save_pose(self, room_id: str, pose: PoseFrame) -> None:
        with self._lock:
            self._poses[room_id] = pose

    def get_pose(self, room_id: str) -> Optional[PoseFrame]:
        with self._lock:
            return self._poses.get(room_id)

    def save_image(self, room_id: str, image: ImageFrame) -> None:
        with self._lock:
            self._images[room_id] = image

    def get_image(self, room_id: str) -> Optional[ImageFrame]:
        with self._lock:
            return self._images.get(room_id)

# シングルトンインスタンスとして公開
room_repository = InMemoryRoomRepository()
