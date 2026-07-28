"""動作判定をWebRTC送信用の動作IDへ対応づける。"""

from __future__ import annotations

from .action import action
from .actions.hands import get_kamehameha_details

class ActionEvaluator:
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

        kamehameha_details = {}

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
            actions["upper"] = self._action.judge_uppercut(pose_coordinates)
            actions["clap"] = self._action.judge_clap(pose_coordinates)
        else:
            self._action.reset_clap()

        hands = hands_results.multi_hand_landmarks or []
        if hands:
            actions["grab"] = any(self._action.judge_grab(hand) for hand in hands)
            if len(hands) == 2:
                actions["kamehameha"] = bool(self._action.is_kamehameha(hands[0], hands[1]))
                actions["kamehameha_continue"] = self._action.judge_kamehameha(hands[0], hands[1])
                kamehameha_details = (
                    get_kamehameha_details(
                        hands[0],
                        hands[1],
                    )
                )
                kamehameha_details[
                    "holdDuration"
                ] = 0.0

                kamehameha_details[
                    "holdDurationThreshold"
                ] = 3.0

        action_details = {action_id: {} for action_id in actions}
        action_details["clap"] = self._action.clap_details
        action_details["kamehameha"] = kamehameha_details
        return actions, action_details
