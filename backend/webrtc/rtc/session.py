"""Djangoからaiortcを利用するためのWebRTC接続管理。"""

from __future__ import annotations

import asyncio
import json
import threading

from aiortc import RTCConfiguration, RTCDataChannel, RTCPeerConnection, RTCSessionDescription

from ..vision.processing_loop import ProcessingLoop
from .video_tracks import CameraVideoTrack, SkeletonVideoTrack


def _start_aiortc_loop() -> asyncio.AbstractEventLoop:
    """Djangoのリクエスト処理とは別にaiortc用のイベントループを常駐させる。"""
    loop = asyncio.new_event_loop()

    def run() -> None:
        asyncio.set_event_loop(loop)
        loop.run_forever()

    threading.Thread(target=run, daemon=True, name="aiortc-loop").start()
    return loop


AIORTC_LOOP = _start_aiortc_loop()


class RtcSessionManager:
    """同一PC上のフロントエンド1接続を管理する。"""

    def __init__(self) -> None:
        self._loop = AIORTC_LOOP
        self._peer_connection: RTCPeerConnection | None = None
        self._detection_channel: RTCDataChannel | None = None
        self._camera_track: CameraVideoTrack | None = None
        self._skeleton_track: SkeletonVideoTrack | None = None
        self._processing_loop: ProcessingLoop | None = None

    def create_answer(self, offer: RTCSessionDescription) -> RTCSessionDescription:
        """Offerを設定し、WebRTC Answerを同期的に返す。"""
        future = asyncio.run_coroutine_threadsafe(self._create_answer(offer), self._loop)
        return future.result()

    def close(self) -> None:
        """現在の接続を閉じる。"""
        future = asyncio.run_coroutine_threadsafe(self._close_current(), self._loop)
        future.result()

    def send_detection(self, payload: dict) -> None:
        """解析済みの検知データをDataChannelへ送る。

        カメラ・MediaPipe処理の実装後、processing_loopから呼び出す。
        """
        asyncio.run_coroutine_threadsafe(self._send_detection(payload), self._loop)

    async def _create_answer(self, offer: RTCSessionDescription) -> RTCSessionDescription:
        await self._close_current()

        peer_connection = RTCPeerConnection(RTCConfiguration(iceServers=[]))
        self._peer_connection = peer_connection

        @peer_connection.on("datachannel")
        def on_datachannel(channel: RTCDataChannel) -> None:
            if channel.label == "detection":
                self._detection_channel = channel

        @peer_connection.on("connectionstatechange")
        async def on_connectionstatechange() -> None:
            if peer_connection.connectionState in {"failed", "disconnected", "closed"}:
                await self._release(peer_connection)

        await peer_connection.setRemoteDescription(offer)
        self._add_camera_track(peer_connection)
        answer = await peer_connection.createAnswer()
        await peer_connection.setLocalDescription(answer)

        if peer_connection.localDescription is None:
            raise RuntimeError("WebRTC Answer could not be created.")

        return peer_connection.localDescription

    def _add_camera_track(self, peer_connection: RTCPeerConnection) -> None:
        """フロントエンドが用意した最初の映像受信枠へカメラを接続する。"""
        video_transceivers = [
            transceiver for transceiver in peer_connection.getTransceivers() if transceiver.kind == "video"
        ]
        if len(video_transceivers) < 2:
            raise RuntimeError("カメラ映像と骨格映像の受信枠がOfferにありません。")

        self._processing_loop = ProcessingLoop(send_detection=self.send_detection)
        self._camera_track = CameraVideoTrack(self._processing_loop.camera_frames)
        self._skeleton_track = SkeletonVideoTrack(self._processing_loop.skeleton_frames)
        for transceiver, track in zip(video_transceivers, (self._camera_track, self._skeleton_track)):
            transceiver.direction = "sendonly"
            transceiver.sender.replaceTrack(track)
        self._processing_loop.start()

    async def _close_current(self) -> None:
        peer_connection = self._peer_connection
        camera_track = self._camera_track
        skeleton_track = self._skeleton_track
        processing_loop = self._processing_loop
        self._peer_connection = None
        self._detection_channel = None
        self._camera_track = None
        self._skeleton_track = None
        self._processing_loop = None

        if processing_loop is not None:
            processing_loop.stop()
        if camera_track is not None:
            camera_track.stop()
        if skeleton_track is not None:
            skeleton_track.stop()
        if peer_connection is not None:
            await peer_connection.close()

    async def _release(self, peer_connection: RTCPeerConnection) -> None:
        if self._peer_connection is not peer_connection:
            return

        await self._close_current()

    async def _send_detection(self, payload: dict) -> None:
        channel = self._detection_channel
        if channel is None or channel.readyState != "open":
            return

        channel.send(json.dumps(payload))


rtc_session_manager = RtcSessionManager()
