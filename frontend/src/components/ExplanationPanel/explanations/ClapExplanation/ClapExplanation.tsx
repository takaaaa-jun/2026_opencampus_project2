import { useEffect, useRef, useState } from 'react'
import clapHandIllustration from '../../../../assets/clap-hand.png'
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
  normalizedDistance: number | null
  closingSpeed: number | null
}

type MetricSample = {
  distance: number | null
  closingSpeed: number | null
  hasApproached: boolean
  isCloseEnough: boolean
  isStopped: boolean
  isSeparatingAfterClose: boolean
}

type ChartArea = {
  value: number
  label: string
}

type ConditionId = 'approach' | 'distance' | 'contact'
type ClapView = 'practice' | 'guide'

type ConditionDetail = {
  title: string
  summary: string
  code: string
}

const CLAP_DISPLAY_DURATION_MS = 1500
const METRIC_HISTORY_SIZE = 40
const LEFT_PALM_POINTS = [15, 17, 19, 21]
const RIGHT_PALM_POINTS = [16, 18, 20, 22]
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

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getPoseLandmarks(detectionData: ExplanationProps['detectionData']): Array<Point | null> {
  if (detectionData === null || typeof detectionData.pose !== 'object' || detectionData.pose === null) {
    return []
  }

  const landmarks = (detectionData.pose as Record<string, unknown>).landmarks
  return Array.isArray(landmarks) ? landmarks.map((landmark) => (isPoint(landmark) ? landmark : null)) : []
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
    normalizedDistance: numberOrNull(details.normalizedDistance),
    closingSpeed: numberOrNull(details.closingSpeed),
  }
}

function useClapMetricHistory(
  detectionData: ExplanationProps['detectionData'],
  isPoseAvailable: boolean,
  distance: number | null,
  closingSpeed: number | null,
  hasApproached: boolean,
  isCloseEnough: boolean,
  isStopped: boolean,
  isSeparatingAfterClose: boolean,
) {
  const [history, setHistory] = useState<MetricSample[]>([])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistory((current) => !isPoseAvailable
        ? []
        : [...current, { distance, closingSpeed, hasApproached, isCloseEnough, isStopped, isSeparatingAfterClose }].slice(-METRIC_HISTORY_SIZE))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [detectionData, isPoseAvailable, distance, closingSpeed, hasApproached, isCloseEnough, isStopped, isSeparatingAfterClose])

  return history
}

