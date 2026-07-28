import { useEffect, useRef, useState } from 'react'
import type { ExplanationProps } from '../../types'

import './SwingExplanation.css'

type Landmark = {
  x: number
  y: number
  z?: number
  visibility?: number
}

type PoseData = {
  landmarks?: Landmark[]
} | null | undefined

type DetectionDataLike = NonNullable<ExplanationProps['detectionData']> & {
  pose?: PoseData
  actions?: {
    swing?: boolean
  }
}

type Phase = {
  id: 'top' | 'middle' | 'bottom'
  label: string
  frameLabel: string
  startIndex: number
  endIndex: number
}

type ChartPoint = {
  x: number
  y: number
}

const FRAME_COUNT = 15
const MOVEMENT_THRESHOLD = 0.1
const CHART_WIDTH = 620
const CHART_HEIGHT = 240
const CHART_LEFT = 48
const CHART_RIGHT = 18
const CHART_TOP = 18
const CHART_BOTTOM = 38

const PHASES: Phase[] = [
  { id: 'top', label: '序盤（上）', frameLabel: '1〜3', startIndex: 0, endIndex: 2 },
  { id: 'middle', label: '中盤', frameLabel: '7〜9', startIndex: 6, endIndex: 8 },
  { id: 'bottom', label: '終盤（下）', frameLabel: '13〜15', startIndex: 12, endIndex: 14 },
]

function safeLandmark(landmarks: Landmark[] | undefined, index: number): Landmark | undefined {
  return landmarks?.[index]
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageRange(samples: number[], startIndex: number, endIndex: number): number | null {
  if (samples.length <= endIndex) {
    return null
  }

  return average(samples.slice(startIndex, endIndex + 1))
}

function formatHeight(value: number | null): string {
  return value === null ? '—' : value.toFixed(3)
}

function chartX(index: number): number {
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT
  return CHART_LEFT + (index / (FRAME_COUNT - 1)) * plotWidth
}

function chartY(value: number): number {
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM
  const clamped = Math.max(0, Math.min(1, value))
  return CHART_TOP + clamped * plotHeight
}

function phaseBackgroundPosition(phase: Phase): { x: number; width: number } {
  const halfStep = (chartX(1) - chartX(0)) / 2
  const left = Math.max(CHART_LEFT, chartX(phase.startIndex) - halfStep)
  const right = Math.min(CHART_WIDTH - CHART_RIGHT, chartX(phase.endIndex) + halfStep)

  return { x: left, width: right - left }
}

function WristHeightChart({ samples }: { samples: number[] }) {
  const points: ChartPoint[] = samples.map((value, index) => ({
    x: chartX(index),
    y: chartY(value),
  }))
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const gridValues = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="swing-chartCard">
      <div className="swing-chartCard__header">
        <div>
          <h4>左右の手首の平均Y座標</h4>
          <p>Y座標は，小さいほど画面の上，大きいほど画面の下です。</p>
        </div>
        <span className="swing-samplePill">
          {samples.length} / {FRAME_COUNT} フレーム
        </span>
      </div>

      <svg
        className="swing-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="直近15フレームの手首の平均Y座標"
      >
        {PHASES.map((phase) => {
          const position = phaseBackgroundPosition(phase)
          return (
            <rect
              key={phase.id}
              x={position.x}
              y={CHART_TOP}
              width={position.width}
              height={CHART_HEIGHT - CHART_TOP - CHART_BOTTOM}
              className={`swing-phaseArea swing-phaseArea--${phase.id}`}
            />
          )
        })}

        {gridValues.map((value) => {
          const y = chartY(value)
          return (
            <g key={value}>
              <line
                x1={CHART_LEFT}
                y1={y}
                x2={CHART_WIDTH - CHART_RIGHT}
                y2={y}
                className="swing-chart__gridLine"
              />
              <text x={CHART_LEFT - 9} y={y + 4} className="swing-chart__axisLabel">
                {value.toFixed(2)}
              </text>
            </g>
          )
        })}

        <line
          x1={CHART_LEFT}
          y1={CHART_TOP}
          x2={CHART_LEFT}
          y2={CHART_HEIGHT - CHART_BOTTOM}
          className="swing-chart__axis"
        />
        <line
          x1={CHART_LEFT}
          y1={CHART_HEIGHT - CHART_BOTTOM}
          x2={CHART_WIDTH - CHART_RIGHT}
          y2={CHART_HEIGHT - CHART_BOTTOM}
          className="swing-chart__axis"
        />

        {polylinePoints && <polyline points={polylinePoints} className="swing-chart__line" />}

        {points.map((point, index) => (
          <circle key={`${index}-${samples[index]}`} cx={point.x} cy={point.y} r="4.5" className="swing-chart__point" />
        ))}

        {[0, 6, 12, 14].map((index) => (
          <text key={index} x={chartX(index)} y={CHART_HEIGHT - 14} className="swing-chart__frameLabel">
            {index + 1}
          </text>
        ))}

        <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 2} className="swing-chart__titleLabel">
          フレーム
        </text>
      </svg>

      <div className="swing-chartLegend" aria-label="判定に使用するフレーム範囲">
        {PHASES.map((phase) => (
          <span key={phase.id} className={`swing-chartLegend__item swing-chartLegend__item--${phase.id}`}>
            {phase.label}：{phase.frameLabel}フレーム
          </span>
        ))}
      </div>
    </div>
  )
}

