"""別班から引き継いだ動作判定ロジック。"""

from collections import deque
import time
import math

class action() :
    def __init__(self) :
        self._jump_last_frames: deque = deque(maxlen=25)
        self._swing_last_frames: deque = deque(maxlen=15)
        self._tpose_start_time = None #時間のための変数，Tポーズを始めた時刻
        self._tpose_detected = False #Tポーズを認識したかどうかの変数，最初は認識してないからFalse
        self._kamehameha_start_time = None #かめはめ波を始めた時間
        self._kamehameha_detected = False #かめはめ波を認識したかどうか
        self.wrist_y = deque(maxlen=10) #手首の座標を取得するためのdeque       
        #　追加
        self._surprise_start_time = None #時間のための変数，驚かしポーズを始めた時刻
        self._surprise_detected = False #驚かしポーズを認識したかどうかの変数，最初は認識してないからFalse
        #追加
        self._message = {"surprise": False, "Kick": False, "jump": False, "sit": False, "crap": False, "grab": False, "tpose": False, "surprise": False, "kamehameha": False, "kamehameha_continue": False, "swing": False, "closs": False}
    
    @property
    def jump_last_frames(self) :
        return self._jump_last_frames
    
    @property
    def swing_last_frames(self) :
        return self._swing_last_frames
    
    @property
    def message(self) :
        return self._message
    
    @property
    def tpose_start_time(self) :
        return self._tpose_start_time
    
    @property
    def tpose_detected(self) :
        return self._tpose_detected
    
    @property
    def kamehameha_start_time(self):
        return self._kamehameha_start_time
    
    @property
    def kamehameha_detected(self):
        return self._kamehameha_detected

    @property #追加
    def surprise_start_time(self):
        return self._surprise_start_time

    @property #追加
    def surprise_detected(self):
        return self._surprise_detected
    
    def update_tpose_start_time(self, v) :
        self._tpose_start_time = v
        
    def update_topse_detected(self, v) :
        self._tpose_detected = v

    def update_kamehameha_start_time(self, v) :
        self._kamehameha_start_time = v
        
    def update_kamehameha_detected(self, v) :
        self._kamehameha_detected = v

        
    #追加    
    def update_surprise_start_time(self, v):
        self._surprise_start_time = v

    #追加
    def update_surprise_detected(self, v):
        self._surprise_detected = v   
    
    def add_que(self, frame) :
        self._last_frames.append(frame)
    def add_jump_que(self, frame) :
        self._jump_last_frames.append(frame)

    def add_swing_que(self, frame) :
        self._swing_last_frames.append(frame)

    def check_jumping(self, now_frame) :
        left_hip = now_frame[23][1] #45
        #self.last_frames.append(left_hip)
        self.add_jump_que(left_hip)
        if len(self.jump_last_frames) == 25 :
            
            left_foot = (self.jump_last_frames[0]+ self.jump_last_frames[1]+ self.jump_last_frames[2]) / 3
            left_side = (self.jump_last_frames[5]+ self.jump_last_frames[6]+ self.jump_last_frames[7]) / 3
            top =  (self.jump_last_frames[10]+ self.jump_last_frames[11]+ self.jump_last_frames[12]) / 3
            right_side = (self.jump_last_frames[15]+ self.jump_last_frames[16]+ self.jump_last_frames[17]) / 3
            right_foot = (self.jump_last_frames[20]+ self.jump_last_frames[21]+ self.jump_last_frames[22]) / 3
            if (left_foot > left_side and left_side > top and top < right_side and right_side < right_foot and left_foot - top >= 0.05) :
                return True
            else :
                return False
        else :
            return False
        
    def check_sitting(self, now_frame): 
        left_hip = now_frame[23][1]
        right_hip = now_frame[24][1]
        left_knee = now_frame[25][1]
        right_knee = now_frame[26][1]
        
        if left_hip > left_knee and right_hip > right_knee :
            return True
        else :
            return False
    
    def calc_angle(self, a, b, c):
        """
        a, b, c : (x, y)
        bを頂点とした角度を返す
        """
        #ベクトル
        ba = (a[0] - b[0], a[1] - b[1])
        bc = (c[0] - b[0], c[1] - b[1])
        #内積
        dot = ba[0] * bc[0] + ba[1] * bc[1]
        #ベクトルの長さ
        norm_ba = math.sqrt(ba[0]**2 + ba[1]**2)
        norm_bc = math.sqrt(bc[0]**2 + bc[1]**2)
        #cosθ=内積/|ba||bc|
        cos_theta = dot / (norm_ba * norm_bc)

        # 誤差対策(1.00000001と-1.00000001になることがあるらしくそれを防ぐ)
        cos_theta = max(-1.0, min(1.0, cos_theta))
        #acosでθを求める，acos(cos_theta)はラジアン(π/2など)で返すためmath.degrees()で度数法(90°など)に変換
        angle = math.degrees(math.acos(cos_theta))

        return angle

    # 肩，肘角度のためのランドマークについて
    def check_tpose(self, landmarks):
        # 左
        left_shoulder = (landmarks[11].x, landmarks[11].y)
        left_elbow = (landmarks[13].x, landmarks[13].y)
        left_hip = (landmarks[23].x, landmarks[23].y)
        left_wrist = (landmarks[15].x, landmarks[15].y)
        # 右
        right_shoulder = (landmarks[12].x, landmarks[12].y)
        right_elbow = (landmarks[14].x, landmarks[14].y)
        right_hip = (landmarks[24].x, landmarks[24].y)
        right_wrist = (landmarks[16].x, landmarks[16].y)
        # 肩角度を計算
        left_shoulder_angle = self.calc_angle(left_elbow, left_shoulder, left_hip)
        right_shoulder_angle = self.calc_angle(right_elbow, right_shoulder, right_hip)
        # 肘角度を計算
        left_elbow_angle = self.calc_angle(left_shoulder, left_elbow, left_wrist)
        right_elbow_angle = self.calc_angle(right_shoulder, right_elbow, right_wrist)
        # 角度表示
        return (
            80 <= left_shoulder_angle <= 100 and
            80 <= right_shoulder_angle <= 100 and
            150 <= left_elbow_angle <= 180 and
            150 <= right_elbow_angle <= 180
        )
    
    def judge_upper(self, landmarks):

        #ランドマーク取得
        shoulder = {
            "left_shoulder": landmarks[11],
            "right_shoulder": landmarks[12]
        }
        elbow = {
            "left_elbow": landmarks[13],
            "right_elbow": landmarks[14]
        }
        wrist = {
            "left_wrist": landmarks[15],
            "right_wrist": landmarks[16] 
        }
        
        left_v = self.update_speed(wrist["left_wrist"].x, wrist["left_wrist"].y)
        right_v = self.update_speed(wrist["right_wrist"].x, wrist["right_wrist"].y)

        if (
            ((left_v > 1.2) and (wrist["left_wrist"].y > shoulder["left_shoulder"].y)) or 
            ((right_v > 1.2) and (wrist["right_wrist"].y > shoulder["right_shoulder"].y))
        ):
            return True
        else:
            return False
            
    def is_tpose(self, landmarks) :
            # T字判定（6/30追加）
            
        if self.check_tpose(landmarks):

            # Tポーズ開始時刻を記録
            if self.tpose_start_time is None:
                # tpose_start_time = time.time() #開始時刻を保存
                self.update_tpose_start_time(time.time())
                return False

            # 3秒以上維持したら認識
            elif time.time() - self.tpose_start_time >= 1: #開始時間と維持を続けた時の現在時間を比較
                self.update_topse_detected(True)
                return True
        else:
            # 条件を外れたらリセット
            #tpose_start_time = None
            self.update_tpose_start_time(None)
            #tpose_detected = False
            self.update_topse_detected(False)
            return False

    #追加    
    def check_surprise(self, landmarks):
        # 左
        left_shoulder = (landmarks[11].x, landmarks[11].y)
        left_elbow = (landmarks[13].x, landmarks[13].y)
        left_hip = (landmarks[23].x, landmarks[23].y)
        left_wrist = (landmarks[15].x, landmarks[15].y)

        # 右
        right_shoulder = (landmarks[12].x, landmarks[12].y)
        right_elbow = (landmarks[14].x, landmarks[14].y)
        right_hip = (landmarks[24].x, landmarks[24].y)
        right_wrist = (landmarks[16].x, landmarks[16].y)

        # 肩角度を計算
        left_shoulder_angle = self.calc_angle(left_elbow, left_shoulder, left_hip)
        right_shoulder_angle = self.calc_angle(right_elbow, right_shoulder, right_hip)

        # 肘角度を計算 
        left_elbow_angle = self.calc_angle(left_shoulder, left_elbow, left_wrist)
        right_elbow_angle = self.calc_angle(right_shoulder, right_elbow, right_wrist)

        # 肩幅
        shoulder_width = abs(right_shoulder[0] - left_shoulder[0])

        # 手首間距離
        wrist_width = abs(right_wrist[0] - left_wrist[0])

        # デバッグ用（必要なら）
        # print(f"L肩:{left_shoulder_angle:.1f}, R肩:{right_shoulder_angle:.1f}")
        # print(f"L肘:{left_elbow_angle:.1f}, R肘:{right_elbow_angle:.1f}")
        # print(f"肩幅:{shoulder_width:.3f}, 手首間:{wrist_width:.3f}")

        return (
            120 <= left_shoulder_angle <= 170 and
            120 <= right_shoulder_angle <= 170 and
            120 <= left_elbow_angle <= 180 and
            120 <= right_elbow_angle <= 180 and
            wrist_width > shoulder_width #両手首の距離が肩幅より大きい
        ) 

