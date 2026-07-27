import { useEffect, useRef, useState } from 'react'
import type { ExplanationProps } from '../../types'
import './SwingExplanation.css'

type Point = {
  x: number
  y: number
}

type SwingDetails = {
  isPoseAvailable: boolean
  handsHeight: number | null
  top: number | null
  middle: number | null
  foot: number | null
  'foot-top': number | null
  isHistoryFull: boolean
  isDirectionPassed: boolean
  isDistancePassed: boolean
  triggered: boolean
}

type ConditionId = 'history' | 'direction' | 'distance'

type ConditionDetail = {
  title: string
  summary: string
  code: string
}

const SWING_DISPLAY_DURATION_MS = 1500

const CONDITION_DETAILS: Record<ConditionId, ConditionDetail> = {
  history: {
    title: '直近15フレームの履歴蓄積',
    summary: '両手首（左15番、右16番）のY座標の平均値を計算し、直近15フレーム分キューに保存します。履歴が15フレーム溜まるまでは判定を行いません。',
    code: `# 左右の手首のY座標の平均をとる
hands_height = (landmarks[15].y + landmarks[16].y) / 2

# キューに保存（最大15フレーム）
frames.append(hands_height)

# 履歴が15フレーム溜まったか
is_history_full = len(frames) >= 15`,
  },
  direction: {
    title: '上から下へ動いている (top < middle < foot)',
    summary: '15フレームの履歴を最初 (0〜2フレームの平均 top)、中間 (6〜8フレームの平均 middle)、最後 (12〜14フレームの平均 foot) に分け、手全体が上から下へ動いている（Y座標が増加している）か判定します。',
    code: `# 各区間の平均高さを計算
top = sum(frames[0:3]) / 3
middle = sum(frames[6:9]) / 3
foot = sum(frames[12:15]) / 3

# 上から下へ動いているか (Y座標が増加しているか)
is_direction_passed = top < middle < foot`,
  },
  distance: {
    title: '十分な移動量 (foot - top >= 0.1)',
    summary: '最後の位置 (foot) と最初の位置 (top) の差が、画面の高さに対して0.1以上（約10%以上）大きく動いたかを判定します。',
    code: `# 移動量を計算
foot_minus_top = foot - top

# 0.1（画面高さの10%）以上移動したか
is_distance_passed = foot_minus_top >= 0.1`,
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

function getSwingDetails(detectionData: ExplanationProps['detectionData']): SwingDetails | null {
  if (detectionData === null || typeof detectionData.actionDetails !== 'object' || detectionData.actionDetails === null) {
    return null
  }

  const swing = (detectionData.actionDetails as Record<string, unknown>).swing
  if (typeof swing !== 'object' || swing === null) {
    return null
  }

  const details = swing as Record<string, unknown>
  const footTopVal = details['foot-top'] !== undefined ? details['foot-top'] : details['foot_minus_top']
  
  if (
    typeof details.isPoseAvailable !== 'boolean' ||
    typeof details.isHistoryFull !== 'boolean' ||
    typeof details.isDirectionPassed !== 'boolean' ||
    typeof details.isDistancePassed !== 'boolean' ||
    typeof details.triggered !== 'boolean'
  ) {
    return null
  }

  return {
    isPoseAvailable: details.isPoseAvailable,
    handsHeight: typeof details.handsHeight === 'number' ? details.handsHeight : null,
    top: typeof details.top === 'number' ? details.top : null,
    middle: typeof details.middle === 'number' ? details.middle : null,
    foot: typeof details.foot === 'number' ? details.foot : null,
    'foot-top': typeof footTopVal === 'number' ? footTopVal : null,
    isHistoryFull: details.isHistoryFull,
    isDirectionPassed: details.isDirectionPassed,
    isDistancePassed: details.isDistancePassed,
    triggered: details.triggered,
  }
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
        <span className="swing-explanation__condition-action" aria-hidden="true">詳しく見る</span>
      </button>
    </li>
  )
}

function highlightCode(code: string) {
  const tokenPattern = /(\b(?:if|and|or|is|not|None|True|False)\b|\b(?:average|distance_between|abs|sum|len|append)\b|\b[A-Z][A-Z_]+\b|\b\d+(?:\.\d+)?\b)/g

  return code.split('\n').map((line, lineIndex) => (
    <span className="swing-explanation__code-line" key={`${line}-${lineIndex}`}>
      {line.split(tokenPattern).map((part, partIndex) => {
        if (/^(if|and|or|is|not|None|True|False)$/.test(part)) {
          return <span className="swing-explanation__code-token is-keyword" key={partIndex}>{part}</span>
        }

        if (/^(average|distance_between|abs|sum|len|append)$/.test(part)) {
          return <span className="swing-explanation__code-token is-function" key={partIndex}>{part}</span>
        }

        if (/^[A-Z][A-Z_]+$/.test(part)) {
          return <span className="swing-explanation__code-token is-constant" key={partIndex}>{part}</span>
        }

        if (/^\d+(?:\.\d+)?$/.test(part)) {
          return <span className="swing-explanation__code-token is-number" key={partIndex}>{part}</span>
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
    <section className="swing-explanation__detail" aria-label={`${detail.title}の詳細`} onClick={(event) => event.stopPropagation()}>
      <div className="swing-explanation__detail-heading">
        <div>
          <h2>{detail.title}</h2>
        </div>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <p className="swing-explanation__detail-summary">{detail.summary}</p>
      <pre className="swing-explanation__code-example"><code>{highlightCode(detail.code)}</code></pre>
    </section>
  )
}

function isSwingDetected(detectionData: ExplanationProps['detectionData']) {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) {
    return false
  }

  return (detectionData.actions as Record<string, unknown>).swing === true
}

export function SwingExplanation({ detectionData }: ExplanationProps) {
  const [isSwingVisible, setIsSwingVisible] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [localHistory, setLocalHistory] = useState<Point[]>([])
  
  const canShowNextSwingRef = useRef(true)
  const swingTimerRef = useRef<number | null>(null)
  
  const landmarks = getPoseLandmarks(detectionData)
  const details = getSwingDetails(detectionData)
  
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const leftElbow = landmarks[13]
  const rightElbow = landmarks[14]
  const leftWrist = landmarks[15]
  const rightWrist = landmarks[16]

  useEffect(() => {
    if (leftWrist && rightWrist) {
      const currentPt = {
        x: (leftWrist.x + rightWrist.x) / 2,
        y: (leftWrist.y + rightWrist.y) / 2
      }
      setLocalHistory((prev) => {
        const next = [...prev, currentPt]
        if (next.length > 15) {
          next.shift()
        }
        return next
      })
    } else {
      setLocalHistory([])
    }
  }, [detectionData])

  const swingDetected = isSwingDetected(detectionData)
  const resultText = details?.triggered
    ? '振り下ろし！'
    : details?.isPoseAvailable
      ? details.isHistoryFull
        ? '動きを検出中'
        : `履歴蓄積中 (${localHistory.length}/15)`
      : 'ポーズを検出中'

  useEffect(() => {
    if (!swingDetected && !isSwingVisible) {
      canShowNextSwingRef.current = true
    }

    if (!swingDetected || isSwingVisible || !canShowNextSwingRef.current) {
      return
    }

    canShowNextSwingRef.current = false
    setIsSwingVisible(true)
    swingTimerRef.current = window.setTimeout(() => {
      swingTimerRef.current = null
      setIsSwingVisible(false)
    }, SWING_DISPLAY_DURATION_MS)
  }, [swingDetected, isSwingVisible])

  useEffect(() => () => {
    if (swingTimerRef.current !== null) {
      window.clearTimeout(swingTimerRef.current)
    }
  }, [])

  const visualization = details !== null &&
    details.isPoseAvailable &&
    leftShoulder !== undefined && leftShoulder !== null &&
    rightShoulder !== undefined && rightShoulder !== null
    ? {
        details,
        leftShoulder,
        rightShoulder,
        leftElbow,
        rightElbow,
        leftWrist,
        rightWrist,
      }
    : null

  const topVal = details?.top !== null && details?.top !== undefined ? details.top.toFixed(3) : '-'
  const middleVal = details?.middle !== null && details?.middle !== undefined ? details.middle.toFixed(3) : '-'
  const footVal = details?.foot !== null && details?.foot !== undefined ? details.foot.toFixed(3) : '-'
  const diffVal = details?.['foot-top'] !== null && details?.['foot-top'] !== undefined ? details['foot-top'].toFixed(3) : '-'
  const currentHeightVal = details?.handsHeight !== null && details?.handsHeight !== undefined ? details.handsHeight.toFixed(3) : '-'

  return (
    <section className="swing-explanation" aria-label="振り下ろし動作の判定過程">
      <p className="swing-explanation__lead">
        両手首の平均高さが、15フレームの間に上から下へ大きく移動したかを判定します。
      </p>

      <div className="swing-explanation__visualization">
        {visualization !== null ? (
          <svg viewBox="0 0 1 1" role="img" aria-label="肩と腕の骨格、手首の軌跡">
            <line
              x1={visualization.leftShoulder.x}
              y1={visualization.leftShoulder.y}
              x2={visualization.rightShoulder.x}
              y2={visualization.rightShoulder.y}
              className="swing-explanation__shoulder-line"
            />
            <circle cx={visualization.leftShoulder.x} cy={visualization.leftShoulder.y} r={0.014} className="swing-explanation__shoulder-point" />
            <circle cx={visualization.rightShoulder.x} cy={visualization.rightShoulder.y} r={0.014} className="swing-explanation__shoulder-point" />

            {visualization.leftElbow && (
              <line
                x1={visualization.leftShoulder.x}
                y1={visualization.leftShoulder.y}
                x2={visualization.leftElbow.x}
                y2={visualization.leftElbow.y}
                className="swing-explanation__limb-line"
              />
            )}
            {visualization.leftWrist && visualization.leftElbow && (
              <line
                x1={visualization.leftElbow.x}
                y1={visualization.leftElbow.y}
                x2={visualization.leftWrist.x}
                y2={visualization.leftWrist.y}
                className="swing-explanation__limb-line"
              />
            )}

            {visualization.rightElbow && (
              <line
                x1={visualization.rightShoulder.x}
                y1={visualization.rightShoulder.y}
                x2={visualization.rightElbow.x}
                y2={visualization.rightElbow.y}
                className="swing-explanation__limb-line"
              />
            )}
            {visualization.rightWrist && visualization.rightElbow && (
              <line
                x1={visualization.rightElbow.x}
                y1={visualization.rightElbow.y}
                x2={visualization.rightWrist.x}
                y2={visualization.rightWrist.y}
                className="swing-explanation__limb-line"
              />
            )}

            {visualization.leftElbow && <circle cx={visualization.leftElbow.x} cy={visualization.leftElbow.y} r={0.012} fill="#64748b" />}
            {visualization.rightElbow && <circle cx={visualization.rightElbow.x} cy={visualization.rightElbow.y} r={0.012} fill="#64748b" />}
            {visualization.leftWrist && <circle cx={visualization.leftWrist.x} cy={visualization.leftWrist.y} r={0.012} fill="#0ea5e9" />}
            {visualization.rightWrist && <circle cx={visualization.rightWrist.x} cy={visualization.rightWrist.y} r={0.012} fill="#a855f7" />}

            {localHistory.map((pt, idx) => {
              const opacity = (idx + 1) / localHistory.length
              const radius = 0.008 + 0.008 * opacity
              return (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={radius}
                  fill="#10b981"
                  opacity={opacity * 0.7}
                  className="swing-explanation__trail-point"
                />
              )
            })}
            
            {localHistory.length > 1 && (
              <path
                d={`M ${localHistory.map(pt => `${pt.x} ${pt.y}`).join(' L ')}`}
                fill="none"
                stroke="#10b981"
                strokeWidth={0.006}
                opacity={0.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            
            {localHistory.length > 0 && (
              <g>
                <circle
                  cx={localHistory[localHistory.length - 1].x}
                  cy={localHistory[localHistory.length - 1].y}
                  r={0.02}
                  className="swing-explanation__current-center"
                />
                <text
                  x={localHistory[localHistory.length - 1].x}
                  y={localHistory[localHistory.length - 1].y - 0.03}
                  fontSize={0.03}
                  className="swing-explanation__center-label"
                >
                  手の平均
                </text>
              </g>
            )}
          </svg>
        ) : (
          <p className="swing-explanation__waiting">両手首と肩が映るように、少し離れて立ってね</p>
        )}
        {isSwingVisible ? <p className="swing-explanation__detected" role="status">SWING</p> : null}
      </div>

      {selectedCondition !== null ? (
        <div className="swing-explanation__detail-overlay" role="dialog" aria-label="振り下ろしの判定方法の詳細" onClick={() => setSelectedCondition(null)}>
          <ConditionDetailPanel condition={selectedCondition} onClose={() => setSelectedCondition(null)} />
        </div>
      ) : null}

      <div className="swing-explanation__stats-panel">
        <h3>現在のデータ (両手首の平均高さ)</h3>
        <div className="swing-explanation__stats-grid">
          <div className="swing-explanation__stat-item">
            <span className="label">現在の高さ (handsHeight)</span>
            <span className="value">{currentHeightVal}</span>
          </div>
          <div className="swing-explanation__stat-item">
            <span className="label">過去の平均 (top)</span>
            <span className="value">{topVal}</span>
          </div>
          <div className="swing-explanation__stat-item">
            <span className="label">中間の平均 (middle)</span>
            <span className="value">{middleVal}</span>
          </div>
          <div className="swing-explanation__stat-item">
            <span className="label">現在の平均 (foot)</span>
            <span className="value">{footVal}</span>
          </div>
          <div className="swing-explanation__stat-item highlight">
            <span className="label">移動量 (foot - top)</span>
            <span className="value">{diffVal}</span>
          </div>
        </div>
      </div>

      <ol className="swing-explanation__conditions">
        <ConditionStep
          condition="history"
          passed={details?.isHistoryFull === true}
          title={`15フレームの履歴蓄積 (${localHistory.length}/15)`}
          selected={selectedCondition === 'history'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
        <ConditionStep
          condition="direction"
          passed={details?.isDirectionPassed === true}
          title={`上から下への移動 (${topVal} < ${middleVal} < ${footVal})`}
          selected={selectedCondition === 'direction'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
        <ConditionStep
          condition="distance"
          passed={details?.isDistancePassed === true}
          title={`十分な移動量 (${diffVal} >= 0.1)`}
          selected={selectedCondition === 'distance'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
      </ol>

      {!details?.isHistoryFull && details?.isPoseAvailable && (
        <p className="swing-explanation__warning-text">※履歴が15フレーム未満のため判定を行えません。</p>
      )}

      <p className={`swing-explanation__result${details?.triggered ? ' is-triggered' : ''}`}>{resultText}</p>
    </section>
  )
}
