import type { ExplanationProps } from '../../types'
import './ClapExplanation.css'

type Point = {
  x: number
  y: number
  z?: number
}

type Hand = {
  landmarks: Array<Point | null>
}

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const CLAP_THRESHOLD = 0.05
const CLAP_LANDMARK_INDEX = 12

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const point = value as Record<string, unknown>
  return typeof point.x === 'number' && typeof point.y === 'number'
}

function getHands(detectionData: ExplanationProps['detectionData']): Hand[] {
  if (detectionData === null || !Array.isArray(detectionData.hands)) {
    return []
  }

  return detectionData.hands.flatMap((hand) => {
    if (typeof hand !== 'object' || hand === null) {
      return []
    }

    const landmarks = (hand as Record<string, unknown>).landmarks
    if (!Array.isArray(landmarks)) {
      return []
    }

    const detectedLandmarks = landmarks.map((landmark) => (isPoint(landmark) ? landmark : null))
    return detectedLandmarks.some((landmark) => landmark !== null) ? [{ landmarks: detectedLandmarks }] : []
  })
}

function distanceBetween(point1: Point, point2: Point) {
  return Math.hypot(point1.x - point2.x, point1.y - point2.y)
}

function HandSkeleton({ hand, color }: { hand: Hand; color: string }) {
  return (
    <>
      {HAND_CONNECTIONS.map(([startIndex, endIndex]) => {
        const start = hand.landmarks[startIndex]
        const end = hand.landmarks[endIndex]

        if (start === undefined || start === null || end === undefined || end === null) {
          return null
        }

        return (
          <line
            key={`${startIndex}-${endIndex}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            className="clap-explanation__hand-line"
            stroke={color}
            strokeWidth={0.008}
          />
        )
      })}
      {hand.landmarks.map((point, index) => {
        if (point === null) {
          return null
        }

        return (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r={index === CLAP_LANDMARK_INDEX ? 0.018 : 0.008}
              className={index === CLAP_LANDMARK_INDEX ? 'clap-explanation__target-point' : 'clap-explanation__hand-point'}
              fill={color}
            />
            <text
              x={point.x + 0.012}
              y={point.y - 0.012}
              fontSize={0.025}
              stroke="#ffffff"
              strokeWidth={0.005}
              paintOrder="stroke"
              className="clap-explanation__landmark-label"
            >
              {index}
            </text>
          </g>
        )
      })}
    </>
  )
}

export function ClapExplanation({ detectionData }: ExplanationProps) {
  const hands = getHands(detectionData)
  const hand1 = hands[0]
  const hand2 = hands[1]
  const hasHands = hands.length > 0
  const point1 = hand1?.landmarks[CLAP_LANDMARK_INDEX]
  const point2 = hand2?.landmarks[CLAP_LANDMARK_INDEX]
  const distance = point1 !== undefined && point1 !== null && point2 !== undefined && point2 !== null
    ? distanceBetween(point1, point2)
    : null
  const isClapping = distance !== null && distance < CLAP_THRESHOLD
  const distanceRatio = distance === null ? 0 : Math.min((distance / CLAP_THRESHOLD) * 100, 100)

  return (
    <section className="clap-explanation" aria-label="たたく動作の判定過程">
      <p className="clap-explanation__lead">12番の点どうしの距離で判定します</p>

      <div className="clap-explanation__visualization">
        {hasHands ? (
          <svg viewBox="0 0 1 1" role="img" aria-label="2本の手の骨格と12番ランドマーク">
            {hand1 !== undefined ? <HandSkeleton hand={hand1} color="#0ea5e9" /> : null}
            {hand2 !== undefined ? <HandSkeleton hand={hand2} color="#a855f7" /> : null}
            {point1 !== undefined && point1 !== null && point2 !== undefined && point2 !== null ? (
              <line
                x1={point1.x}
                y1={point1.y}
                x2={point2.x}
                y2={point2.y}
                className={isClapping ? 'clap-explanation__distance-line is-close' : 'clap-explanation__distance-line'}
                strokeWidth={0.009}
              />
            ) : null}
          </svg>
        ) : (
          <p className="clap-explanation__waiting">両手をカメラに映してね</p>
        )}
      </div>

      <div className="clap-explanation__metrics">
        <div>
          <span>現在の距離</span>
          <strong>{distance === null ? '—' : distance.toFixed(3)}</strong>
        </div>
        <div>
          <span>しきい値</span>
          <strong>{CLAP_THRESHOLD.toFixed(3)} 未満</strong>
        </div>
      </div>

      <div className="clap-explanation__condition">
        <div className="clap-explanation__condition-header">
          <span>distance &lt; 0.05</span>
          <strong className={isClapping ? 'is-clapping' : ''}>
            {distance === null ? '12番の点を検出できていません' : isClapping ? 'たたく！' : '手を近づけよう'}
          </strong>
        </div>
        <div className="clap-explanation__bar" aria-hidden="true">
          <span className={isClapping ? 'is-close' : ''} style={{ width: `${distanceRatio}%` }} />
        </div>
      </div>
    </section>
  )
}
