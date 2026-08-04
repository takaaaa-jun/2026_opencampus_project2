import { useEffect, useRef, useState } from 'react'
import type { ExplanationProps } from '../../types'
import './TPoseExplanation.css'

type Point = {
  x: number
  y: number
}

type TPoseDetails = {
  left_shoulder_angle: number
  right_shoulder_angle: number
  left_elbow_angle: number
  right_elbow_angle: number
  is_left_shoulder_ok: boolean
  is_right_shoulder_ok: boolean
  is_left_elbow_ok: boolean
  is_right_elbow_ok: boolean
  is_pose_valid: boolean
  elapsed_time: number
  triggered: boolean
}

type ConditionId = 'shoulder' | 'elbow' | 'hold'

type ConditionDetail = {
  title: string
  code: string
}

const TPOSE_DISPLAY_DURATION_MS = 1500

// --- ピクトグラム定数（スティックフィギュア） ---
const FIG_COLOR = '#334155'
const FIG_OK_COLOR = '#22c55e'
const FIG_STROKE_W = 6

// 体の各パーツ座標
const FIG_HEAD = { cx: 110, cy: 40, r: 18 }
const FIG_SHOULDER = { x: 110, y: 70 }
const FIG_LEFT_SHOULDER = { x: 95, y: 70 }
const FIG_RIGHT_SHOULDER = { x: 125, y: 70 }
const FIG_PELVIS = { x: 110, y: 130 }
const FIG_LEFT_HIP = { x: 100, y: 130 }
const FIG_RIGHT_HIP = { x: 120, y: 130 }
const FIG_LEFT_KNEE = { x: 90, y: 170 }
const FIG_RIGHT_KNEE = { x: 130, y: 170 }
const FIG_LEFT_FOOT = { x: 80, y: 210 }
const FIG_RIGHT_FOOT = { x: 140, y: 210 }

const UPPER_ARM_LEN = 35
const FOREARM_LEN = 30

const CONDITION_DETAILS: Record<ConditionId, ConditionDetail> = {
  shoulder: {
    title: '肩の角度（80°〜100°）',
    code: `# MediaPipe Poseランドマーク（11:左肩, 12:右肩, 13:左肘, 14:右肘, 23:左腰, 24:右腰）
left_shoulder_angle = angle(landmarks[13], landmarks[11], landmarks[23])
right_shoulder_angle = angle(landmarks[14], landmarks[12], landmarks[24])

# 左右両方の肩が80°〜100°の範囲内か判定
is_left_shoulder_ok = 80 <= left_shoulder_angle <= 100
is_right_shoulder_ok = 80 <= right_shoulder_angle <= 100`,
  },
  elbow: {
    title: '肘の角度（150°〜180°）',
    code: `# MediaPipe Poseランドマーク（11:左肩, 12:右肩, 13:左肘, 14:右肘, 15:左手首, 16:右手首）
left_elbow_angle = angle(landmarks[11], landmarks[13], landmarks[15])
right_elbow_angle = angle(landmarks[12], landmarks[14], landmarks[16])

# 左右両方の肘が150°〜180°の範囲内か判定
is_left_elbow_ok = 150 <= left_elbow_angle <= 180
is_right_elbow_ok = 150 <= right_elbow_angle <= 180`,
  },
  hold: {
    title: '姿勢を1秒間維持する',
    code: `# すべての姿勢条件を満たしているか
is_pose_valid = (is_left_shoulder_ok and is_right_shoulder_ok and
                 is_left_elbow_ok and is_right_elbow_ok)

# HoldDetector による1秒タイマー管理
if not is_pose_valid:
    start_time = None
    tpose_detected = False
else:
    if start_time is None:
        start_time = time.time()

    elapsed = time.time() - start_time
    tpose_detected = elapsed >= 1.0  # 1秒間維持で判定成功！`,
  },
}


// --- 腕の関節座標計算（2D） ---
function computeArm2D(
  shoulder: { x: number; y: number },
  upperArmDeg: number,
  forearmDeg: number
): { elbowX: number; elbowY: number; wristX: number; wristY: number } {
  const upperArmRad = (upperArmDeg * Math.PI) / 180
  const forearmRad = (forearmDeg * Math.PI) / 180

  const elbowX = shoulder.x + Math.cos(upperArmRad) * UPPER_ARM_LEN
  const elbowY = shoulder.y + Math.sin(upperArmRad) * UPPER_ARM_LEN

  const wristX = elbowX + Math.cos(forearmRad) * FOREARM_LEN
  const wristY = elbowY + Math.sin(forearmRad) * FOREARM_LEN

  return { elbowX, elbowY, wristX, wristY }
}

