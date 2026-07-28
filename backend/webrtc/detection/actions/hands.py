"""手の動作判定。"""

from .geometry import distance


def is_grab(hand_landmarks):
    wrist = hand_landmarks.landmark[0]
    pairs = ((5, 8), (9, 12), (13, 16), (17, 20))
    return all(distance(hand_landmarks.landmark[tip], wrist) < distance(hand_landmarks.landmark[base], wrist) for base, tip in pairs)


def is_kamehameha(first_hand, second_hand):
    first_wrist, second_wrist = first_hand.landmark[0], second_hand.landmark[0]
    return (distance(first_wrist, second_wrist) < 0.05 and
            abs(first_wrist.x - second_wrist.x) < 0.1 and
            abs(first_hand.landmark[12].x - second_hand.landmark[12].x) < 0.1)
