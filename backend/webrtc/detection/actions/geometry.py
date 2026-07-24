"""ランドマークの幾何計算。"""

import math


def point_xy(point):
    """MediaPipe のランドマークまたは (x, y) から座標を返す。"""
    if hasattr(point, "x"):
        return point.x, point.y
    return point[0], point[1]


def distance(first, second):
    first_x, first_y = point_xy(first)
    second_x, second_y = point_xy(second)
    return math.hypot(first_x - second_x, first_y - second_y)


def angle(first, vertex, third):
    first_x, first_y = point_xy(first)
    vertex_x, vertex_y = point_xy(vertex)
    third_x, third_y = point_xy(third)
    first_vector = (first_x - vertex_x, first_y - vertex_y)
    third_vector = (third_x - vertex_x, third_y - vertex_y)
    first_length = math.hypot(*first_vector)
    third_length = math.hypot(*third_vector)
    if first_length == 0 or third_length == 0:
        return 0.0
    cosine = (first_vector[0] * third_vector[0] + first_vector[1] * third_vector[1]) / (first_length * third_length)
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


def point_segment_distance(point, start, end):
    px, py = point_xy(point)
    sx, sy = point_xy(start)
    ex, ey = point_xy(end)
    dx, dy = ex - sx, ey - sy
    if dx == 0 and dy == 0:
        return math.hypot(px - sx, py - sy)
    position = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)
    position = max(0.0, min(1.0, position))
    return math.hypot(px - (sx + position * dx), py - (sy + position * dy))


def segments_intersect(first_start, first_end, second_start, second_end):
    def ccw(first, second, third):
        ax, ay = point_xy(first)
        bx, by = point_xy(second)
        cx, cy = point_xy(third)
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)

    return ccw(first_start, first_end, second_start) * ccw(first_start, first_end, second_end) <= 0 and ccw(second_start, second_end, first_start) * ccw(second_start, second_end, first_end) <= 0


def segment_distance(first_start, first_end, second_start, second_end):
    if segments_intersect(first_start, first_end, second_start, second_end):
        return 0.0
    return min(
        point_segment_distance(first_start, second_start, second_end),
        point_segment_distance(first_end, second_start, second_end),
        point_segment_distance(second_start, first_start, first_end),
        point_segment_distance(second_end, first_start, first_end),
    )
