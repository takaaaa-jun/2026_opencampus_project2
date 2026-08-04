import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ExplanationProps } from '../../types'
import './SurpriseExplanation.css'

type Point = {
  x: number
  y: number
}

type ConditionId = 'hip_shoulder_elbow' | 'wrist_elbow_shoulder' | 'wrist_shoulder_distance'

type ConditionDetail = {
  title: string
  summary: ReactNode
  code: string
}

const SURPRISE_DISPLAY_DURATION_MS = 1500

const CONDITION_DETAILS: Record<ConditionId, ConditionDetail> = {
  hip_shoulder_elbow: {
    title: '腰-肩-肘の角度',
    summary: (
      <>
        腰・肩・肘のなす角を測ることで、<strong>両肘がしっかり上がっているか</strong>を判定します。これにより、普段の立ち姿勢や手が下がっている状態を誤って「驚かし」と検知するのを防ぎ、<strong>驚かす時の「腕が上がったポーズ」</strong>の前提条件として機能します。
      </>
    ),
    code: `# 腰(24, 23) - 肩(12, 11) - 肘(14, 13) の角度
left_angle = angle(left_elbow, left_shoulder, left_hip)
right_angle = angle(right_elbow, right_shoulder, right_hip)

is_left_ok = 120 <= left_angle <= 170
is_right_ok = 120 <= right_angle <= 170
hip_shoulder_elbow_passed = is_left_ok and is_right_ok`,
  },
  wrist_elbow_shoulder: {
    title: '手首-肘-肩の角度',
    summary: (
      <>
        手首・肘・肩の角度を測り、<strong>肘が適度に伸びているか</strong>を判定します。肘が深く曲がった縮こまった姿勢や胸の前での別の動作を排除し、<strong>相手を驚かせるための「大きく腕を広げたダイナミックなポーズ」</strong>を正確に識別するために必要です。
      </>
    ),
    code: `# 手首(16, 15) - 肘(14, 13) - 肩(12, 11) の角度
left_angle = angle(left_shoulder, left_elbow, left_wrist)
right_angle = angle(right_shoulder, right_elbow, right_wrist)

is_left_ok = 120 <= left_angle <= 180
is_right_ok = 120 <= right_angle <= 180
wrist_elbow_shoulder_passed = is_left_ok and is_right_ok`,
  },
  wrist_shoulder_distance: {
    title: '左右の手首の距離 ＞ 肩幅',
    summary: (
      <>
        <strong>左右の手首の幅が、肩幅よりも外側に開いているか</strong>を判定します。これにより、単に真上に手を挙げただけの万歳（他のポーズ）と区別し、<strong>体を左右に大きく見せて「ワッ！」と驚かせる特徴的な手の開き方</strong>を検知します。
      </>
    ),
    code: `# 左右の手首の距離 > 肩幅の距離 (X軸 of 差)
shoulder_width = abs(right_shoulder.x - left_shoulder.x)
wrist_width = abs(right_wrist.x - left_wrist.x)

wrist_shoulder_distance_passed = wrist_width > shoulder_width`,
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

function calculateAngle(a: Point, b: Point, c: Point): number {
  const x1 = a.x - b.x
  const y1 = a.y - b.y
  const x2 = c.x - b.x
  const y2 = c.y - b.y
  const dot = x1 * x2 + y1 * y2
  const len1 = Math.hypot(x1, y1)
  const len2 = Math.hypot(x2, y2)
  if (len1 === 0 || len2 === 0) return 0
  const cosine = dot / (len1 * len2)
  const cosClamped = Math.max(-1, Math.min(1, cosine))
  return (Math.acos(cosClamped) * 180) / Math.PI
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
        <span className="surprise-explanation__condition-action" aria-hidden="true">詳しく見る</span>
      </button>
    </li>
  )
}

function highlightCode(code: string) {
  const tokenPattern = /(\b(?:if|and|or|is|not|None|True|False)\b|\b(?:angle|abs)\b|\b[A-Z][A-Z_]+\b|\b\d+(?:\.\d+)?\b)/g

  return code.split('\n').map((line, lineIndex) => (
    <span className="surprise-explanation__code-line" key={`${line}-${lineIndex}`}>
      {line.split(tokenPattern).map((part, partIndex) => {
        if (/^(if|and|or|is|not|None|True|False)$/.test(part)) {
          return <span className="surprise-explanation__code-token is-keyword" key={partIndex}>{part}</span>
        }
        if (/^(angle|abs)$/.test(part)) {
          return <span className="surprise-explanation__code-token is-function" key={partIndex}>{part}</span>
        }
        if (/^[A-Z][A-Z_]+$/.test(part)) {
          return <span className="surprise-explanation__code-token is-constant" key={partIndex}>{part}</span>
        }
        if (/^\d+(?:\.\d+)?$/.test(part)) {
          return <span className="surprise-explanation__code-token is-number" key={partIndex}>{part}</span>
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
    <section className="surprise-explanation__detail" aria-label={`${detail.title}の詳細`} onClick={(event) => event.stopPropagation()}>
      <div className="surprise-explanation__detail-heading">
        <div>
          <h2>{detail.title}</h2>
        </div>
        <button type="button" onClick={onClose}>閉じる</button>
      </div>
      <p className="surprise-explanation__detail-summary">{detail.summary}</p>
      <pre className="surprise-explanation__code-example"><code>{highlightCode(detail.code)}</code></pre>
    </section>
  )
}

function isSurpriseDetected(detectionData: ExplanationProps['detectionData']) {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) {
    return false
  }
  return (detectionData.actions as Record<string, unknown>).surprise === true
}

export function SurpriseExplanation({ detectionData }: ExplanationProps) {
  const [isSurpriseVisible, setIsSurpriseVisible] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const canShowNextSurpriseRef = useRef(true)
  const surpriseTimerRef = useRef<number | null>(null)

  const landmarks = getPoseLandmarks(detectionData)

  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const leftShoulder = landmarks[11]
  const rightShoulder = landmarks[12]
  const leftElbow = landmarks[13]
  const rightElbow = landmarks[14]
  const leftWrist = landmarks[15]
  const rightWrist = landmarks[16]

  const isPoseAvailable = !!(
    leftHip && rightHip && leftShoulder && rightShoulder &&
    leftElbow && rightElbow && leftWrist && rightWrist
  )

  const leftShoulderAngle = isPoseAvailable ? calculateAngle(leftElbow!, leftShoulder!, leftHip!) : 0
  const rightShoulderAngle = isPoseAvailable ? calculateAngle(rightElbow!, rightShoulder!, rightHip!) : 0
  const leftElbowAngle = isPoseAvailable ? calculateAngle(leftShoulder!, leftElbow!, leftWrist!) : 0
  const rightElbowAngle = isPoseAvailable ? calculateAngle(rightShoulder!, rightElbow!, rightWrist!) : 0

  const shoulderWidth = isPoseAvailable ? Math.abs(rightShoulder!.x - leftShoulder!.x) : 0
  const wristWidth = isPoseAvailable ? Math.abs(rightWrist!.x - leftWrist!.x) : 0

  const isLeftShoulderAngleOk = leftShoulderAngle >= 120 && leftShoulderAngle <= 170
  const isRightShoulderAngleOk = rightShoulderAngle >= 120 && rightShoulderAngle <= 170
  const isShoulderAngleOk = isLeftShoulderAngleOk && isRightShoulderAngleOk

  const isLeftElbowAngleOk = leftElbowAngle >= 120 && leftElbowAngle <= 180
  const isRightElbowAngleOk = rightElbowAngle >= 120 && rightElbowAngle <= 180
  const isElbowAngleOk = isLeftElbowAngleOk && isRightElbowAngleOk

  const isWristDistanceOk = wristWidth > shoulderWidth

  const surpriseDetected = isSurpriseDetected(detectionData)

  useEffect(() => {
    if (!surpriseDetected && !isSurpriseVisible) {
      canShowNextSurpriseRef.current = true
    }

    if (!surpriseDetected || isSurpriseVisible || !canShowNextSurpriseRef.current) {
      return
    }

    canShowNextSurpriseRef.current = false
    setIsSurpriseVisible(true)
    surpriseTimerRef.current = window.setTimeout(() => {
      surpriseTimerRef.current = null
      setIsSurpriseVisible(false)
    }, SURPRISE_DISPLAY_DURATION_MS)
  }, [surpriseDetected, isSurpriseVisible])

  useEffect(() => () => {
    if (surpriseTimerRef.current !== null) {
      window.clearTimeout(surpriseTimerRef.current)
    }
  }, [])

  const visualization = isPoseAvailable && leftShoulder && rightShoulder && leftHip && rightHip && leftElbow && rightElbow && leftWrist && rightWrist
    ? {
        leftHip, rightHip,
        leftShoulder, rightShoulder,
        leftElbow, rightElbow,
        leftWrist, rightWrist,
      }
    : null

  return (
    <section className="surprise-explanation" aria-label="驚かす動作の判定過程">
      <h4 className="surprise-explanation__title">判定の可視化</h4>
      <p className="surprise-explanation__lead">両腕を広げて万歳し、手が肩幅より外側に開いている姿勢を判定します</p>

      <div className="surprise-explanation__visualization">
        {visualization !== null ? (
          <svg viewBox="0 0 1 1" role="img" aria-label="骨格と角度・幅の可視化">
            {/* 肩幅のライン */}
            <line
              x1={visualization.leftShoulder.x}
              y1={visualization.leftShoulder.y}
              x2={visualization.rightShoulder.x}
              y2={visualization.rightShoulder.y}
              className="surprise-explanation__shoulder-line"
            />
            {/* 手首幅のライン */}
            <line
              x1={visualization.leftWrist.x}
              y1={visualization.leftWrist.y}
              x2={visualization.rightWrist.x}
              y2={visualization.rightWrist.y}
              className={`surprise-explanation__wrist-line ${isWristDistanceOk ? 'is-ok' : ''}`}
            />

            {/* 体幹・腰のライン */}
            <line
              x1={visualization.leftHip.x}
              y1={visualization.leftHip.y}
              x2={visualization.rightHip.x}
              y2={visualization.rightHip.y}
              className="surprise-explanation__hip-line"
            />
            <line
              x1={visualization.leftShoulder.x}
              y1={visualization.leftShoulder.y}
              x2={visualization.leftHip.x}
              y2={visualization.leftHip.y}
              className="surprise-explanation__trunk-line"
            />
            <line
              x1={visualization.rightShoulder.x}
              y1={visualization.rightShoulder.y}
              x2={visualization.rightHip.x}
              y2={visualization.rightHip.y}
              className="surprise-explanation__trunk-line"
            />

            {/* 左腕のライン */}
            <line
              x1={visualization.leftShoulder.x}
              y1={visualization.leftShoulder.y}
              x2={visualization.leftElbow.x}
              y2={visualization.leftElbow.y}
              className={`surprise-explanation__limb-line ${isLeftShoulderAngleOk ? 'is-ok' : ''}`}
            />
            <line
              x1={visualization.leftElbow.x}
              y1={visualization.leftElbow.y}
              x2={visualization.leftWrist.x}
              y2={visualization.leftWrist.y}
              className={`surprise-explanation__limb-line ${isLeftElbowAngleOk ? 'is-ok' : ''}`}
            />

            {/* 右腕のライン */}
            <line
              x1={visualization.rightShoulder.x}
              y1={visualization.rightShoulder.y}
              x2={visualization.rightElbow.x}
              y2={visualization.rightElbow.y}
              className={`surprise-explanation__limb-line ${isRightShoulderAngleOk ? 'is-ok' : ''}`}
            />
            <line
              x1={visualization.rightElbow.x}
              y1={visualization.rightElbow.y}
              x2={visualization.rightWrist.x}
              y2={visualization.rightWrist.y}
              className={`surprise-explanation__limb-line ${isRightElbowAngleOk ? 'is-ok' : ''}`}
            />

            {/* 各関節点 */}
            <circle cx={visualization.leftHip.x} cy={visualization.leftHip.y} r={0.018} className="surprise-explanation__joint-point" />
            <circle cx={visualization.rightHip.x} cy={visualization.rightHip.y} r={0.018} className="surprise-explanation__joint-point" />
            
            <circle cx={visualization.leftShoulder.x} cy={visualization.leftShoulder.y} r={0.02} className={`surprise-explanation__joint-point ${isLeftShoulderAngleOk ? 'is-ok' : ''}`} />
            <circle cx={visualization.rightShoulder.x} cy={visualization.rightShoulder.y} r={0.02} className={`surprise-explanation__joint-point ${isRightShoulderAngleOk ? 'is-ok' : ''}`} />
            
            <circle cx={visualization.leftElbow.x} cy={visualization.leftElbow.y} r={0.018} className={`surprise-explanation__joint-point ${isLeftElbowAngleOk ? 'is-ok' : ''}`} />
            <circle cx={visualization.rightElbow.x} cy={visualization.rightElbow.y} r={0.018} className={`surprise-explanation__joint-point ${isRightElbowAngleOk ? 'is-ok' : ''}`} />
            
            <circle cx={visualization.leftWrist.x} cy={visualization.leftWrist.y} r={0.02} className="surprise-explanation__wrist-point" />
            <circle cx={visualization.rightWrist.x} cy={visualization.rightWrist.y} r={0.02} className="surprise-explanation__wrist-point" />

            {/* 点番号ラベル */}
            <text x={visualization.leftHip.x - 0.025} y={visualization.leftHip.y + 0.025} className="surprise-explanation__label-number">23</text>
            <text x={visualization.rightHip.x + 0.025} y={visualization.rightHip.y + 0.025} className="surprise-explanation__label-number">24</text>
            <text x={visualization.leftShoulder.x - 0.025} y={visualization.leftShoulder.y - 0.025} className="surprise-explanation__label-number">11</text>
            <text x={visualization.rightShoulder.x + 0.025} y={visualization.rightShoulder.y - 0.025} className="surprise-explanation__label-number">12</text>
            <text x={visualization.leftElbow.x - 0.025} y={visualization.leftElbow.y} className="surprise-explanation__label-number">13</text>
            <text x={visualization.rightElbow.x + 0.025} y={visualization.rightElbow.y} className="surprise-explanation__label-number">14</text>
            <text x={visualization.leftWrist.x - 0.025} y={visualization.leftWrist.y - 0.025} className="surprise-explanation__label-number">15</text>
            <text x={visualization.rightWrist.x + 0.025} y={visualization.rightWrist.y - 0.025} className="surprise-explanation__label-number">16</text>

            {/* 角度のテキスト表示 */}
            <text x={visualization.leftShoulder.x - 0.04} y={visualization.leftShoulder.y + 0.03} className={`surprise-explanation__text-angle ${isLeftShoulderAngleOk ? 'is-ok' : ''}`}>
              {leftShoulderAngle.toFixed(0)}°
            </text>
            <text x={visualization.rightShoulder.x + 0.04} y={visualization.rightShoulder.y + 0.03} className={`surprise-explanation__text-angle ${isRightShoulderAngleOk ? 'is-ok' : ''}`}>
              {rightShoulderAngle.toFixed(0)}°
            </text>
            <text x={visualization.leftElbow.x - 0.04} y={visualization.leftElbow.y - 0.02} className={`surprise-explanation__text-angle ${isLeftElbowAngleOk ? 'is-ok' : ''}`}>
              {leftElbowAngle.toFixed(0)}°
            </text>
            <text x={visualization.rightElbow.x + 0.04} y={visualization.rightElbow.y - 0.02} className={`surprise-explanation__text-angle ${isRightElbowAngleOk ? 'is-ok' : ''}`}>
              {rightElbowAngle.toFixed(0)}°
            </text>

            {/* 幅（X座標差）のガイドラベル */}
            <text x={(visualization.leftShoulder.x + visualization.rightShoulder.x) / 2} y={(visualization.leftShoulder.y + visualization.rightShoulder.y) / 2 - 0.02} className="surprise-explanation__text-width">
              肩幅: {shoulderWidth.toFixed(2)}
            </text>
            <text x={(visualization.leftWrist.x + visualization.rightWrist.x) / 2} y={(visualization.leftWrist.y + visualization.rightWrist.y) / 2 + 0.04} className={`surprise-explanation__text-width ${isWristDistanceOk ? 'is-ok' : ''}`}>
              手首幅: {wristWidth.toFixed(2)}
            </text>
          </svg>
        ) : (
          <p className="surprise-explanation__waiting">両手・両肩・腰が映るように、少し離れて立ってね</p>
        )}
        {isSurpriseVisible ? <p className="surprise-explanation__detected" role="status">SURPRISE</p> : null}
      </div>

      {selectedCondition !== null ? (
        <div className="surprise-explanation__detail-overlay" role="dialog" aria-label="驚かしポーズ判定方法の詳細" onClick={() => setSelectedCondition(null)}>
          <ConditionDetailPanel condition={selectedCondition} onClose={() => setSelectedCondition(null)} />
        </div>
      ) : null}

      <div className="surprise-explanation__section-header">
        <h4 className="surprise-explanation__conditions-title">判定の条件</h4>
        <button
          type="button"
          className="surprise-explanation__overview-toggle"
          onClick={() => setIsOverviewOpen(true)}
        >
          判定のアルゴリズム全体像
        </button>
      </div>

      {isOverviewOpen && (
        <div
          className="surprise-explanation__detail-overlay"
          role="dialog"
          aria-label="驚かしポーズ判定の全体像"
          onClick={() => setIsOverviewOpen(false)}
        >
          <section
            className="surprise-explanation__detail surprise-explanation__overview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="surprise-explanation__detail-heading">
              <div>
                <h2>💡 驚かす（Surprise）を判定する仕組みの全体像</h2>
              </div>
              <button type="button" onClick={() => setIsOverviewOpen(false)}>
                閉じる
              </button>
            </div>

            <div className="surprise-explanation__overview-layout">
              {/* 左カラム: 判定ステップとまとめ */}
              <div className="surprise-explanation__overview-main">
                <p className="surprise-explanation__overview-text">
                  驚かす動作は、<strong>「両手を斜め上・外側に大きく広げて、自分を大きく見せる『ワッ！』とする瞬間のポーズ」</strong>です。
                </p>
                <p className="surprise-explanation__overview-text">
                  カメラ映像からAIが肩・肘・手首・腰などの特徴的な点を<strong>骨格（ランドマーク座標）</strong>として取得し、その位置関係（角度や距離）から判定しています。
                </p>

                <div className="surprise-explanation__overview-steps">
                  <div className="surprise-explanation__overview-step">
                    <span className="surprise-explanation__step-badge">1</span>
                    <div className="surprise-explanation__step-content">
                      <strong className="surprise-explanation__step-title">両肘を高く上げているか？</strong> (腰 - 肩 - 肘の角度)
                      <p className="surprise-explanation__step-desc">普段の立ち姿勢や、手が下がっている状態を「驚かす」と誤検知するのを防ぎます。</p>
                    </div>
                  </div>
                  <div className="surprise-explanation__overview-step">
                    <span className="surprise-explanation__step-badge">2</span>
                    <div className="surprise-explanation__step-content">
                      <strong className="surprise-explanation__step-title">腕を縮こませずに広げているか？</strong> (手首 - 肘 - 肩の角度)
                      <p className="surprise-explanation__step-desc">胸の前で腕を縮こませた、別のアクション（アッパーなど）を排除します。</p>
                    </div>
                  </div>
                  <div className="surprise-explanation__overview-step">
                    <span className="surprise-explanation__step-badge">3</span>
                    <div className="surprise-explanation__step-content">
                      <strong className="surprise-explanation__step-title">手は肩幅より外側に開いているか？</strong> (左右の手首の距離 ＞ 肩幅)
                      <p className="surprise-explanation__step-desc">単に真上に手を挙げた「挙手」や「万歳」と区別します。</p>
                    </div>
                  </div>
                </div>

                <p className="surprise-explanation__overview-summary">
                  もし「腕を上げる」だけならアッパーと区別がつかず、「横に広げる」だけならTポーズと区別がつきません。
                  <strong>これら3つの判定基準を組み合わせることで、初めて「驚かすポーズ」だけを正確に見分けることができる</strong>ようになります。
                </p>
              </div>

              {/* 右カラム: 数学コラム */}
              <aside className="surprise-explanation__overview-aside">
                <div className="surprise-explanation__math-card">
                  <h4 className="surprise-explanation__math-title">📐 角度の計算方法（高校数学の応用）</h4>
                  <p className="surprise-explanation__math-intro">
                    「腰 - 肩 - 肘」や「手首 - 肘 - 肩」などの関節がなす角度を測るために、プログラムの裏側では高校の数学で学習する<strong>「ベクトルの内積」</strong>を利用しています。
                  </p>
                  
                  <div className="surprise-explanation__math-step">
                    <h5>① ベクトルの作成</h5>
                    <p>
                      3つの関節（例えば、肘・肩・腰）の座標から、肩を始点とした2本のベクトル <strong>a</strong>（肩→肘）と <strong>b</strong>（肩→腰）を作ります。
                    </p>
                  </div>

                  <div className="surprise-explanation__math-step">
                    <h5>② 内積の公式から cosθ を算出</h5>
                    <p>
                      2つのベクトルの長さと成分から、次の公式を使って角度のコサイン（cosθ）を求めます。
                    </p>
                    <div className="surprise-explanation__math-formula">
                      <code>cosθ = (a · b) / (|a| × |b|)</code>
                    </div>
                  </div>

                  <div className="surprise-explanation__math-step">
                    <h5>③ アークコサインで角度 θ へ変換</h5>
                    <p>
                      得られた cosθ の値から、逆三角関数のアークコサイン（arccos）を用いて、最終的な角度 θ を度数法（°）に変換します。
                    </p>
                    <div className="surprise-explanation__math-formula">
                      <code>θ = arccos(cosθ)</code>
                    </div>
                  </div>
                  
                  <p className="surprise-explanation__math-footer">
                    カメラから送られてくる点座標（X, Y）の変化に対して、この計算を一秒間に何十回も繰り返すことで、リアルタイムで関節の角度を測ることができるのです。
                  </p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      <ol className="surprise-explanation__conditions">
        <ConditionStep
          condition="hip_shoulder_elbow"
          passed={isSurpriseVisible || isShoulderAngleOk}
          title={`腰-肩-肘の角度 [120～170°] (左:${leftShoulderAngle.toFixed(0)}° 右:${rightShoulderAngle.toFixed(0)}°)`}
          selected={selectedCondition === 'hip_shoulder_elbow'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
        <ConditionStep
          condition="wrist_elbow_shoulder"
          passed={isSurpriseVisible || isElbowAngleOk}
          title={`手首-肘-肩の角度 [120～180°] (左:${leftElbowAngle.toFixed(0)}° 右:${rightElbowAngle.toFixed(0)}°)`}
          selected={selectedCondition === 'wrist_elbow_shoulder'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
        <ConditionStep
          condition="wrist_shoulder_distance"
          passed={isSurpriseVisible || isWristDistanceOk}
          title={`手首幅 ＞ 肩幅 (手首:${wristWidth.toFixed(2)} 肩幅:${shoulderWidth.toFixed(2)})`}
          selected={selectedCondition === 'wrist_shoulder_distance'}
          onSelect={(condition) => setSelectedCondition((current) => current === condition ? null : condition)}
        />
      </ol>
    </section>
  )
}
