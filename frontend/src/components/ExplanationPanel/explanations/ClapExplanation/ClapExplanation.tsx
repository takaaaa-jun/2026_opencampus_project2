import { useEffect, useRef, useState } from 'react'
import type { ExplanationProps } from '../../types'
import './ClapExplanation.css'

type Point = {
  x: number
  y: number
}

type ClapDetails = {
  isPoseAvailable: boolean
  leftPalmCenter: Point | null
  rightPalmCenter: Point | null
  hasApproached: boolean
  isCloseEnough: boolean
  isStopped: boolean
  isSeparatingAfterClose: boolean
  isCoolingDown: boolean
  triggered: boolean
}

type ConditionId = 'approach' | 'distance' | 'contact'

type ConditionDetail = {
  title: string
  summary: string
  code: string
}

const LEFT_PALM_POINTS = [15, 17, 19, 21]
const RIGHT_PALM_POINTS = [16, 18, 20, 22]
const CLAP_DISPLAY_DURATION_MS = 1500
const CONDITION_DETAILS: Record<ConditionId, ConditionDetail> = {
  approach: {
    title: '手のひらが近づいた',
    summary: '前のフレームと今のフレームを比べて、左右の手のひら中心どうしが近づいたかを見ます。',
    code: `# MediaPipe Poseが検出した33個の骨格点
landmarks = pose_results.pose_landmarks.landmark

# 左右4点の平均を、手のひら中心にする
left_palm = average(landmarks[15], landmarks[17],
                    landmarks[19], landmarks[21])
right_palm = average(landmarks[16], landmarks[18],
                     landmarks[20], landmarks[22])

current_distance = distance_between(left_palm, right_palm)

# 前フレームと比べて、近づく速さを計算する
elapsed = now - previous_time
closing_speed = (previous_distance - current_distance) / elapsed

# 次のフレームで使う値を保存する
previous_distance = current_distance
previous_time = now

if closing_speed >= APPROACH_SPEED:
    approach_frames += 1

has_approached = approach_frames >= 2`,
  },
  distance: {
    title: '十分に近い',
    summary: '手のひら中心どうしの距離が近いかを、体の大きさに合わせて確かめます。',
    code: `# 手のひら中心は「近づいた」の条件で計算済み
palm_distance = distance_between(left_palm, right_palm)

# MediaPipeの肩の骨格点（11番・12番）を使う
shoulder_width = distance_between(landmarks[11], landmarks[12])

# 体の大きさによらず比べられる距離にする
normalized_distance = palm_distance / shoulder_width

is_close_enough = normalized_distance <= CONTACT_DISTANCE`,
  },
  contact: {
    title: '近い位置で止まった、または跳ね返った',
    summary: '手が当たると動きは小さくなるか、すぐに離れる向きへ変わります。',
    code: `# closing_speed は前フレームとの差から計算済み
is_stopped = abs(closing_speed) <= STOP_SPEED

# 近づいたあと、離れる向きに変わったか
is_separating = has_been_close and \\
                 closing_speed <= -REBOUND_SPEED

if has_approached and is_close_enough and \\
   (is_stopped or is_separating):
    clap = True`,
  },
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const point = value as Record<string, unknown>
  return typeof point.x === 'number' && typeof point.y === 'number'
}

function getPoseLandmarks(detectionData: ExplanationProps['detectionData']): Array<Point | null> {
  if (detectionData === null || typeof detectionData.pose !== 'object' || detectionData.pose === null) {
    return []
  }

  const landmarks = (detectionData.pose as Record<string, unknown>).landmarks
  if (!Array.isArray(landmarks)) {
    return []
  }

  return landmarks.map((landmark) => (isPoint(landmark) ? landmark : null))
}

function getClapDetails(detectionData: ExplanationProps['detectionData']): ClapDetails | null {
  if (detectionData === null || typeof detectionData.actionDetails !== 'object' || detectionData.actionDetails === null) {
    return null
  }

  const clap = (detectionData.actionDetails as Record<string, unknown>).clap
  if (typeof clap !== 'object' || clap === null) {
    return null
  }

  const details = clap as Record<string, unknown>
  if (
    typeof details.isPoseAvailable !== 'boolean' ||
    typeof details.hasApproached !== 'boolean' ||
    typeof details.isCloseEnough !== 'boolean' ||
    typeof details.isStopped !== 'boolean' ||
    typeof details.isCoolingDown !== 'boolean' ||
    typeof details.triggered !== 'boolean'
  ) {
    return null
  }

  return {
    isPoseAvailable: details.isPoseAvailable,
    leftPalmCenter: isPoint(details.leftPalmCenter) ? details.leftPalmCenter : null,
    rightPalmCenter: isPoint(details.rightPalmCenter) ? details.rightPalmCenter : null,
    hasApproached: details.hasApproached,
    isCloseEnough: details.isCloseEnough,
    isStopped: details.isStopped,
    isSeparatingAfterClose: details.isSeparatingAfterClose === true,
    isCoolingDown: details.isCoolingDown,
    triggered: details.triggered,
  }
}

