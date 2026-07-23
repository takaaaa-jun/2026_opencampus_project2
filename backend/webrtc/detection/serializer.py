"""MediaPipeの検知結果をDataChannel送信用の辞書へ変換する。"""

from __future__ import annotations


def serialize_detection(pose_results, hands_results, actions: dict, action_details: dict) -> dict:
    pose = None
    if pose_results.pose_landmarks:
        pose = {
            "landmarks": [
                {
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z,
                    "visibility": landmark.visibility,
                }
                for landmark in pose_results.pose_landmarks.landmark
            ],
        }

    hands = []
    landmarks_list = hands_results.multi_hand_landmarks or []
    handedness_list = hands_results.multi_handedness or []
    for index, hand_landmarks in enumerate(landmarks_list):
        handedness = "unknown"
        if index < len(handedness_list):
            handedness = handedness_list[index].classification[0].label.lower()

        hands.append(
            {
                "handedness": handedness,
                "landmarks": [
                    {"x": landmark.x, "y": landmark.y, "z": landmark.z}
                    for landmark in hand_landmarks.landmark
                ],
            },
        )

    return {
        "pose": pose,
        "hands": hands,
        "actions": actions,
        "actionDetails": action_details,
    }
