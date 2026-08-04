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

type ViewMode = 'practice' | 'guide'

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


function SwingPageSelector({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (viewMode: ViewMode) => void
}) {
  return (
    <div className="swing-pageSelector" role="tablist" aria-label="振り下ろし説明の表示切替">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'practice'}
        className={`swing-pageSelector__button ${viewMode === 'practice' ? 'is-selected' : ''}`}
        onClick={() => onChange('practice')}
      >
        練習ページを見る
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'guide'}
        className={`swing-pageSelector__button ${viewMode === 'guide' ? 'is-selected' : ''}`}
        onClick={() => onChange('guide')}
      >
        解説ページを見る
      </button>
    </div>
  )
}

function SwingGuide({ onStartPractice }: { onStartPractice: () => void }) {
  return (
    <div className="swing-guide">
      <header className="swing-guide__hero">
        <div>
          <span className="swing-guide__eyebrow">振り下ろし判定の全体像</span>
          <h3>「振り下ろし」とはどのような動作か</h3>
          <p>
            左右の手を高い位置から低い位置へ連続して動かす動作です。
            両手首の高さが，時間とともに「上→中→下」へ移動したかを調べます。
          </p>
        </div>
        <span className="swing-guide__method">MediaPipe Pose</span>
      </header>

      <section className="swing-guide__section">
        <div className="swing-guide__heading">
          <span>1</span>
          <div>
            <h4>取得する骨格点</h4>
            <p>左右の手首のY座標を各フレームで取得します。</p>
          </div>
        </div>

        <div className="swing-guide__landmarks">
          <article>
            <span>15</span>
            <div>
              <strong>左手首</strong>
              <p>左手の上下位置を取得します。</p>
            </div>
          </article>
          <article>
            <span>16</span>
            <div>
              <strong>右手首</strong>
              <p>右手の上下位置を取得します。</p>
            </div>
          </article>
        </div>

        <div className="swing-guide__formula">
          <strong>1フレームの手の高さ</strong>
          <code>handsY = (左手首Y + 右手首Y) / 2</code>
          <p>
            左右を平均し，両手を使った動作全体を1つの高さとして扱います。
          </p>
        </div>
      </section>

      <section className="swing-guide__section">
        <div className="swing-guide__heading">
          <span>2</span>
          <div>
            <h4>15フレームを3区間に分ける</h4>
            <p>一瞬の座標の揺れではなく，継続した下方向の移動を確認します。</p>
          </div>
        </div>

        <div className="swing-guide__timeline">
          <div className="is-top">
            <span>1〜3フレーム</span>
            <strong>序盤（上）</strong>
            <p>3点の平均</p>
          </div>
          <b aria-hidden="true">→</b>
          <div className="is-middle">
            <span>7〜9フレーム</span>
            <strong>中盤</strong>
            <p>3点の平均</p>
          </div>
          <b aria-hidden="true">→</b>
          <div className="is-bottom">
            <span>13〜15フレーム</span>
            <strong>終盤（下）</strong>
            <p>3点の平均</p>
          </div>
        </div>

        <p className="swing-guide__note">
          各区間を3フレームの平均にすることで，骨格点の細かな揺れの影響を小さくします。
          また，離れた3区間を比較することで，手が継続して下へ移動したかを確認できます。
        </p>
      </section>

      <section className="swing-guide__section">
        <div className="swing-guide__heading">
          <span>3</span>
          <div>
            <h4>判定に使用する2つの条件</h4>
            <p>次の条件を両方満たすと振り下ろしになります。</p>
          </div>
        </div>

        <div className="swing-guide__conditions">
          <article>
            <span>条件1</span>
            <h5>上から下へ順番に移動したか</h5>
            <code>序盤平均 &lt; 中盤平均 &lt; 終盤平均</code>
            <p>
              画面座標のY値は，上で小さく，下で大きくなります。
              この大小関係により，上→中→下の移動を確認できます。
            </p>
          </article>

          <article>
            <span>条件2</span>
            <h5>十分な距離を移動したか</h5>
            <code>終盤平均 - 序盤平均 ≧ 0.10</code>
            <p>
              順序だけでは小さな手ぶれも検出するため，0.10以上の移動を要求し，
              意図した振り下ろしと細かな揺れを区別します。
            </p>
          </article>
        </div>
      </section>

      <section className="swing-guide__decision">
        <span>最終判定</span>
        <div>
          <strong>15フレーム取得 ＋ 上→中→下 ＋ 移動量0.10以上</strong>
          <p>
            練習ページのグラフは，この判定に使用している15フレームと各区間の平均を可視化しています。
          </p>
        </div>
      </section>

      <div className="swing-guide__footer">
        <button type="button" onClick={onStartPractice}>
          練習ページで数値を確かめる
        </button>
      </div>
    </div>
  )
}

export function SwingExplanation({ detectionData }: ExplanationProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('practice')
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

  if (viewMode === 'guide') {
    return (
      <section className="swing swing--compact">
        <SwingPageSelector viewMode={viewMode} onChange={setViewMode} />
        <SwingGuide onStartPractice={() => setViewMode('practice')} />
      </section>
    )
  }

  if (!hasPose) {
    return (
      <section className="swing">
        <SwingPageSelector viewMode={viewMode} onChange={setViewMode} />
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
      <SwingPageSelector viewMode={viewMode} onChange={setViewMode} />

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
