from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay


@dataclass
class SessionState:
    role: str
    pc: RTCPeerConnection


@dataclass
class RoomState:
    sender_track: Any | None = None
    latest_pose: dict[str, Any] | None = None
    sessions: dict[str, SessionState] = field(default_factory=dict)


class PeerManager:
    def __init__(self) -> None:
        self._relay = MediaRelay()
        self._rooms: dict[str, RoomState] = {}
        self._session_to_room: dict[str, str] = {}
        self._lock = asyncio.Lock()

    def _get_room(self, room_id: str) -> RoomState:
        room = self._rooms.get(room_id)
        if room is None:
            room = RoomState()
            self._rooms[room_id] = room
        return room

    async def create_sender_answer(self, room_id: str, offer_payload: dict[str, Any]):
        async with self._lock:
            room = self._get_room(room_id)
            session_id = uuid.uuid4().hex
            pc = RTCPeerConnection()
            room.sessions[session_id] = SessionState(role='sender', pc=pc)
            self._session_to_room[session_id] = room_id
            room.sender_track = None

        @pc.on('track')
        def on_track(track):
            if track.kind == 'video':
                room.sender_track = track

        @pc.on('connectionstatechange')
        async def on_connectionstatechange():
            if pc.connectionState in ('failed', 'disconnected', 'closed'):
                await self.close_session(session_id)

        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=offer_payload['sdp'], type=offer_payload['type'])
        )
        await pc.setLocalDescription(await pc.createAnswer())

        answer = {
            'sdp': pc.localDescription.sdp,
            'type': pc.localDescription.type,
        }
        return session_id, answer

    async def create_viewer_answer(self, room_id: str, offer_payload: dict[str, Any]):
        async with self._lock:
            room = self._get_room(room_id)
            if room.sender_track is None:
                return None

            session_id = uuid.uuid4().hex
            pc = RTCPeerConnection()
            room.sessions[session_id] = SessionState(role='viewer', pc=pc)
            self._session_to_room[session_id] = room_id
            sender_track = room.sender_track

        pc.addTrack(self._relay.subscribe(sender_track))

        @pc.on('connectionstatechange')
        async def on_connectionstatechange():
            if pc.connectionState in ('failed', 'disconnected', 'closed'):
                await self.close_session(session_id)

        await pc.setRemoteDescription(
            RTCSessionDescription(sdp=offer_payload['sdp'], type=offer_payload['type'])
        )
        await pc.setLocalDescription(await pc.createAnswer())

        answer = {
            'sdp': pc.localDescription.sdp,
            'type': pc.localDescription.type,
        }
        return session_id, answer

    async def close_session(self, session_id: str):
        pcs_to_close: list[RTCPeerConnection] = []

        async with self._lock:
            room_id = self._session_to_room.pop(session_id, None)
            if room_id is None:
                return

            room = self._rooms.get(room_id)
            if room is None:
                return

            session = room.sessions.pop(session_id, None)
            role = session.role if session else None

            if session:
                pcs_to_close.append(session.pc)

            if role == 'sender':
                viewer_ids = [sid for sid, st in room.sessions.items() if st.role == 'viewer']
                for viewer_id in viewer_ids:
                    viewer_state = room.sessions.pop(viewer_id, None)
                    self._session_to_room.pop(viewer_id, None)
                    if viewer_state:
                        pcs_to_close.append(viewer_state.pc)

                room.sender_track = None

            if not room.sessions and room.latest_pose is None:
                self._rooms.pop(room_id, None)

        await asyncio.gather(*(pc.close() for pc in pcs_to_close), return_exceptions=True)

    def update_pose(self, room_id: str, pose_payload: dict[str, Any]):
        room = self._get_room(room_id)
        room.latest_pose = pose_payload

    def get_latest_pose(self, room_id: str):
        room = self._rooms.get(room_id)
        if room is None:
            return None
        return room.latest_pose


peer_manager = PeerManager()