from typing import Any, Optional
from .domain import PoseFrame, ImageFrame
from .repositories import room_repository, InMemoryRoomRepository

class RelayService:
    def __init__(self, repo: InMemoryRoomRepository = room_repository):
        self._repo = repo

    def update_pose(self, room_id: str, pose_payload: dict) -> None:
        landmarks = pose_payload.get('landmarks', [])
        pose = PoseFrame(
            room_id=room_id,
            updated_at=int(pose_payload.get('updated_at', 0)),
            image_width=int(pose_payload.get('image_width', 1280)),
            image_height=int(pose_payload.get('image_height', 720)),
            landmarks=landmarks
        )
        self._repo.save_pose(room_id, pose)

    def get_latest_pose(self, room_id: str) -> Optional[PoseFrame]:
        return self._repo.get_pose(room_id)

    def update_image(self, room_id: str, image_base64: str) -> None:
        image = ImageFrame(
            room_id=room_id,
            image_data=image_base64
        )
        self._repo.save_image(room_id, image)

    def get_latest_image(self, room_id: str) -> Optional[ImageFrame]:
        return self._repo.get_image(room_id)

    def update_action_data(self, room_id: str, action_data: Any) -> None:
        self._repo.save_action_data(room_id, action_data)

    def get_latest_action_data(self, room_id: str) -> Optional[Any]:
        return self._repo.get_action_data(room_id)

# シングルトンインスタンスとして公開
relay_service = RelayService()
