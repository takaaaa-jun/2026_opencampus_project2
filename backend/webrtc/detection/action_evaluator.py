"""既存のaction()をWebRTC送信用の動作判定へ接続する。"""

from __future__ import annotations

from .action import action


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

        if hands_results.multi_hand_landmarks:
            hands = hands_results.multi_hand_landmarks
            actions["grab"] = any(self._action.judge_grab(hand) for hand in hands)
            if len(hands) == 2:
                actions["clap"] = self._action.judge_crap(hands[0], hands[1])
                actions["kamehameha"] = bool(self._action.is_kamehameha(hands[0], hands[1]))
                actions["kamehameha_continue"] = self._action.judge_kamehameha(hands[0], hands[1])

        return actions, {action_id: {} for action_id in actions}