// --- 角度ゲージバー ---
function AngleGaugeBar({
  currentAngle,
  minOk,
  maxOk,
  passed,
}: {
  currentAngle: number
  minOk: number
  maxOk: number
  passed: boolean
}) {
  const clamped = Math.min(Math.max(currentAngle, 0), 180)
  const leftPos = (clamped / 180) * 100
  const zoneLeft = (minOk / 180) * 100
  const zoneWidth = ((maxOk - minOk) / 180) * 100

  return (
    <div className={`tpose-explanation__gauge${passed ? ' is-passed' : ''}`}>
      <div className="tpose-explanation__gauge-track">
        <div
          className="tpose-explanation__gauge-zone"
          style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }}
        />
        <div
          className="tpose-explanation__gauge-pointer"
          style={{ left: `${leftPos}%` }}
        />
      </div>
    </div>
  )
}

// --- ピクトグラムコンポーネント（スティックフィギュア） ---
function PictogramFigure({
  details,
  landmarks,
  selectedCondition,
}: {
  details: TPoseDetails | null
  landmarks: Array<Point | null>
  selectedCondition: ConditionId | null
}) {
  const isLive = details !== null

  // 2D角度の計算（左右反転対応: カメラに映る左側 = MediaPipeの右腕 = 12, 14, 16）
  let picLeftUpperArmAngle = 180
  let picLeftForearmAngle = 180
  let picRightUpperArmAngle = 0
  let picRightForearmAngle = 0
  let picLeftHipAngle = 90
  let picRightHipAngle = 90

  if (isLive && landmarks.length > 0) {
    const rShoulder = landmarks[12]
    const rElbow = landmarks[14]
    const rWrist = landmarks[16]
    if (rShoulder && rElbow) {
      picLeftUpperArmAngle = (Math.atan2(rElbow.y - rShoulder.y, rElbow.x - rShoulder.x) * 180) / Math.PI
    }
    if (rElbow && rWrist) {
      picLeftForearmAngle = (Math.atan2(rWrist.y - rElbow.y, rWrist.x - rElbow.x) * 180) / Math.PI
    }
    const rHip = landmarks[24]
    if (rShoulder && rHip) {
      picLeftHipAngle = (Math.atan2(rHip.y - rShoulder.y, rHip.x - rShoulder.x) * 180) / Math.PI
    }

    const lShoulder = landmarks[11]
    const lElbow = landmarks[13]
    const lWrist = landmarks[15]
    if (lShoulder && lElbow) {
      picRightUpperArmAngle = (Math.atan2(lElbow.y - lShoulder.y, lElbow.x - lShoulder.x) * 180) / Math.PI
    }
    if (lElbow && lWrist) {
      picRightForearmAngle = (Math.atan2(lWrist.y - lElbow.y, lWrist.x - lElbow.x) * 180) / Math.PI
    }
    const lHip = landmarks[23]
    if (lShoulder && lHip) {
      picRightHipAngle = (Math.atan2(lHip.y - lShoulder.y, lHip.x - lShoulder.x) * 180) / Math.PI
    }
  }

  const leftArm = computeArm2D(FIG_LEFT_SHOULDER, picLeftUpperArmAngle, picLeftForearmAngle)
  const rightArm = computeArm2D(FIG_RIGHT_SHOULDER, picRightUpperArmAngle, picRightForearmAngle)

  const dynLeftHip = {
    x: FIG_LEFT_SHOULDER.x + 60 * Math.cos((picLeftHipAngle * Math.PI) / 180),
    y: FIG_LEFT_SHOULDER.y + 60 * Math.sin((picLeftHipAngle * Math.PI) / 180),
  }
  const dynRightHip = {
    x: FIG_RIGHT_SHOULDER.x + 60 * Math.cos((picRightHipAngle * Math.PI) / 180),
    y: FIG_RIGHT_SHOULDER.y + 60 * Math.sin((picRightHipAngle * Math.PI) / 180),
  }
  const dynPelvis = {
    x: (dynLeftHip.x + dynRightHip.x) / 2,
    y: (dynLeftHip.y + dynRightHip.y) / 2,
  }

  const ghostLeft = computeArm2D(FIG_LEFT_SHOULDER, 180, 180)
  const ghostRight = computeArm2D(FIG_RIGHT_SHOULDER, 0, 0)

  const picLeftShoulderOk = details?.is_right_shoulder_ok ?? false
  const picRightShoulderOk = details?.is_left_shoulder_ok ?? false
  const picLeftElbowOk = details?.is_right_elbow_ok ?? false
  const picRightElbowOk = details?.is_left_elbow_ok ?? false

  const isShoulderFocus = selectedCondition === 'shoulder' || selectedCondition === null || selectedCondition === 'hold'
  const isElbowFocus = selectedCondition === 'elbow' || selectedCondition === null || selectedCondition === 'hold'

  // アークのパス計算（表示時のみ）
  const leftShoulderArc = isLive ? getAngleArcPath({ x: leftArm.elbowX, y: leftArm.elbowY }, FIG_LEFT_SHOULDER, dynLeftHip, 20) : ''
  const rightShoulderArc = isLive ? getAngleArcPath({ x: rightArm.elbowX, y: rightArm.elbowY }, FIG_RIGHT_SHOULDER, dynRightHip, 20) : ''
  const leftElbowArc = isLive ? getAngleArcPath(FIG_LEFT_SHOULDER, { x: leftArm.elbowX, y: leftArm.elbowY }, { x: leftArm.wristX, y: leftArm.wristY }, 18) : ''
  const rightElbowArc = isLive ? getAngleArcPath(FIG_RIGHT_SHOULDER, { x: rightArm.elbowX, y: rightArm.elbowY }, { x: rightArm.wristX, y: rightArm.wristY }, 18) : ''

  return (
    <svg
      viewBox="0 0 220 230"
      className="tpose-explanation__figure-svg"
      role="img"
      aria-label="ピクトグラム人物（腕の角度がリアルタイムで変化）"
    >
      {/* --- ゴースト（薄い目標T-Pose位置） --- */}
      <g opacity={0.13}>
        <line x1={FIG_LEFT_SHOULDER.x} y1={FIG_LEFT_SHOULDER.y} x2={ghostLeft.elbowX} y2={ghostLeft.elbowY}
          stroke="#0284c7" strokeWidth={FIG_STROKE_W} strokeLinecap="round" strokeDasharray="4 4" />
        <line x1={ghostLeft.elbowX} y1={ghostLeft.elbowY} x2={ghostLeft.wristX} y2={ghostLeft.wristY}
          stroke="#0284c7" strokeWidth={FIG_STROKE_W} strokeLinecap="round" strokeDasharray="4 4" />
        <line x1={FIG_RIGHT_SHOULDER.x} y1={FIG_RIGHT_SHOULDER.y} x2={ghostRight.elbowX} y2={ghostRight.elbowY}
          stroke="#0284c7" strokeWidth={FIG_STROKE_W} strokeLinecap="round" strokeDasharray="4 4" />
        <line x1={ghostRight.elbowX} y1={ghostRight.elbowY} x2={ghostRight.wristX} y2={ghostRight.wristY}
          stroke="#0284c7" strokeWidth={FIG_STROKE_W} strokeLinecap="round" strokeDasharray="4 4" />
      </g>

      {/* --- 体幹・脚（固定） --- */}
      <circle cx={FIG_HEAD.cx} cy={FIG_HEAD.cy} r={FIG_HEAD.r} fill="none" stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} opacity={0.3} />
      <line x1={FIG_HEAD.cx} y1={FIG_HEAD.cy + FIG_HEAD.r} x2={dynPelvis.x} y2={dynPelvis.y} stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" opacity={0.3} style={{ transition: 'all 200ms ease' }} />

      {/* 肩から体幹への接続線 */}
      <line x1={FIG_SHOULDER.x} y1={FIG_SHOULDER.y} x2={FIG_LEFT_SHOULDER.x} y2={FIG_SHOULDER.y} 
        stroke={picLeftShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" 
        style={{ transition: 'stroke 200ms ease' }} opacity={isShoulderFocus ? 1 : 0.3} />
      <line x1={FIG_SHOULDER.x} y1={FIG_SHOULDER.y} x2={FIG_RIGHT_SHOULDER.x} y2={FIG_SHOULDER.y} 
        stroke={picRightShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" 
        style={{ transition: 'stroke 200ms ease' }} opacity={isShoulderFocus ? 1 : 0.3} />

      {/* 脚部 */}
      <g opacity={0.3} style={{ transition: 'all 200ms ease' }}>
        <line x1={dynLeftHip.x} y1={dynPelvis.y} x2={dynRightHip.x} y2={dynPelvis.y} stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" />
        <line x1={dynLeftHip.x} y1={dynPelvis.y} x2={FIG_LEFT_KNEE.x} y2={FIG_LEFT_KNEE.y} stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" />
        <line x1={FIG_LEFT_KNEE.x} y1={FIG_LEFT_KNEE.y} x2={FIG_LEFT_FOOT.x} y2={FIG_LEFT_FOOT.y} stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" />
        <line x1={dynRightHip.x} y1={dynPelvis.y} x2={FIG_RIGHT_KNEE.x} y2={FIG_RIGHT_KNEE.y} stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" />
        <line x1={FIG_RIGHT_KNEE.x} y1={FIG_RIGHT_KNEE.y} x2={FIG_RIGHT_FOOT.x} y2={FIG_RIGHT_FOOT.y} stroke={FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round" />
      </g>

      {/* --- 角度測定の補助線（肩から腰） --- */}
      <g opacity={isShoulderFocus ? 1 : 0.2} style={{ transition: 'opacity 200ms ease' }}>
        <line x1={FIG_LEFT_SHOULDER.x} y1={FIG_SHOULDER.y} x2={dynLeftHip.x} y2={dynPelvis.y} stroke={FIG_COLOR} strokeWidth={2.5} strokeDasharray="4 4" opacity={0.6} style={{ transition: 'all 200ms ease' }} />
        <line x1={FIG_RIGHT_SHOULDER.x} y1={FIG_SHOULDER.y} x2={dynRightHip.x} y2={dynPelvis.y} stroke={FIG_COLOR} strokeWidth={2.5} strokeDasharray="4 4" opacity={0.6} style={{ transition: 'all 200ms ease' }} />
        
        {/* 肩の角度アーク（扇形） */}
        {isShoulderFocus && leftShoulderArc && (
          <path d={leftShoulderArc} fill={picLeftShoulderOk ? 'rgba(34, 197, 94, 0.25)' : 'rgba(51, 65, 85, 0.15)'} stroke={picLeftShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={1.5} />
        )}
        {isShoulderFocus && rightShoulderArc && (
          <path d={rightShoulderArc} fill={picRightShoulderOk ? 'rgba(34, 197, 94, 0.25)' : 'rgba(51, 65, 85, 0.15)'} stroke={picRightShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={1.5} />
        )}
      </g>

      {/* --- 動的な腕 --- */}
      {/* 左腕（上腕） */}
      <line x1={FIG_LEFT_SHOULDER.x} y1={FIG_LEFT_SHOULDER.y} x2={leftArm.elbowX} y2={leftArm.elbowY}
        stroke={picLeftShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round"
        style={{ transition: 'stroke 200ms ease' }} opacity={isShoulderFocus || isElbowFocus ? 1 : 0.3} />
      {/* 左腕（前腕） */}
      <line x1={leftArm.elbowX} y1={leftArm.elbowY} x2={leftArm.wristX} y2={leftArm.wristY}
        stroke={picLeftElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round"
        style={{ transition: 'stroke 200ms ease' }} opacity={isElbowFocus ? 1 : 0.3} />

      {/* 右腕（上腕） */}
      <line x1={FIG_RIGHT_SHOULDER.x} y1={FIG_RIGHT_SHOULDER.y} x2={rightArm.elbowX} y2={rightArm.elbowY}
        stroke={picRightShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round"
        style={{ transition: 'stroke 200ms ease' }} opacity={isShoulderFocus || isElbowFocus ? 1 : 0.3} />
      {/* 右腕（前腕） */}
      <line x1={rightArm.elbowX} y1={rightArm.elbowY} x2={rightArm.wristX} y2={rightArm.wristY}
        stroke={picRightElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={FIG_STROKE_W} strokeLinecap="round"
        style={{ transition: 'stroke 200ms ease' }} opacity={isElbowFocus ? 1 : 0.3} />

      {/* --- 肘の角度アーク（扇形） --- */}
      <g opacity={isElbowFocus ? 1 : 0.2} style={{ transition: 'opacity 200ms ease' }}>
        {isElbowFocus && leftElbowArc && (
          <path d={leftElbowArc} fill={picLeftElbowOk ? 'rgba(34, 197, 94, 0.25)' : 'rgba(51, 65, 85, 0.15)'} stroke={picLeftElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={1.5} />
        )}
        {isElbowFocus && rightElbowArc && (
          <path d={rightElbowArc} fill={picRightElbowOk ? 'rgba(34, 197, 94, 0.25)' : 'rgba(51, 65, 85, 0.15)'} stroke={picRightElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={1.5} />
        )}
      </g>

      {/* --- 関節ドット（計算に使用するポイントを明示） --- */}
      {/* 肩 */}
      <circle cx={FIG_LEFT_SHOULDER.x} cy={FIG_SHOULDER.y} r={4.5} fill="#fff" stroke={picLeftShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease' }} opacity={isShoulderFocus || isElbowFocus ? 1 : 0.3} />
      <circle cx={FIG_RIGHT_SHOULDER.x} cy={FIG_SHOULDER.y} r={4.5} fill="#fff" stroke={picRightShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease' }} opacity={isShoulderFocus || isElbowFocus ? 1 : 0.3} />
      
      {/* 肘 */}
      <circle cx={leftArm.elbowX} cy={leftArm.elbowY} r={4.5} fill="#fff" stroke={picLeftElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease, cx 0s, cy 0s' }} opacity={isShoulderFocus || isElbowFocus ? 1 : 0.3} />
      <circle cx={rightArm.elbowX} cy={rightArm.elbowY} r={4.5} fill="#fff" stroke={picRightElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease, cx 0s, cy 0s' }} opacity={isShoulderFocus || isElbowFocus ? 1 : 0.3} />
      
      {/* 手首 */}
      <circle cx={leftArm.wristX} cy={leftArm.wristY} r={4.5} fill="#fff" stroke={picLeftElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease, cx 0s, cy 0s' }} opacity={isElbowFocus ? 1 : 0.3} />
      <circle cx={rightArm.wristX} cy={rightArm.wristY} r={4.5} fill="#fff" stroke={picRightElbowOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease, cx 0s, cy 0s' }} opacity={isElbowFocus ? 1 : 0.3} />
      
      {/* 腰 */}
      <circle cx={dynLeftHip.x} cy={dynPelvis.y} r={4.5} fill="#fff" stroke={picLeftShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease, cx 200ms ease, cy 200ms ease' }} opacity={isShoulderFocus ? 1 : 0.3} />
      <circle cx={dynRightHip.x} cy={dynPelvis.y} r={4.5} fill="#fff" stroke={picRightShoulderOk ? FIG_OK_COLOR : FIG_COLOR} strokeWidth={2.5} style={{ transition: 'stroke 200ms ease, cx 200ms ease, cy 200ms ease' }} opacity={isShoulderFocus ? 1 : 0.3} />

      {/* --- 角度ラベル（検知中のみ） --- */}
      {isLive && (
        <>
          <text x={FIG_LEFT_SHOULDER.x - 12} y={FIG_LEFT_SHOULDER.y + 22}
            fontSize={10} textAnchor="middle" fill={picLeftShoulderOk ? FIG_OK_COLOR : FIG_COLOR} fontWeight="bold">
            肩{details.right_shoulder_angle}°
          </text>
          <text x={FIG_RIGHT_SHOULDER.x + 12} y={FIG_RIGHT_SHOULDER.y + 22}
            fontSize={10} textAnchor="middle" fill={picRightShoulderOk ? FIG_OK_COLOR : FIG_COLOR} fontWeight="bold">
            肩{details.left_shoulder_angle}°
          </text>
          <text x={leftArm.elbowX - 8} y={leftArm.elbowY + 18}
            fontSize={10} textAnchor="middle" fill={picLeftElbowOk ? FIG_OK_COLOR : FIG_COLOR} fontWeight="bold">
            肘{details.right_elbow_angle}°
          </text>
          <text x={rightArm.elbowX + 8} y={rightArm.elbowY + 18}
            fontSize={10} textAnchor="middle" fill={picRightElbowOk ? FIG_OK_COLOR : FIG_COLOR} fontWeight="bold">
            肘{details.left_elbow_angle}°
          </text>
        </>
      )}

    </svg>
  )
}

// --- アーク描画ユーティリティ ---
function getAngleArcPath(
  p1: { x: number; y: number },
  center: { x: number; y: number },
  p2: { x: number; y: number },
  radius: number
): string {
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x)
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x)

  let diff = a2 - a1
  if (diff < -Math.PI) diff += 2 * Math.PI
  if (diff > Math.PI) diff -= 2 * Math.PI

  const sweep = diff > 0 ? 1 : 0

  const startX = center.x + radius * Math.cos(a1)
  const startY = center.y + radius * Math.sin(a1)
  const endX = center.x + radius * Math.cos(a2)
  const endY = center.y + radius * Math.sin(a2)

  // 1つの L で中心に戻り、閉じることで綺麗な扇形(wedge)を描画する
  return `M ${startX} ${startY} A ${radius} ${radius} 0 0 ${sweep} ${endX} ${endY} L ${center.x} ${center.y} Z`
}

// --- ユーティリティ ---
function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return typeof p.x === 'number' && typeof p.y === 'number'
}

function getPoseLandmarks(detectionData: ExplanationProps['detectionData']): Array<Point | null> {
  if (detectionData === null || typeof detectionData.pose !== 'object' || detectionData.pose === null) return []
  const landmarks = (detectionData.pose as Record<string, unknown>).landmarks
  if (!Array.isArray(landmarks)) return []
  return landmarks.map((lm) => (isPoint(lm) ? lm : null))
}

function getTPoseDetails(detectionData: ExplanationProps['detectionData']): TPoseDetails | null {
  if (detectionData === null || typeof detectionData.actionDetails !== 'object' || detectionData.actionDetails === null) return null
  const tpose = (detectionData.actionDetails as Record<string, unknown>).tpose
  if (typeof tpose !== 'object' || tpose === null) return null
  const d = tpose as Record<string, unknown>
  if (
    typeof d.left_shoulder_angle !== 'number' ||
    typeof d.right_shoulder_angle !== 'number' ||
    typeof d.left_elbow_angle !== 'number' ||
    typeof d.right_elbow_angle !== 'number' ||
    typeof d.is_pose_valid !== 'boolean' ||
    typeof d.elapsed_time !== 'number' ||
    typeof d.triggered !== 'boolean'
  ) return null
  return {
    left_shoulder_angle: d.left_shoulder_angle,
    right_shoulder_angle: d.right_shoulder_angle,
    left_elbow_angle: d.left_elbow_angle,
    right_elbow_angle: d.right_elbow_angle,
    is_left_shoulder_ok: d.is_left_shoulder_ok === true,
    is_right_shoulder_ok: d.is_right_shoulder_ok === true,
    is_left_elbow_ok: d.is_left_elbow_ok === true,
    is_right_elbow_ok: d.is_right_elbow_ok === true,
    is_pose_valid: d.is_pose_valid,
    elapsed_time: d.elapsed_time,
    triggered: d.triggered,
  }
}

function isTPoseDetected(detectionData: ExplanationProps['detectionData']) {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) return false
  return (detectionData.actions as Record<string, unknown>).tpose === true
}

// --- 条件ステップ ---
function ConditionStep({
  condition, passed, title, subtitle, children, selected, onSelect,
}: {
  condition: ConditionId
  passed: boolean
  title: string
  subtitle?: string
  children?: React.ReactNode
  selected: boolean
  onSelect: (c: ConditionId) => void
}) {
  return (
    <li className={`tpose-explanation__step${passed ? ' is-passed' : ''}${selected ? ' is-selected' : ''}`}>
      <button type="button" onClick={() => onSelect(condition)} aria-pressed={selected}>
        <div className="tpose-explanation__step-header">
          <span aria-hidden="true">{passed ? '✓' : '○'}</span>
          <div style={{ textAlign: 'left' }}>
            <strong>{title}</strong>
            {subtitle && <p className="tpose-explanation__step-info" style={{ margin: '4px 0 0 0' }}>{subtitle}</p>}
          </div>
        </div>
        {children ? <div className="tpose-explanation__step-content">{children}</div> : null}
      </button>
    </li>
  )
}

// --- コードハイライト ---
function highlightCode(code: string) {
  const tokenPattern = /(\b(?:if|and|or|is|not|None|True|False)\b|\b(?:angle|time\.time)\b|\b[A-Z][A-Z_]+\b|\b\d+(?:\.\d+)?\b)/g
  return code.split('\n').map((line, lineIndex) => (
    <span className="tpose-explanation__code-line" key={`${line}-${lineIndex}`}>
      {line.split(tokenPattern).map((part, i) => {
        if (/^(if|and|or|is|not|None|True|False)$/.test(part))
          return <span className="tpose-explanation__code-token is-keyword" key={i}>{part}</span>
        if (/^(angle|time\.time)$/.test(part))
          return <span className="tpose-explanation__code-token is-function" key={i}>{part}</span>
        if (/^[A-Z][A-Z_]+$/.test(part))
          return <span className="tpose-explanation__code-token is-constant" key={i}>{part}</span>
        if (/^\d+(?:\.\d+)?$/.test(part))
          return <span className="tpose-explanation__code-token is-number" key={i}>{part}</span>
        return part
      })}
      {lineIndex < code.split('\n').length - 1 ? '\n' : null}
    </span>
  ))
}

// --- 詳細パネル ---
function ConditionDetailPanel({ condition, onClose }: { condition: ConditionId; onClose: () => void }) {
  const detail = CONDITION_DETAILS[condition]
  return (
    <section className="tpose-explanation__detail" aria-label={`${detail.title}の詳細`} onClick={(e) => e.stopPropagation()}>
      <div className="tpose-explanation__detail-heading">
        <h2>{detail.title}</h2>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <pre className="tpose-explanation__code-example"><code>{highlightCode(detail.code)}</code></pre>
    </section>
  )
}

// --- メインコンポーネント ---
export function TPoseExplanation({ detectionData }: ExplanationProps) {
  const [activeTab, setActiveTab] = useState<'practice' | 'algorithm'>('algorithm')
  const [isTPoseVisible, setIsTPoseVisible] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false)
  const canShowNextRef = useRef(true)
  const timerRef = useRef<number | null>(null)

  // poseLandmarks は現時点では未使用だが将来的に使える
  const _landmarks = getPoseLandmarks(detectionData)
  void _landmarks

  const details = getTPoseDetails(detectionData)
  const tposeDetected = isTPoseDetected(detectionData)

  useEffect(() => {
    if (!tposeDetected && !isTPoseVisible) {
      canShowNextRef.current = true
    }
    if (!tposeDetected || isTPoseVisible || !canShowNextRef.current) return
    canShowNextRef.current = false
    setIsTPoseVisible(true)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setIsTPoseVisible(false)
    }, TPOSE_DISPLAY_DURATION_MS)
  }, [tposeDetected, isTPoseVisible])

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const isShouldersOk = details ? details.is_left_shoulder_ok && details.is_right_shoulder_ok : false
  const isElbowsOk = details ? details.is_left_elbow_ok && details.is_right_elbow_ok : false
  const isHolding = details ? details.is_pose_valid : false
  const holdProgress = details ? details.elapsed_time / 1.0 : 0

  const statusText = details?.triggered
    ? '十字架（T-POSE）検知！'
    : details?.is_pose_valid
      ? `キープ中 (${details.elapsed_time.toFixed(1)}秒 / 1.0秒)`
      : 'ポーズを合わせてね'

  return (
    <section className="tpose-explanation" aria-label="十字架動作の判定過程">
      <div className="tpose-explanation__tabs">
        <button
          type="button"
          className={`tpose-explanation__tab ${activeTab === 'practice' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('practice')}
        >
          練習
        </button>
        <button
          type="button"
          className={`tpose-explanation__tab ${activeTab === 'algorithm' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('algorithm')}
        >
          十字架判定のしくみ
        </button>
      </div>

      {activeTab === 'practice' && (
        <>
          <p className="tpose-explanation__lead">
            両腕を横に伸ばし（肩角度80°〜100°、肘角度150°〜180°）、その姿勢を1秒間キープすることで判定します
          </p>

          <div className="tpose-explanation__body">
            {/* 左: ピクトグラム */}
            <div className="tpose-explanation__figure-wrap">
              <PictogramFigure details={details} landmarks={_landmarks} selectedCondition={selectedCondition} />
            </div>

            {/* 右: 条件ステップ */}
            <div className="tpose-explanation__panel">
              <ol className="tpose-explanation__conditions">
                <ConditionStep
                  condition="shoulder"
                  passed={isShouldersOk}
                  title="両肩の角度（80°〜100°）"
                  subtitle="肘・肩・腰の三点で計算しています"
                  selected={selectedCondition === 'shoulder'}
                  onSelect={(c) => setSelectedCondition((curr) => (curr === c ? null : c))}
                >
                  {details && (
                    <div className="tpose-explanation__gauges">
                      <div className="tpose-explanation__gauge-wrap">
                        <span className="tpose-explanation__gauge-label">左: {details.left_shoulder_angle}°</span>
                        <AngleGaugeBar currentAngle={details.left_shoulder_angle} minOk={80} maxOk={100} passed={details.is_left_shoulder_ok} />
                      </div>
                      <div className="tpose-explanation__gauge-wrap">
                        <span className="tpose-explanation__gauge-label">右: {details.right_shoulder_angle}°</span>
                        <AngleGaugeBar currentAngle={details.right_shoulder_angle} minOk={80} maxOk={100} passed={details.is_right_shoulder_ok} />
                      </div>
                    </div>
                  )}
                </ConditionStep>

                <ConditionStep
                  condition="elbow"
                  passed={isElbowsOk}
                  title="両肘の角度（150°〜180°）"
                  subtitle="肩・肘・手首の三点で計算しています"
                  selected={selectedCondition === 'elbow'}
                  onSelect={(c) => setSelectedCondition((curr) => (curr === c ? null : c))}
                >
                  {details && (
                    <div className="tpose-explanation__gauges">
                      <div className="tpose-explanation__gauge-wrap">
                        <span className="tpose-explanation__gauge-label">左: {details.left_elbow_angle}°</span>
                        <AngleGaugeBar currentAngle={details.left_elbow_angle} minOk={150} maxOk={180} passed={details.is_left_elbow_ok} />
                      </div>
                      <div className="tpose-explanation__gauge-wrap">
                        <span className="tpose-explanation__gauge-label">右: {details.right_elbow_angle}°</span>
                        <AngleGaugeBar currentAngle={details.right_elbow_angle} minOk={150} maxOk={180} passed={details.is_right_elbow_ok} />
                      </div>
                    </div>
                  )}
                </ConditionStep>

                <ConditionStep
                  condition="hold"
                  passed={isTPoseVisible || (details?.triggered ?? false)}
                  title="1秒間の維持"
                  selected={selectedCondition === 'hold'}
                  onSelect={(c) => setSelectedCondition((curr) => (curr === c ? null : c))}
                >
                  {isHolding && (
                    <div className="tpose-explanation__step-subtitle">
                      進行状況: {(holdProgress * 100).toFixed(0)}%
                    </div>
                  )}
                  <div className="tpose-explanation__progress-bar">
                    <div className="tpose-explanation__progress-fill" style={{ width: `${Math.min(Math.max(holdProgress, 0), 1) * 100}%` }} />
                  </div>
                </ConditionStep>
              </ol>

              {/* 判定結果ウィンドウ */}
              <div className={`tpose-explanation__result-window${details?.triggered ? ' is-triggered' : ''}`}>
                <p className="tpose-explanation__result-text">
                  十字架判定：<span className="tpose-explanation__result-mark">{details?.triggered ? '◯' : '✖'}</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'algorithm' && (
        <div className="tpose-explanation__algorithm">
          <div className="tpose-explanation__body">
            
            {/* 左側: 視覚化（骨格）パネル */}
            <div className="tpose-explanation__visual-panel">
              <div className="tpose-explanation__figure-wrap">
                <PictogramFigure details={details} landmarks={_landmarks} selectedCondition={selectedCondition} />
              </div>
              <div className="tpose-explanation__code-btn-container" style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button 
                  className="tpose-explanation__view-code-btn"
                  onClick={() => setIsCodeModalOpen(true)}
                >
                  実際のコードを見る
                </button>
              </div>
            </div>

            {/* 右側: 解説パネル */}
            <div className="tpose-explanation__text-section">
              <h3 className="tpose-explanation__text-title">十字架の判定のしくみ</h3>
              
              <div className="tpose-explanation__text-block">
                <h4>十字架とは</h4>
                <p>
                  両腕を横に水平に広げて、体全体でT字(十字)を作るポーズです。
                </p>
              </div>

              <div className="tpose-explanation__text-block">
                <h4>角度の計算方法（内積）</h4>
                <p>
                  3つの関節点（例：肘・肩・腰）からベクトルを2本作り、内積の公式で角度を求めています。
                </p>
                <div className="tpose-explanation__math-formula">
                  <span>cosθ = (a · b) / (|a| × |b|)</span>
                  <span>θ = arccos(cosθ)</span>
                </div>
              </div>

              <div className="tpose-explanation__text-block">
                <h4>十字架判定のための条件</h4>
                <p style={{ marginBottom: '1rem', lineHeight: '1.8' }}>
                  このシステムでは、カメラ映像からMediaPipeで検出した骨格点の位置をもとに、十字のポーズの見た目から<br />
                  <span style={{ display: 'inline-block', marginLeft: '1rem', fontWeight: 'bold' }}>
                    ・腰-肩-肘が垂直<br />
                    ・肩-肘-手首が水平<br />
                  </span><br />
                  という特徴が考えられます。この特徴を用いて判定を行っています。
                </p>
                
                <div className="tpose-explanation__logic-item">
                  <h5 className="logic-item-title">1. 肩の角度（80〜100°）</h5>
                  <p className="logic-item-desc">腕が前や下ではなく、真横に水平に上がっているかを判断するためです。</p>
                </div>
                
                <div className="tpose-explanation__logic-item">
                  <h5 className="logic-item-title">2. 肘の角度（150〜180°）</h5>
                  <p className="logic-item-desc">腕が曲がっておらず、まっすぐ水平に伸びているかを判断するためです。</p>
                </div>

                <div className="tpose-explanation__logic-item">
                  <h5 className="logic-item-title">3. 1秒間の維持</h5>
                  <p className="logic-item-desc">腕を振り回した際などに、一瞬だけ十字の形になった誤反応を防ぎ、意図したポーズのみを検知するためです。</p>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* コード表示モーダル */}
      {isCodeModalOpen && (
        <div className="tpose-explanation__code-modal" onClick={() => setIsCodeModalOpen(false)}>
          <div className="tpose-explanation__code-modal-content" onClick={e => e.stopPropagation()}>
            <button className="tpose-explanation__code-modal-close" onClick={() => setIsCodeModalOpen(false)}>閉じる</button>
            <div className="tpose-explanation__code-section">
              <div className="tpose-explanation__code-header">
                <span className="tpose-explanation__code-title">十字架判定の実際のコード</span>
              </div>
              <pre className="tpose-explanation__code-body">
                <code>
{`def angle(first, vertex, third):
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

# MediaPipe Poseランドマーク（11:左肩, 12:右肩, 13:左肘, 14:右肘, 23:左腰, 24:右腰）
left_shoulder_angle = angle(landmarks[13], landmarks[11], landmarks[23])
right_shoulder_angle = angle(landmarks[14], landmarks[12], landmarks[24])

# 左右両方の肩が80°〜100°の範囲内か判定
is_left_shoulder_ok = 80 <= left_shoulder_angle <= 100
is_right_shoulder_ok = 80 <= right_shoulder_angle <= 100

# MediaPipe Poseランドマーク（11:左肩, 12:右肩, 13:左肘, 14:右肘, 15:左手首, 16:右手首）
left_elbow_angle = angle(landmarks[11], landmarks[13], landmarks[15])
right_elbow_angle = angle(landmarks[12], landmarks[14], landmarks[16])

# 左右両方の肘が150°〜180°の範囲内か判定
is_left_elbow_ok = 150 <= left_elbow_angle <= 180
is_right_elbow_ok = 150 <= right_elbow_angle <= 180

# すべての姿勢条件を満たしているか
is_pose_valid = (is_left_shoulder_ok and is_right_shoulder_ok and
                 is_left_elbow_ok and is_right_elbow_ok)

# HoldDetector による1秒タイマー管理
if not is_pose_valid:
    start_time = None
    tpose_detected = False
else:
    if start_time is None:
        start_time = time.time()

    elapsed = time.time() - start_time
    tpose_detected = elapsed >= 1.0  # 1秒間維持で判定成功！`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 詳細オーバーレイ（全体に重なる） */}
      {selectedCondition !== null ? (
        <div className="tpose-explanation__detail-overlay" role="dialog" aria-label="T-POSE判定方法の詳細" onClick={() => setSelectedCondition(null)}>
          <ConditionDetailPanel condition={selectedCondition} onClose={() => setSelectedCondition(null)} />
        </div>
      ) : null}
    </section>
  )
}
