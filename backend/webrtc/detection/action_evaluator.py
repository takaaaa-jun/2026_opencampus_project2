"""既存のaction()をWebRTC送信用の動作判定へ接続する。"""

from __future__ import annotations

from .action import action


class ActionEvaluator:
    """判定ロジックを変更せず、送信用の動作名へ対応づける。"""

    def __init__(self) -> None:
        self._action = action()

    def evaluate(self, pose_results, hands_results) -> tuple[dict[str, bool], dict[str, dict]]:
        self._action.reset_message()

        if pose_results.pose_landmarks:
            landmarks = pose_results.pose_landmarks.landmark
            pose_coordinates = [[landmark.x, landmark.y] for landmark in landmarks]

            if self._action.check_jumping(pose_coordinates):
                self._action.change_message("jump")
            if self._action.check_sitting(pose_coordinates):
                self._action.change_message("sit")
            if self._action.is_tpose(landmarks):
                self._action.change_message("tpose")

        if hands_results.multi_hand_landmarks:
            hands = hands_results.multi_hand_landmarks
            if any(self._action.judge_grab(hand) for hand in hands):
                self._action.change_message("grab")
            if len(hands) == 2 and self._action.judge_crap(hands[0], hands[1]):
                self._action.change_message("crap")

        legacy_actions = dict(self._action.message)
        self._action.reset_message()
        actions = {
            "jump": legacy_actions["jump"],
            "sit": legacy_actions["sit"],
            "tpose": legacy_actions["tpose"],
            "clap": legacy_actions["crap"],
            "grab": legacy_actions["grab"],
        }
        return actions, {action_id: {} for action_id in actions}