function LandmarkGroup({ landmarks, indices, color }: { landmarks: Array<Point | null>; indices: number[]; color: string }) {
  return (
    <>
      {indices.map((index) => {
        const point = landmarks[index]
        if (point === undefined || point === null) {
          return null
        }

        return (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={0.012} fill={color} />
            <text x={point.x + 0.018} y={point.y - 0.018} fontSize={0.032} className="clap-explanation__landmark-label">
              {index}
            </text>
          </g>
        )
      })}
    </>
  )
}

function ConditionStep({
  condition,
  passed,
  title,
  selected,
  onSelect,
}: {
  condition: ConditionId
  passed: boolean
  title: string
  selected: boolean
  onSelect: (condition: ConditionId) => void
}) {
  return (
    <li className={`${passed ? 'is-passed' : ''}${selected ? ' is-selected' : ''}`}>
      <button type="button" onClick={() => onSelect(condition)} aria-pressed={selected}>
        <span aria-hidden="true">{passed ? '✓' : '○'}</span>
        <strong>{title}</strong>
        <span className="clap-explanation__condition-action" aria-hidden="true">詳しく見る</span>
      </button>
    </li>
  )
}

function highlightCode(code: string) {
  const tokenPattern = /(\b(?:if|and|or|is|not|None|True|False)\b|\b(?:average|distance_between|abs)\b|\b[A-Z][A-Z_]+\b|\b\d+(?:\.\d+)?\b)/g

  return code.split('\n').map((line, lineIndex) => (
    <span className="clap-explanation__code-line" key={`${line}-${lineIndex}`}>
      {line.split(tokenPattern).map((part, partIndex) => {
        if (/^(if|and|or|is|not|None|True|False)$/.test(part)) {
          return <span className="clap-explanation__code-token is-keyword" key={partIndex}>{part}</span>
        }

        if (/^(average|distance_between|abs)$/.test(part)) {
          return <span className="clap-explanation__code-token is-function" key={partIndex}>{part}</span>
        }

        if (/^[A-Z][A-Z_]+$/.test(part)) {
          return <span className="clap-explanation__code-token is-constant" key={partIndex}>{part}</span>
        }

        if (/^\d+(?:\.\d+)?$/.test(part)) {
          return <span className="clap-explanation__code-token is-number" key={partIndex}>{part}</span>
        }

        return part
      })}
      {lineIndex < code.split('\n').length - 1 ? '\n' : null}
    </span>
  ))
}

function ConditionDetailPanel({ condition, onClose }: { condition: ConditionId; onClose: () => void }) {
  const detail = CONDITION_DETAILS[condition]

  return (
    <section className="clap-explanation__detail" aria-label={`${detail.title}の詳細`} onClick={(event) => event.stopPropagation()}>
      <div className="clap-explanation__detail-heading">
        <div>
          <h2>{detail.title}</h2>
        </div>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <p className="clap-explanation__detail-summary">{detail.summary}</p>
      <pre className="clap-explanation__code-example"><code>{highlightCode(detail.code)}</code></pre>
    </section>
  )
}

function isClapDetected(detectionData: ExplanationProps['detectionData']) {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) {
    return false
  }

  return (detectionData.actions as Record<string, unknown>).clap === true
}

