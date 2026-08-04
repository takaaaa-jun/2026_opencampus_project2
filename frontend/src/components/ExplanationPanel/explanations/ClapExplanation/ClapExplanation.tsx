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
}

type ConditionId = 'approach' | 'distance' | 'contact'
type ClapView = 'practice' | 'guide'

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

export function ClapExplanation({ detectionData }: ExplanationProps) {
  const [isClapVisible, setIsClapVisible] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [view, setView] = useState<ClapView>('practice')
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
      <div className="clap-explanation__view-tabs" role="tablist" aria-label="たたくの表示内容">
        <button type="button" role="tab" aria-selected={view === 'practice'} className={view === 'practice' ? 'is-selected' : ''} onClick={() => setView('practice')}>ためす</button>
        <button type="button" role="tab" aria-selected={view === 'guide'} className={view === 'guide' ? 'is-selected' : ''} onClick={() => setView('guide')}>しくみを知る</button>
      </div>

      {view === 'guide' ? <ClapGuide onStartPractice={() => setView('practice')} /> : <>
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
      </>}
    </section>
  )
}
