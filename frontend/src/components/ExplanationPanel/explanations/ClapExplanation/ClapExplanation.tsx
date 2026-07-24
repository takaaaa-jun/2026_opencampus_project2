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
  shoulderWidth: number | null
  normalizedDistance: number | null
  closingSpeed: number | null
  approachFrames: number
  approachSpeedThreshold: number
  contactDistanceThreshold: number
  stopSpeedThreshold: number
  hasApproached: boolean
  isCloseEnough: boolean
  isStopped: boolean
  isCoolingDown: boolean
  triggered: boolean
}

const LEFT_PALM_POINTS = [15, 17, 19, 21]
const RIGHT_PALM_POINTS = [16, 18, 20, 22]
const CLAP_DISPLAY_DURATION_MS = 1500

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const point = value as Record<string, unknown>
  return typeof point.x === 'number' && typeof point.y === 'number'
}

function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === 'number' || value === null
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
    !isNumberOrNull(details.shoulderWidth) ||
    !isNumberOrNull(details.normalizedDistance) ||
    !isNumberOrNull(details.closingSpeed) ||
    typeof details.approachFrames !== 'number' ||
    typeof details.approachSpeedThreshold !== 'number' ||
    typeof details.contactDistanceThreshold !== 'number' ||
    typeof details.stopSpeedThreshold !== 'number' ||
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
    shoulderWidth: details.shoulderWidth,
    normalizedDistance: details.normalizedDistance,
    closingSpeed: details.closingSpeed,
    approachFrames: details.approachFrames,
    approachSpeedThreshold: details.approachSpeedThreshold,
    contactDistanceThreshold: details.contactDistanceThreshold,
    stopSpeedThreshold: details.stopSpeedThreshold,
    hasApproached: details.hasApproached,
    isCloseEnough: details.isCloseEnough,
    isStopped: details.isStopped,
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

function ConditionStep({ passed, title, value }: { passed: boolean; title: string; value: string }) {
  return (
    <li className={passed ? 'is-passed' : ''}>
      <span aria-hidden="true">{passed ? '✓' : '○'}</span>
      <div>
        <strong>{title}</strong>
        <small>{value}</small>
      </div>
    </li>
  )
}

function formatValue(value: number | null, digits = 3) {
  return value === null ? '—' : value.toFixed(digits)
}

function isClapDetected(detectionData: ExplanationProps['detectionData']) {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) {
    return false
  }

  return (detectionData.actions as Record<string, unknown>).clap === true
}

export function ClapExplanation({ detectionData }: ExplanationProps) {
  const [isClapVisible, setIsClapVisible] = useState(false)
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
      <p className="clap-explanation__lead">手のひら中心の動きで、たたく動作を判定します</p>

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

      <ol className="clap-explanation__conditions">
        <ConditionStep
          passed={isClapVisible || details?.hasApproached === true}
          title="手のひらが近づいている"
          value={`速度 ${formatValue(details?.closingSpeed ?? null)}（${formatValue(details?.approachSpeedThreshold ?? null)} 以上を2フレーム）`}
        />
        <ConditionStep
          passed={isClapVisible || details?.isCloseEnough === true}
          title="十分に近い"
          value={`距離 ${formatValue(details?.normalizedDistance ?? null)} / ${formatValue(details?.contactDistanceThreshold ?? null)}`}
        />
        <ConditionStep
          passed={isClapVisible || details?.isStopped === true}
          title="当たった位置で止まった"
          value={`速度 ${formatValue(details?.closingSpeed ?? null)} / ${formatValue(details?.stopSpeedThreshold ?? null)}`}
        />
      </ol>

      <p className={`clap-explanation__result${details?.triggered ? ' is-triggered' : ''}`}>{resultText}</p>
    </section>
  )
}
