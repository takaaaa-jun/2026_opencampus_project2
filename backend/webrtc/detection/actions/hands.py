"""手の動作判定。"""

from .geometry import distance


KAMEHAMEHA_WRIST_DISTANCE_THRESHOLD = 0.05
KAMEHAMEHA_WRIST_X_DISTANCE_THRESHOLD = 0.1
KAMEHAMEHA_MIDDLE_FINGER_X_DISTANCE_THRESHOLD = 0.1


def is_grab(hand_landmarks):
    wrist = hand_landmarks.landmark[0]
    pairs = ((5, 8), (9, 12), (13, 16), (17, 20))

    return all(
        distance(
            hand_landmarks.landmark[tip],
            wrist,
        )
        < distance(
            hand_landmarks.landmark[base],
            wrist,
        )
        for base, tip in pairs
    )


def get_kamehameha_details(first_hand, second_hand):
    """かめはめ波判定に使用する途中値を返す。"""

    first_wrist = first_hand.landmark[0]
    second_wrist = second_hand.landmark[0]

    first_middle_fingertip = first_hand.landmark[12]
    second_middle_fingertip = second_hand.landmark[12]

    # 両手首0番どうしの2次元距離
    wrist_distance = distance(
        first_wrist,
        second_wrist,
    )

    # 両手首0番どうしのx座標差
    wrist_x_distance = abs(
        first_wrist.x
        - second_wrist.x
    )

    # 両中指先12番どうしのx座標差
    middle_finger_x_distance = abs(
        first_middle_fingertip.x
        - second_middle_fingertip.x
    )

    wrist_distance_condition = (
        wrist_distance
        < KAMEHAMEHA_WRIST_DISTANCE_THRESHOLD
    )

    wrist_x_distance_condition = (
        wrist_x_distance
        < KAMEHAMEHA_WRIST_X_DISTANCE_THRESHOLD
    )

    middle_finger_x_distance_condition = (
        middle_finger_x_distance
        < KAMEHAMEHA_MIDDLE_FINGER_X_DISTANCE_THRESHOLD
    )

    pose_condition = (
        wrist_distance_condition
        and wrist_x_distance_condition
        and middle_finger_x_distance_condition
    )

    return {
        "isHandsAvailable": True,

        "wristDistance": wrist_distance,
        "wristDistanceThreshold":
            KAMEHAMEHA_WRIST_DISTANCE_THRESHOLD,
        "wristDistanceCondition":
            wrist_distance_condition,

        "wristXDistance": wrist_x_distance,
        "wristXDistanceThreshold":
            KAMEHAMEHA_WRIST_X_DISTANCE_THRESHOLD,
        "wristXDistanceCondition":
            wrist_x_distance_condition,

        "middleFingerXDistance":
            middle_finger_x_distance,
        "middleFingerXDistanceThreshold":
            KAMEHAMEHA_MIDDLE_FINGER_X_DISTANCE_THRESHOLD,
        "middleFingerXDistanceCondition":
            middle_finger_x_distance_condition,

        "poseCondition": pose_condition,
    }


def get_empty_kamehameha_details():
    """両手が検出されていない場合の途中値を返す。"""

    return {
        "isHandsAvailable": False,

        "wristDistance": None,
        "wristDistanceThreshold":
            KAMEHAMEHA_WRIST_DISTANCE_THRESHOLD,
        "wristDistanceCondition": False,

        "wristXDistance": None,
        "wristXDistanceThreshold":
            KAMEHAMEHA_WRIST_X_DISTANCE_THRESHOLD,
        "wristXDistanceCondition": False,

        "middleFingerXDistance": None,
        "middleFingerXDistanceThreshold":
            KAMEHAMEHA_MIDDLE_FINGER_X_DISTANCE_THRESHOLD,
        "middleFingerXDistanceCondition": False,

        "poseCondition": False,

        "holdDuration": 0.0,
        "holdDurationThreshold": 3.0,
    }


def is_kamehameha(first_hand, second_hand):
    """かめはめ波の姿勢条件が成立しているか返す。"""

    details = get_kamehameha_details(
        first_hand,
        second_hand,
    )

    return details["poseCondition"]