export function SwingExplanation({ detectionData }: ExplanationProps) {
  const [samples, setSamples] = useState<number[]>([])
  const lastDetectionDataRef = useRef<ExplanationProps['detectionData']>(null)
  const data = detectionData as DetectionDataLike | null
  const landmarks = data?.pose?.landmarks
  const leftWrist = safeLandmark(landmarks, 15)
  const rightWrist = safeLandmark(landmarks, 16)
  const hasPose = Boolean(leftWrist && rightWrist)
  const backendDetected = Boolean(data?.actions?.swing)

  useEffect(() => {
    if (!detectionData || detectionData === lastDetectionDataRef.current) {
      return
    }

    lastDetectionDataRef.current = detectionData
    const currentData = detectionData as DetectionDataLike
    const currentLandmarks = currentData.pose?.landmarks
    const currentLeftWrist = safeLandmark(currentLandmarks, 15)
    const currentRightWrist = safeLandmark(currentLandmarks, 16)

    if (!currentLeftWrist || !currentRightWrist) {
      return
    }

    const handsHeight = (currentLeftWrist.y + currentRightWrist.y) / 2
    setSamples((previous) => [...previous.slice(-(FRAME_COUNT - 1)), handsHeight])
  }, [detectionData])

  if (!hasPose) {
    return (
      <section className="swing">
        <div className="swing-emptyState">
          <h3>振り下ろしの説明</h3>
          <p>骨格を検出中です。左手首 15・右手首 16 が見えると，15フレーム分の動きを記録します。</p>
        </div>
      </section>
    )
  }

  const topAverage = averageRange(samples, 0, 2)
  const middleAverage = averageRange(samples, 6, 8)
  const bottomAverage = averageRange(samples, 12, 14)
  const historyReady = samples.length === FRAME_COUNT
  const orderOk =
    historyReady &&
    topAverage !== null &&
    middleAverage !== null &&
    bottomAverage !== null &&
    topAverage < middleAverage &&
    middleAverage < bottomAverage
  const movement = topAverage !== null && bottomAverage !== null ? bottomAverage - topAverage : null
  const movementOk = movement !== null && movement >= MOVEMENT_THRESHOLD
  const localDetected = Boolean(orderOk && movementOk)
  const currentHeight = (leftWrist!.y + rightWrist!.y) / 2
  const progress = (samples.length / FRAME_COUNT) * 100
  const movementProgress = movement === null ? 0 : Math.min(Math.max((movement / MOVEMENT_THRESHOLD) * 100, 0), 100)

  return (
    <section className="swing swing--compact">
      <div className={`swing-hero ${backendDetected ? 'swing-hero--ok' : 'swing-hero--ng'}`}>
        <div className="swing-hero__icon">{backendDetected ? '✓' : '!'}</div>
        <div className="swing-hero__content">
          <h3>判定：{backendDetected ? 'OK' : 'NG'}</h3>
          <p>バックエンドから届いた振り下ろし判定を表示しています。</p>
        </div>
      </div>

      <WristHeightChart samples={samples} />

      <div className="swing-phaseGrid">
        {PHASES.map((phase) => {
          const value = averageRange(samples, phase.startIndex, phase.endIndex)
          return (
            <div key={phase.id} className={`swing-phaseCard swing-phaseCard--${phase.id}`}>
              <div className="swing-phaseCard__header">
                <h4>{phase.label}</h4>
                <span>{phase.frameLabel}フレーム</span>
              </div>
              <strong>{formatHeight(value)}</strong>
              <p>手首の平均Y座標</p>
            </div>
          )
        })}
      </div>

      <div className="swing-metrics">
        <div className="swing-metricCard">
          <div className="swing-metricCard__title">15フレームの取得状況</div>
          <div className="swing-barRow">
            <span className="swing-barValue">
              {samples.length}/{FRAME_COUNT}
            </span>
            <div className="swing-bar">
              <div className="swing-bar__fill is-progress" style={{ width: `${progress}%` }} />
            </div>
            <span className="swing-barLimit">15フレームで判定</span>
          </div>
        </div>

        <div className="swing-metricCard">
          <div className="swing-metricCard__title">上から下への順序</div>
          <div className="swing-conditionRow">
            <span className={`swing-conditionChip ${orderOk ? 'is-ok' : 'is-ng'}`}>
              上 &lt; 中 &lt; 下
            </span>
            <strong>{historyReady ? (orderOk ? '条件を満たす' : '条件を満たさない') : 'データ収集中'}</strong>
          </div>
        </div>

        <div className="swing-metricCard">
          <div className="swing-metricCard__title">振り下ろした移動量</div>
          <div className="swing-barRow">
            <span className="swing-barValue">{movement === null ? '—' : movement.toFixed(3)}</span>
            <div className="swing-bar">
              <div
                className={`swing-bar__fill ${movementOk ? 'is-ok' : 'is-ng'}`}
                style={{ width: `${movementProgress}%` }}
              />
              <div className="swing-bar__threshold" style={{ left: '100%' }} />
            </div>
            <span className="swing-barLimit">{MOVEMENT_THRESHOLD.toFixed(2)} 以上で OK</span>
          </div>
        </div>

        <div className="swing-metricCard">
          <div className="swing-metricCard__title">表示中データの再計算</div>
          <div className="swing-summaryRow">
            <span className={`swing-conditionChip ${localDetected ? 'is-ok' : 'is-ng'}`}>
              {localDetected ? 'OK' : 'NG'}
            </span>
            <div>
              <strong>現在値：{currentHeight.toFixed(3)}</strong>
              <p>画面側でもバックエンドと同じ15フレーム条件を計算しています。</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
