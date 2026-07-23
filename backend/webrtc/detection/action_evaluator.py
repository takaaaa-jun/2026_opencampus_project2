"""既存のaction()をWebRTC送信用の動作判定へ接続する。"""

from __future__ import annotations

from .action import action

CLAP_THRESHOLD = 0.05


def _serialize_hand_landmark(landmark) -> dict[str, float]:
    return {"x": landmark.x, "y": landmark.y, "z": landmark.z}


class ActionEvaluator:
    """既存の判定ロジックを、送信用の動作名へ対応づける。"""

    def __init__(self) -> None:
        self._action = action()

    def evaluate(self, pose_results, hands_results) -> tuple[dict[str, bool], dict[str, dict]]:
        actions = {
            "jump": False,
            "sit": False,
            "tpose": False,
            "surprise": False,
            "kick": False,
            "upper": False,
            "swing": False,
            "closs": False,
            "clap": False,
            "grab": False,
            "kamehameha": False,
            "kamehameha_continue": False,
        }

        if pose_results.pose_landmarks:
            landmarks = pose_results.pose_landmarks.landmark
            pose_coordinates = [[landmark.x, landmark.y] for landmark in landmarks]

            actions["jump"] = self._action.check_jumping(pose_coordinates)
            actions["sit"] = self._action.check_sitting(pose_coordinates)
            actions["tpose"] = bool(self._action.is_tpose(landmarks))
            actions["surprise"] = bool(self._action.is_surprise(landmarks))
            actions["kick"] = self._action.check_kick(landmarks)
            actions["swing"] = self._action.judge_swing(pose_coordinates)
            actions["closs"] = bool(self._action.judge_closs_arms(pose_coordinates))

            left_upper = self._action.judge_upper(landmarks[15].y, landmarks[11].y)
            right_upper = self._action.judge_upper(landmarks[16].y, landmarks[12].y)
            actions["upper"] = bool(left_upper or right_upper)

        hands = hands_results.multi_hand_landmarks or []
        clap_details = {
            "handCount": len(hands),
            "hand1Landmark12": None,
            "hand2Landmark12": None,
            "distance": None,
            "threshold": CLAP_THRESHOLD,
            "isWithinThreshold": False,
        }

        if hands:
            actions["grab"] = any(self._action.judge_grab(hand) for hand in hands)
            if len(hands) == 2:
                hand1_landmark12 = hands[0].landmark[12]
                hand2_landmark12 = hands[1].landmark[12]
                clap_details["hand1Landmark12"] = _serialize_hand_landmark(hand1_landmark12)
                clap_details["hand2Landmark12"] = _serialize_hand_landmark(hand2_landmark12)
                clap_details["distance"] = self._action.distance(hand1_landmark12, hand2_landmark12)
                actions["clap"] = self._action.judge_crap(hands[0], hands[1])
                clap_details["isWithinThreshold"] = actions["clap"]
                actions["kamehameha"] = bool(self._action.is_kamehameha(hands[0], hands[1]))
                actions["kamehameha_continue"] = self._action.judge_kamehameha(hands[0], hands[1])

        action_details = {action_id: {} for action_id in actions}
        action_details["clap"] = clap_details
        return actions, action_details