function MetricChart({
  title,
  description,
  values,
  latestValue,
  highlighted,
  highlightLabel,
  area,
  approachActive,
  contactDetected,
}: {
  title: string
  description: string
  values: Array<number | null>
  latestValue: number | null
  highlighted?: boolean[]
  highlightLabel?: string
  area?: ChartArea
  approachActive?: boolean[]
  contactDetected?: boolean[]
}) {
  const samples = values.filter((value): value is number => value !== null)
  const chartValues = [...samples, ...(area === undefined ? [] : [area.value])]
  const minimum = Math.min(...chartValues, 0)
  const maximum = Math.max(...chartValues, 0.01)
  const padding = (maximum - minimum) * 0.2 || 0.1
  const min = minimum - padding
  const max = maximum + padding
  const width = 760
  const height = 280
  const left = 52
  const right = 24
  const top = 28
  const bottom = 36
  const x = (index: number) => left + (index / Math.max(values.length - 1, 1)) * (width - left - right)
  const y = (value: number) => top + ((max - Math.max(min, Math.min(max, value))) / (max - min)) * (height - top - bottom)
  const points = values
    .map((value, index) => value === null ? null : `${x(index)},${y(value)}`)
    .filter((point): point is string => point !== null)
    .join(' ')

  return (
    <article className="clap-chart-card">
      <div className="clap-chart-card__header">
        <div><h2>{title}</h2><p>{description}</p></div>
        <div className="clap-chart-card__current"><span>現在</span><strong>{latestValue === null ? '—' : latestValue.toFixed(2)}</strong></div>
      </div>
      <div className="clap-chart-card__legend" aria-label={`${title}のしきい値`}>
        <strong>グラフの見方</strong>
        <div className="clap-chart-card__legend-items">
          {area !== undefined ? <span className="is-area"><i aria-hidden="true" />十分近い（0.35 以下）</span> : null}
          {highlightLabel !== undefined ? <span className="is-highlight"><i aria-hidden="true" />速く近づいた（0.40 以上）</span> : null}
          <span className="is-approach"><i aria-hidden="true" />近づいた判定を保持中</span>
          <span className="is-contact"><i aria-hidden="true" />止まった／跳ね返った</span>
        </div>
      </div>
      {samples.length >= 2 ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}の直近${METRIC_HISTORY_SIZE}フレームの変化`} className="clap-chart">
          {area !== undefined ? <rect x={left} y={y(area.value)} width={width - left - right} height={height - bottom - y(area.value)} className="clap-chart__area" /> : null}
          <line x1={left} y1={y(0)} x2={width - right} y2={y(0)} className="clap-chart__zero" />
          <polyline points={points} className="clap-chart__line" />
          {approachActive?.map((isActive, index) => {
            const previous = values[index - 1]
            const current = values[index]
            return index === 0 || !isActive || previous === null || previous === undefined || current === null || current === undefined ? null : <line key={index} x1={x(index - 1)} y1={y(previous)} x2={x(index)} y2={y(current)} className="clap-chart__approach-segment" />
          })}
          {contactDetected?.map((isContactDetected, index) => values[index] === null || !isContactDetected ? null : <circle key={index} cx={x(index)} cy={y(values[index]!)} r="7" className="clap-chart__contact-point" />)}
          {highlighted?.map((isHighlighted, index) => values[index] === null || !isHighlighted ? null : <circle key={index} cx={x(index)} cy={y(values[index]!)} r="5" className="clap-chart__highlight-point" />)}
          <text x={left} y={height - 8} className="clap-chart__axis-label is-start">40フレーム前</text>
          <text x={width - right} y={height - 8} className="clap-chart__axis-label">現在</text>
        </svg>
      ) : <p className="clap-chart-card__empty">カメラを起動すると、ここに変化が表示されます</p>}
    </article>
  )
}

function LandmarkGroup({ landmarks, indices, color }: { landmarks: Array<Point | null>; indices: number[]; color: string }) {
  return <>
    {indices.map((index) => {
      const point = landmarks[index]
      return point === undefined || point === null ? null : <g key={index}>
        <circle cx={point.x} cy={point.y} r={0.018} fill={color} />
        <text x={point.x + 0.025} y={point.y - 0.02} fontSize={0.04} className="clap-camera-guidance__landmark-label">{index}</text>
      </g>
    })}
  </>
}

function PalmSkeletonLines({ landmarks, indices, color }: { landmarks: Array<Point | null>; indices: number[]; color: string }) {
  const points = indices.map((index) => landmarks[index])
  if (points.some((point) => point === undefined || point === null)) {
    return null
  }

  const [wrist, pinky, indexFinger, thumb] = points as Point[]
  return <g className="clap-camera-guidance__palm-lines" stroke={color}>
    <line x1={wrist.x} y1={wrist.y} x2={pinky.x} y2={pinky.y} />
    <line x1={wrist.x} y1={wrist.y} x2={indexFinger.x} y2={indexFinger.y} />
    <line x1={wrist.x} y1={wrist.y} x2={thumb.x} y2={thumb.y} />
    <line x1={pinky.x} y1={pinky.y} x2={indexFinger.x} y2={indexFinger.y} />
    <line x1={indexFinger.x} y1={indexFinger.y} x2={thumb.x} y2={thumb.y} />
  </g>
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

function ClapGuide({ onStartPractice }: { onStartPractice: () => void }) {
  return (
    <div className="clap-guide">
      <header className="clap-guide__hero">
        <p className="clap-guide__eyebrow">動作を知る</p>
        <h2>たたくとは、両手を近づけて合わせる動作です</h2>
        <p>離れた手が近づき、接触した直後に止まる、または跳ね返る流れを確認します。</p>
      </header>

      <section className="clap-guide__section" aria-labelledby="clap-motion-title">
        <h3 id="clap-motion-title">1. たたく動作の流れ</h3>
        <ol className="clap-guide__motion">
          <li><span>1</span><strong>手を離す</strong><small>左右の手のひら中心に距離がある</small></li>
          <li><span>2</span><strong>手を近づける</strong><small>距離が短くなる速さを測る</small></li>
          <li><span>3</span><strong>手を合わせる</strong><small>近い位置で停止・反転する</small></li>
        </ol>
      </section>

      <section className="clap-guide__section" aria-labelledby="clap-points-title">
        <h3 id="clap-points-title">2. 使う骨格点</h3>
        <p>左右の手首・小指・人差し指・親指の付け根に当たる4点を平均し、それぞれの<strong>手のひら中心</strong>を求めます。</p>
        <svg className="clap-guide__point-diagram" viewBox="0 0 640 300" role="img" aria-label="手のイラストに重ねた、たたく判定で使う骨格点">
          <line x1="245" y1="38" x2="395" y2="38" className="clap-guide__shoulder-line" />
          <circle cx="245" cy="38" r="8" className="clap-guide__shoulder-dot" />
          <circle cx="395" cy="38" r="8" className="clap-guide__shoulder-dot" />
          <text x="320" y="24" className="clap-guide__diagram-label">肩幅の基準（11・12）</text>

          <image href={clapHandIllustration} x="26" y="38" width="270" height="250" className="clap-guide__hand-image" />
          <image href={clapHandIllustration} x="26" y="38" width="270" height="250" transform="translate(640 0) scale(-1 1)" className="clap-guide__hand-image" />
          <line x1="167" y1="177" x2="473" y2="177" className="clap-guide__distance-line" />
          <text x="320" y="135" className="clap-guide__diagram-label clap-guide__distance-label">左右の手のひら中心の距離</text>
          <g className="clap-guide__landmarks is-left">
            <circle cx="160" cy="250" r="8" className="clap-guide__palm-dot" /><text x="160" y="276" className="clap-guide__diagram-label">15</text>
            <circle cx="198" cy="150" r="8" className="clap-guide__palm-dot" /><text x="214" y="146" className="clap-guide__diagram-label">17</text>
            <circle cx="138" cy="142" r="8" className="clap-guide__palm-dot" /><text x="138" y="128" className="clap-guide__diagram-label">19</text>
            <circle cx="112" cy="164" r="8" className="clap-guide__palm-dot" /><text x="98" y="159" className="clap-guide__diagram-label">21</text>
            <circle cx="152" cy="177" r="14" className="clap-guide__palm-center-dot" /><text x="152" y="203" className="clap-guide__diagram-label">左の中心</text>
          </g>
          <g className="clap-guide__landmarks is-right">
            <circle cx="480" cy="250" r="8" className="clap-guide__palm-dot" /><text x="480" y="276" className="clap-guide__diagram-label">16</text>
            <circle cx="442" cy="150" r="8" className="clap-guide__palm-dot" /><text x="426" y="146" className="clap-guide__diagram-label">18</text>
            <circle cx="502" cy="142" r="8" className="clap-guide__palm-dot" /><text x="502" y="128" className="clap-guide__diagram-label">20</text>
            <circle cx="528" cy="164" r="8" className="clap-guide__palm-dot" /><text x="542" y="159" className="clap-guide__diagram-label">22</text>
            <circle cx="488" cy="177" r="14" className="clap-guide__palm-center-dot" /><text x="488" y="203" className="clap-guide__diagram-label">右の中心</text>
          </g>

        </svg>
      </section>

      <section className="clap-guide__section" aria-labelledby="clap-logic-title">
        <h3 id="clap-logic-title">3. 判定のしくみ</h3>
        <ol className="clap-guide__logic">
          <li><strong>近づいたか</strong><p>肩幅を1とした距離が1秒あたり0.4以上短くなる状態を、2フレーム以上確認します。</p></li>
          <li><strong>十分に近いか</strong><p>手のひら中心間の距離を肩幅で割り、肩幅の35%以下かを確認します。</p></li>
          <li><strong>接触らしい変化があるか</strong><p>近い位置で速さが0.15以下に落ちる、または0.15以上の速さで離れる向きへ変われば、たたくと判定します。</p></li>
        </ol>
        <p className="clap-guide__formula">手の近さ ＝ 左右の手のひら中心の距離 ÷ 肩幅</p>
      </section>

      <section className="clap-guide__section" aria-labelledby="clap-reason-title">
        <h3 id="clap-reason-title">4. なぜこれで分かるのか</h3>
        <dl className="clap-guide__reasons">
          <div><dt>距離だけでは不十分</dt><dd>胸の前で両手がすれ違うだけでも距離は短くなるため、接近の速さと接触後の変化も確認します。</dd></div>
          <div><dt>肩幅で割る理由</dt><dd>カメラからの距離や体格が違っても、身体に対する手の近さとして同じ基準で比べられます。</dd></div>
          <div><dt>停止・跳ね返りを見る理由</dt><dd>手を合わせると運動が止まるか反対向きに変わるため、単なる通過動作を除外できます。</dd></div>
        </dl>
      </section>

      <button type="button" className="clap-guide__practice-button" onClick={onStartPractice}>実際にためす</button>
    </div>
  )
}

function isClapDetected(detectionData: ExplanationProps['detectionData']) {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) {
    return false
  }

  return (detectionData.actions as Record<string, unknown>).clap === true
}

export function ClapExplanation({ detectionData, isCameraStarted }: ExplanationProps) {
  const [isClapVisible, setIsClapVisible] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [view, setView] = useState<ClapView>('practice')
  const [hasSeenHands, setHasSeenHands] = useState(false)
  const canShowNextClapRef = useRef(true)
  const clapTimerRef = useRef<number | null>(null)
  const landmarks = getPoseLandmarks(detectionData)
  const details = getClapDetails(detectionData)
  const metricHistory = useClapMetricHistory(
    detectionData,
    details?.isPoseAvailable === true,
    details?.normalizedDistance ?? null,
    details?.closingSpeed ?? null,
    details?.hasApproached === true,
    details?.isCloseEnough === true,
    details?.isStopped === true,
    details?.isSeparatingAfterClose === true,
  )
  const hasHandsInFrame = details !== null &&
    details.isPoseAvailable &&
    details.leftPalmCenter !== null &&
    details.rightPalmCenter !== null
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const clapDetected = isClapDetected(detectionData)
  const backendHasApproached = details?.hasApproached === true
  const resultText = details?.triggered ? 'たたく！' : details?.isCoolingDown ? '判定後の待機中' : '動きを検出中'
  const showCameraGuidance = isCameraStarted && !hasSeenHands

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

  useEffect(() => {
    if (!isCameraStarted) {
      const resetTimer = window.setTimeout(() => setHasSeenHands(false), 0)
      return () => window.clearTimeout(resetTimer)
    }

    if (!hasHandsInFrame || hasSeenHands) {
      return
    }

    const timer = window.setTimeout(() => setHasSeenHands(true), 5000)

    return () => window.clearTimeout(timer)
  }, [isCameraStarted, hasHandsInFrame, hasSeenHands])

  return (
    <section className="clap-explanation" aria-label="たたく動作の判定過程">
      <div className="clap-explanation__view-tabs" role="tablist" aria-label="たたくの表示内容">
        <button type="button" role="tab" aria-selected={view === 'practice'} className={view === 'practice' ? 'is-selected' : ''} onClick={() => setView('practice')}>ためす</button>
        <button type="button" role="tab" aria-selected={view === 'guide'} className={view === 'guide' ? 'is-selected' : ''} onClick={() => setView('guide')}>しくみを知る</button>
      </div>

      {view === 'guide' ? <ClapGuide onStartPractice={() => setView('practice')} /> : <>
      <p className="clap-explanation__lead">手のひらが近づき、近い位置で動きが止まる流れで、たたく動作を判定します</p>

      {showCameraGuidance ? <div className="clap-camera-guidance" role="dialog" aria-modal="true" aria-label="カメラ位置の案内">
        <div className="clap-camera-guidance__card">
          <p>準備しよう</p>
          <h2>両手と肩が画面に映る位置に立ってね</h2>
          <div className="clap-camera-guidance__skeleton">
            {leftShoulder !== undefined && leftShoulder !== null && rightShoulder !== undefined && rightShoulder !== null ? <svg viewBox="0 0 1 1" role="img" aria-label="検出中の手と肩の骨格点">
              <line x1={leftShoulder.x} y1={leftShoulder.y} x2={rightShoulder.x} y2={rightShoulder.y} className="clap-camera-guidance__shoulder-line" />
              <circle cx={leftShoulder.x} cy={leftShoulder.y} r={0.018} className="clap-camera-guidance__shoulder-dot" />
              <circle cx={rightShoulder.x} cy={rightShoulder.y} r={0.018} className="clap-camera-guidance__shoulder-dot" />
              <PalmSkeletonLines landmarks={landmarks} indices={LEFT_PALM_POINTS} color="#0ea5e9" />
              <PalmSkeletonLines landmarks={landmarks} indices={RIGHT_PALM_POINTS} color="#a855f7" />
              <LandmarkGroup landmarks={landmarks} indices={LEFT_PALM_POINTS} color="#0ea5e9" />
              <LandmarkGroup landmarks={landmarks} indices={RIGHT_PALM_POINTS} color="#a855f7" />
            </svg> : <span className="clap-camera-guidance__searching">骨格点を探しています…</span>}
          </div>
          <span>検出できると自動で始まります</span>
        </div>
      </div> : null}
      {isClapVisible ? <p className="clap-explanation__detected" role="status">CLAP</p> : null}

      <div className="clap-charts" aria-label="たたく判定の数値変化">
        <MetricChart
          title="手のひら中心の距離"
          description="肩幅で割った、左右の手の近さ"
          values={metricHistory.map((sample) => sample.distance)}
          latestValue={details?.normalizedDistance ?? null}
          highlighted={metricHistory.map((sample) => (sample.closingSpeed ?? Number.NEGATIVE_INFINITY) >= 0.4)}
          highlightLabel="青い点：近づく速度が 0.40 以上"
          area={{ value: 0.35, label: '緑の領域：十分近い（0.35 以下）' }}
          approachActive={metricHistory.map((sample) => sample.hasApproached)}
          contactDetected={metricHistory.map((sample) => sample.hasApproached && sample.isCloseEnough && (sample.isStopped || sample.isSeparatingAfterClose))}
        />
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
      </>}
    </section>
  )
}