#追加
    def is_surprise(self, landmarks):

        # 驚かしポーズ判定
        if self.check_surprise(landmarks):

            # 開始時刻を記録
            if self.surprise_start_time is None:
                self.update_surprise_start_time(time.time())
                return False

            # 1秒以上維持したら認識
            elif time.time() - self.surprise_start_time >= 1:
                self.update_surprise_detected(True)
                return True

        else:
            # 条件を外れたらリセット
            self.update_surprise_start_time(None)
            self.update_surprise_detected(False)
            return False

    # 2点間の距離
    def distance(self, p1, p2):
        return math.sqrt(
            (p1.x - p2.x) ** 2 +
            (p1.y - p2.y) ** 2
        )
        
    def judge_crap(self, hand1, hand2):

        hand_distance = self.distance(
            hand1.landmark[13],
            hand2.landmark[13]
        )

        # しきい値
        if hand_distance < 0.05:
            return True
        else :
            return False

    #追加キック(右足なら左斜め前にける，左足なら右斜め前にける)
    def check_kick(self, landmarks):
        # 左
        left_hip = (landmarks[23].x, landmarks[23].y)
        left_knee = (landmarks[25].x,landmarks[25].y)
        left_ankle = (landmarks[27].x,landmarks[27].y)

        # 右
        right_hip = (landmarks[24].x,landmarks[24].y)
        right_knee = (landmarks[26].x, landmarks[26].y)
        right_ankle = (landmarks[28].x, landmarks[28].y)

        # 膝角度
        left_knee_angle = self.calc_angle(left_hip, left_knee, left_ankle)
        right_knee_angle = self.calc_angle(right_hip, right_knee, right_ankle)

        # 左足
        left_to_left = self.distance(landmarks[23], landmarks[27])
        right_to_left = self.distance(landmarks[24], landmarks[27])

        # 右足
        right_to_right = self.distance(landmarks[24], landmarks[28])
        left_to_right = self.distance(landmarks[23], landmarks[28])

        if (
            left_knee_angle > 155 and
            left_to_left > right_to_left     #左膝と左足首の距離が右膝と左足首の距離より大きい
        ) or (
            right_knee_angle > 155 and
            right_to_right > left_to_right   #右膝と右足首の距離が左膝と右足首の距離より大きい
        ):
            return True
        else:
            return False

    #「掴む」を判定する関数
    def judge_grab(self, hand_landmarks):
        wrist = hand_landmarks.landmark[0]

        base_tip_pairs = [
        (5, 8),
        (9, 12),
        (13, 16),
        (17, 20)
        ]

        count = 0

        for base_idx, tip_idx in base_tip_pairs:
            base = hand_landmarks.landmark[base_idx]
            tip = hand_landmarks.landmark[tip_idx]

            base_wrist_distance = self.distance(wrist, base)
            tip_wrist_distance = self.distance(wrist, tip)

            if tip_wrist_distance < base_wrist_distance:
                count += 1
        
        return count == 4
    
    def change_message(self, message: str) :
        if (message in self.message) :
            self.message[message] = True
    
    def reset_message(self) :
        #self._message = {"jump": False, "sit": False, "crap": False, "grab": False, "tpose": False}
        for key, _ in self.message.items() :
            self.message[key] = False

        #かめはめ波を判定
    def judge_kamehameha(self, hand1, hand2):
        hand_distance = self.distance(
            hand1.landmark[0],
            hand2.landmark[0]
        )

        abs_wrist = abs(hand1.landmark[0].x - hand2.landmark[0].x)
        abs_mid_finger = abs(hand1.landmark[12].x - hand2.landmark[12].x)

        if (
            (hand_distance < 0.05) and
            (abs_wrist < 0.1) and (abs_mid_finger < 0.1)
        ):
            return True
        
        else:
            return False


    #かめはめ波を判定
    def is_kamehameha(self, hand1, hand2) :
            
        if self.judge_kamehameha(hand1, hand2):

            # かめはめ波の開始時刻を設定
            if self.kamehameha_start_time is None:
                self.update_kamehameha_start_time(time.time())
                return False

            # 3秒以上維持したら認識
            elif time.time() - self.kamehameha_start_time >= 3: #開始時間と維持を続けた時の現在時間を比較
                self.update_kamehameha_detected(True)
                return True
        else:
            # 条件を外れたらリセット
            self.update_kamehameha_start_time(None)
            self.update_kamehameha_detected(False)
            return False
        
    def judge_upper(self, wrist_y, shoulder_y):
        self.wrist_y.append(wrist_y)

        if len(self.wrist_y) < 10:
            return False
        
        start = sum(list(self.wrist_y[0:3])) / 3
        end = sum(list(self.wrist_y[-3:])) / 3

        dy = start - end

        if (
            (wrist_y < shoulder_y) and
            dy > 0.06
        ):
            return True
        
        return False
    
    def judge_swing(self, now_frame) :
        left_wrist = now_frame[15]
        right_wrist = now_frame[16]
        hands_height = 0
        
        """
        if abs(left_wrist[0] - right_wrist[0]) <= 0.1 :
            hands_height = left_wrist[1]
            print("swing: closing both hands")
        """
        
        hands_height = ( left_wrist[1] + right_wrist[1] ) / 2
        print(hands_height)
        self.add_swing_que(hands_height)
        if len(self.swing_last_frames) == 15 :
            
            top = (self.swing_last_frames[0]+ self.swing_last_frames[1]+ self.swing_last_frames[2]) / 3
            middle =  (self.swing_last_frames[6]+ self.swing_last_frames[7]+ self.swing_last_frames[8]) / 3
            foot = (self.swing_last_frames[12]+ self.swing_last_frames[13]+ self.swing_last_frames[14]) / 3
            print(f"top: {top}, middle: {middle}, foot: {foot}")
            if (top < middle and middle < foot and foot - top >= 0.1) :
                return True
            else :
                return False
        else :
            return False

    # 水平判定
    def is_horizontal(self, angle):
        return (
            abs(angle) <= 30 or
            abs(abs(angle) - 180) <= 30
        )
    
    # 鉛直判定
    def is_vertical(self, angle):
        return abs(abs(angle) - 90) <= 30
    
    # 点と線分の最短距離を算出
    def point_segment_distance(self, p, s, e):

        sx, sy = s
        ex, ey = e
        px, py = p

        dx = ex - sx
        dy = ey - sy

        # 線分の長さが0（始点と終点が同じ）
        if dx == 0 and dy == 0:
            return math.hypot(px - sx, py - sy)

        # 射影位置
        t = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)

        # 線分内に収める
        t = max(0.0, min(1.0, t))

        nearest_x = sx + t * dx
        nearest_y = sy + t * dy

        return math.hypot(px - nearest_x, py - nearest_y)

    def ccw(self, a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    # 線分同士の交差判定
    def segments_intersect(self, a1, a2, b1, b2):

        c1 = self.ccw(a1, a2, b1)
        c2 = self.ccw(a1, a2, b2)
        c3 = self.ccw(b1, b2, a1)
        c4 = self.ccw(b1, b2, a2)

        return c1 * c2 <= 0 and c3 * c4 <= 0

    # 2つの線分の最短距離を算出
    def segment_distance(self, left_arm, right_arm):
        ls, le = left_arm
        rs, re = right_arm

        # 交差判定
        if self.segments_intersect(ls, le, rs, re):
            return 0.0

        return min(
            self.point_segment_distance(ls, rs, re),
            self.point_segment_distance(le, rs, re),
            self.point_segment_distance(rs, ls, le),
            self.point_segment_distance(re, ls, le),
        )

    def judge_closs_arms(self, now_frame) :
        # 閾値
        th = 0.1
        
        # 肘と手首の座標
        left_elbow = now_frame[13]
        right_elbow = now_frame[14]
        left_wrist = now_frame[15]
        right_wrist = now_frame[16]

        # 肘と手首から腕の角度を算出
        left_angle = math.degrees(
            math.atan2(
                left_wrist[1] - left_elbow[1],
                left_wrist[0] - left_elbow[0]
            )
        )
        right_angle = math.degrees(
            math.atan2(
                right_wrist[1] - right_elbow[1],
                right_wrist[0] - right_elbow[0]
            )
        )
        
        # 手の向き判定
        left_horiz = self.is_horizontal(left_angle)
        right_horiz = self.is_horizontal(right_angle)
        left_vert = self.is_vertical(left_angle)
        right_vert = self.is_vertical(right_angle)

        dist = self.segment_distance([left_elbow, left_wrist], [right_elbow, right_wrist])

        # 左右の手の肘と手首を結んだ線分の距離が閾値未満であり、かつ片方が鉛直、片方が水平ならTrueを返す
        if dist <= th :
            if (left_horiz and right_vert) or (right_horiz and left_vert):
                return True
        else :
            False
