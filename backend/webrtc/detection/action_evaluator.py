"""動作判定をWebRTC送信用の動作IDへ対応づける。"""

from __future__ import annotations

from .action import action
from .actions.hands import get_kamehameha_details


class ActionEvaluator:
    def __init__(self) -> None:
        self._action = action()

    def evaluate(
        self,
        pose_results,
        hands_results,
    ) -> tuple[dict[str, bool], dict[str, dict]]:
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
        cross_arms = self._action.reset_cross_arms()

        if pose_results.pose_landmarks:
            landmarks = pose_results.pose_landmarks.landmark

            pose_coordinates = [
                [landmark.x, landmark.y]
                for landmark in landmarks
            ]

            actions["jump"] = (
                self._action.check_jumping(
                    pose_coordinates
                )
            )

            actions["sit"] = (
                self._action.check_sitting(
                    pose_coordinates
                )
            )

            actions["tpose"] = bool(
                self._action.is_tpose(
                    landmarks
                )
            )

            actions["surprise"] = bool(
                self._action.is_surprise(
                    landmarks
                )
            )

            actions["kick"] = (
                self._action.check_kick(
                    landmarks
                )
            )

            actions["swing"] = (
                self._action.judge_swing(
                    pose_coordinates
                )
            )

            cross_arms = self._action.evaluate_cross_arms(pose_coordinates)
            actions["closs"] = cross_arms.result

            upper = self._action.evaluate_upper(pose_coordinates)
            actions["upper"] = upper.result

            actions["clap"] = (
                self._action.judge_clap(
                    pose_coordinates
                )
            )
        else:
            self._action.reset_clap()
            upper = self._action.reset_upper()

        hands = (
            hands_results.multi_hand_landmarks
            or []
        )

        if hands:
            actions["grab"] = any(
                self._action.judge_grab(hand)
                for hand in hands
            )

            if len(hands) == 2:
                actions["kamehameha"] = bool(
                    self._action.is_kamehameha(
                        hands[0],
                        hands[1],
                    )
                )

                actions["kamehameha_continue"] = (
                    self._action.judge_kamehameha(
                        hands[0],
                        hands[1],
                    )
                )

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

        action_details = {
            action_id: {}
            for action_id in actions
        }

        action_details["clap"] = (
            self._action.clap_details
        )

        action_details["kamehameha"] = (
            kamehameha_details
        )

        action_details["closs"] = cross_arms.to_payload()

        action_details["upper"] = upper.to_payload()

        if pose_results.pose_landmarks:
            action_details["tpose"] = (
                self._action.get_tpose_details(
                    pose_results
                    .pose_landmarks
                    .landmark
                )
            )

        return actions, action_details