export function ClapExplanation({ detectionData }: ExplanationProps) {
  const [isClapVisible, setIsClapVisible] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const canShowNextClapRef = useRef(true)
  const clapTimerRef = useRef<number | null>(null)
  const landmarks = getPoseLandmarks(detectionData)
  const details = getClapDetails(detectionData)
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const visualization = details !== null &&
    details.isPoseAvailable &&
    leftShoulder !== undefined && leftShoulder !== null &&
    rightShoulder !== undefined && rightShoulder !== null &&
    details.leftPalmCenter !== null &&
    details.rightPalmCenter !== null
    ? {
        details,
        leftShoulder,
        rightShoulder,
        leftPalmCenter: details.leftPalmCenter,
        rightPalmCenter: details.rightPalmCenter,
      }
    : null
  const clapDetected = isClapDetected(detectionData)
  const backendHasApproached = details?.hasApproached === true
  const resultText = details?.triggered ? 'たたく！' : details?.isCoolingDown ? '判定後の待機中' : '動きを検出中'

  useEffect(() => {
    if (!clapDetected && !isClapVisible) {
      canShowNextClapRef.current = true
    }

    if (!clapDetected || isClapVisible || !canShowNextClapRef.current) {
      return
    }

    canShowNextClapRef.current = false
    setIsClapVisible(true)
    clapTimerRef.current = window.setTimeout(() => {
      clapTimerRef.current = null
      setIsClapVisible(false)
    }, CLAP_DISPLAY_DURATION_MS)
  }, [clapDetected, isClapVisible])

  useEffect(() => () => {
    if (clapTimerRef.current !== null) {
      window.clearTimeout(clapTimerRef.current)
    }
  }, [])

  return (
    <section className="clap-explanation" aria-label="たたく動作の判定過程">
      <p className="clap-explanation__lead">手のひらが近づき、近い位置で動きが止まる流れで、たたく動作を判定します</p>

      <div className="clap-explanation__visualization">
        {visualization !== null ? (
          <svg viewBox="0 0 1 1" role="img" aria-label="肩幅と左右の手のひら中心">
            <line x1={visualization.leftShoulder.x} y1={visualization.leftShoulder.y} x2={visualization.rightShoulder.x} y2={visualization.rightShoulder.y} className="clap-explanation__shoulder-line" />
            <circle cx={visualization.leftShoulder.x} cy={visualization.leftShoulder.y} r={0.014} className="clap-explanation__shoulder-point" />
            <circle cx={visualization.rightShoulder.x} cy={visualization.rightShoulder.y} r={0.014} className="clap-explanation__shoulder-point" />
            <text x={(visualization.leftShoulder.x + visualization.rightShoulder.x) / 2} y={(visualization.leftShoulder.y + visualization.rightShoulder.y) - 0.03} fontSize={0.032} className="clap-explanation__line-label">肩幅</text>

            <LandmarkGroup landmarks={landmarks} indices={LEFT_PALM_POINTS} color="#0ea5e9" />
            <LandmarkGroup landmarks={landmarks} indices={RIGHT_PALM_POINTS} color="#a855f7" />

            <line
              x1={visualization.leftPalmCenter.x}
              y1={visualization.leftPalmCenter.y}
              x2={visualization.rightPalmCenter.x}
              y2={visualization.rightPalmCenter.y}
              className={visualization.details.isCloseEnough ? 'clap-explanation__palm-line is-close' : 'clap-explanation__palm-line'}
            />
            <circle cx={visualization.leftPalmCenter.x} cy={visualization.leftPalmCenter.y} r={0.022} className="clap-explanation__palm-center left" />
            <circle cx={visualization.rightPalmCenter.x} cy={visualization.rightPalmCenter.y} r={0.022} className="clap-explanation__palm-center right" />
            <text x={visualization.leftPalmCenter.x} y={visualization.leftPalmCenter.y - 0.035} fontSize={0.03} className="clap-explanation__center-label">左の中心</text>
            <text x={visualization.rightPalmCenter.x} y={visualization.rightPalmCenter.y - 0.035} fontSize={0.03} className="clap-explanation__center-label">右の中心</text>
          </svg>
        ) : (
          <p className="clap-explanation__waiting">肩と両手が映るように、少し離れて立ってね</p>
        )}
        {isClapVisible ? <p className="clap-explanation__detected" role="status">CLAP</p> : null}
      </div>

      {selectedCondition !== null ? (
        <div className="clap-explanation__detail-overlay" role="dialog" aria-label="拍手の判定方法の詳細" onClick={() => setSelectedCondition(null)}>
          <ConditionDetailPanel condition={selectedCondition} onClose={() => setSelectedCondition(null)} />
        </div>
      ) : null}

      <ol className="clap-explanation__conditions">
        <ConditionStep
          condition="approach"
          passed={isClapVisible || backendHasApproached}
          title="手のひらが近づいた"
          selected={selectedCondition === 'approach'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
        <ConditionStep
          condition="distance"
          passed={isClapVisible || details?.isCloseEnough === true}
          title="十分に近い"
          selected={selectedCondition === 'distance'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
        <ConditionStep
          condition="contact"
          passed={isClapVisible || details?.isStopped === true || details?.isSeparatingAfterClose === true}
          title="近い位置で止まった、または跳ね返った"
          selected={selectedCondition === 'contact'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
      </ol>

      <p className={`clap-explanation__result${details?.triggered ? ' is-triggered' : ''}`}>{resultText}</p>
    </section>
  )
}
