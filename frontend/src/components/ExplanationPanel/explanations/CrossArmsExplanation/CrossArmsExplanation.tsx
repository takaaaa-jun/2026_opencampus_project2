import { useState, type CSSProperties, type ReactNode } from 'react'
import type { ExplanationProps } from '../../types'

import './CrossArmsExplanation.css'

type Role = 'horizontal' | 'vertical'
type Pattern = 'left-horizontal' | 'left-vertical'

type CrossArmsDetails = {
  poseDetected: boolean
  result: boolean
  activePattern: Pattern
  leftAngle: number
  rightAngle: number
  displayLeftAngle: number
  displayRightAngle: number
  leftRole: Role
  rightRole: Role
  leftRoleOk: boolean
  rightRoleOk: boolean
  forearmDistance: number
  distanceThreshold: number
  distanceOk: boolean
  angleToleranceDeg: number
}

type DetectionDataWithCrossArms = NonNullable<ExplanationProps['detectionData']> & {
  actionDetails?: {
    closs?: CrossArmsDetails
  }
}

type ConditionId = 'left_role' | 'right_role' | 'distance'

type ConditionDetail = {
  title: string
  summary: ReactNode
  code: string
}

const CONDITION_DETAILS: Record<ConditionId, ConditionDetail> = {
  left_role: {
    title: '左腕の役割判定',
    summary: (
      <>
        左腕が <strong>横役</strong> なのか <strong>縦役</strong> なのかを、左肘13・左手首15の前腕角度から判定します。
        バックエンドでは、角度が水平・鉛直のどちらに近いかを見て、左腕に期待する向きを切り替えます。
      </>
    ),
    code: `# 左肘(13) - 左手首(15) の前腕角度を計算
left_angle = angle(left_elbow, left_wrist)

# 水平: 0° または 180° 付近から ±30°以内
left_is_horizontal = abs(left_angle - 0) <= 30 or abs(left_angle - 180) <= 30

# 鉛直: 90° または -90° 付近から ±30°以内
left_is_vertical = abs(left_angle - 90) <= 30 or abs(left_angle + 90) <= 30

# activePattern に応じて期待する役割を切り替える
if active_pattern == "left-horizontal":
    expected_role = "horizontal"
else:
    expected_role = "vertical"

left_role_ok = role_of(left_angle) == expected_role`,
  },
  right_role: {
    title: '右腕の役割判定',
    summary: (
      <>
        右腕についても同様に、<strong>横役</strong> / <strong>縦役</strong> のどちらを担うべきかを判定します。
        右肘14・右手首16の前腕角度を使い、左腕と左右対称の役割になっているかを確認します。
      </>
    ),
    code: `# 右肘(14) - 右手首(16) の前腕角度を計算
right_angle = angle(right_elbow, right_wrist)

# 水平: 0° または 180° 付近から ±30°以内
right_is_horizontal = abs(right_angle - 0) <= 30 or abs(right_angle - 180) <= 30

# 鉛直: 90° または -90° 付近から ±30°以内
right_is_vertical = abs(right_angle - 90) <= 30 or abs(right_angle + 90) <= 30

# 左腕が横役なら右腕は縦役、左腕が縦役なら右腕は横役
if active_pattern == "left-horizontal":
    expected_role = "vertical"
else:
    expected_role = "horizontal"

right_role_ok = role_of(right_angle) == expected_role`,
  },
  distance: {
    title: '前腕どうしの距離',
    summary: (
      <>
        左右の前腕どうしの距離が十分近いかを確認します。
        角度だけでは別ポーズと混ざりやすいため、<strong>前腕の間隔</strong> を追加条件として使います。
        線分が交差する場合は距離を0として扱い、<strong>0.1以下</strong> なら条件を満たします。
      </>
    ),
    code: `# 左右の前腕(肘-手首)の線分間距離を計算
forearm_distance = segment_distance(
    left_elbow, left_wrist,
    right_elbow, right_wrist
)

# 線分が交差する場合は distance = 0
if segments_intersect(left_elbow, left_wrist, right_elbow, right_wrist):
    forearm_distance = 0

distance_ok = forearm_distance <= 0.1`,
  },
}

function roleLabel(role: Role) {
  return role === 'horizontal' ? '横役' : '縦役'
}

function patternLabel(pattern: Pattern) {
  return pattern === 'left-horizontal'
    ? '左腕が横役・右腕が縦役'
    : '左腕が縦役・右腕が横役'
}

function highlightCode(code: string) {
  const tokenPattern =
    /(\b(?:if|and|or|is|not|None|True|False|else)\b|\b(?:angle|abs|distance|role_of|segment_distance|segments_intersect|expected_role|active_pattern)\b|\b[A-Z][A-Z_]+\b|\b\d+(?:\.\d+)?\b)/g

  return code.split('\n').map((line, lineIndex) => (
    <span className="crossarms-code-line" key={`${line}-${lineIndex}`}>
      {line.split(tokenPattern).map((part, partIndex) => {
        if (/^(if|and|or|is|not|None|True|False|else)$/.test(part)) {
          return (
            <span className="crossarms-code-token is-keyword" key={partIndex}>
              {part}
            </span>
          )
        }
        if (/^(angle|abs|distance|role_of|segment_distance|segments_intersect)$/.test(part)) {
          return (
            <span className="crossarms-code-token is-function" key={partIndex}>
              {part}
            </span>
          )
        }
        if (/^[A-Z][A-Z_]+$/.test(part)) {
          return (
            <span className="crossarms-code-token is-constant" key={partIndex}>
              {part}
            </span>
          )
        }
        if (/^\d+(?:\.\d+)?$/.test(part)) {
          return (
            <span className="crossarms-code-token is-number" key={partIndex}>
              {part}
            </span>
          )
        }
        return part
      })}
      {lineIndex < code.split('\n').length - 1 ? '\n' : null}
    </span>
  ))
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
        <span className="crossarms-condition-action" aria-hidden="true">
          詳しく見る
        </span>
      </button>
    </li>
  )
}

function DirectionDiagram({
  title,
  angle,
  role,
  roleOk,
  angleToleranceDeg,
}: {
  title: string
  angle: number
  role: Role
  roleOk: boolean
  angleToleranceDeg: number
}) {
  const pointerStyle = {
    '--crossarms-angle': `${angle}deg`,
  } as CSSProperties

  return (
    <article className={`crossarms-circleCard ${roleOk ? 'is-ok' : 'is-ng'}`}>
      <header className="crossarms-circleCard__header">
        <h4>{title}</h4>
        <span className={`crossarms-pill crossarms-pill--${role}`}>{roleLabel(role)}</span>
      </header>

      <div
        className={`crossarms-directionArea crossarms-directionArea--${role}`}
        style={pointerStyle}
        role="img"
        aria-label={`${title}の角度 ${angle}度、${roleLabel(role)}`}
      >
        <div className="crossarms-directionArea__inner">
          <span className="crossarms-axis crossarms-axis--horizontal" />
          <span className="crossarms-axis crossarms-axis--vertical" />

          <span className="crossarms-directionLabel crossarms-directionLabel--top">上</span>
          <span className="crossarms-directionLabel crossarms-directionLabel--right">0°</span>
          <span className="crossarms-directionLabel crossarms-directionLabel--bottom">下</span>
          <span className="crossarms-directionLabel crossarms-directionLabel--left">180°</span>

          <span className="crossarms-pointer">
            <span className="crossarms-pointer__end" />
          </span>
          <span className="crossarms-centerDot" />
        </div>
      </div>

      <div className="crossarms-circleCard__body">
        <div className="crossarms-valueRow">
          <span>表示角度</span>
          <strong>{angle}°</strong>
        </div>
        <div className="crossarms-valueRow crossarms-valueRow--small">
          <span>許容範囲</span>
          <strong>±{angleToleranceDeg}°</strong>
        </div>
        <div className={`crossarms-condition ${roleOk ? 'is-ok' : 'is-ng'}`}>
          {roleOk ? '条件OK' : '条件NG'}
        </div>
      </div>
    </article>
  )
}

function ConditionDetailPanel({
  condition,
  onClose,
}: {
  condition: ConditionId
  onClose: () => void
}) {
  const detail = CONDITION_DETAILS[condition]

  return (
    <section
      className="crossarms-detail"
      aria-label={`${detail.title}の詳細`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="crossarms-detail__heading">
        <div>
          <h2>{detail.title}</h2>
        </div>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>

      <div className="crossarms-detail__single">
        <p className="crossarms-detail__summary">{detail.summary}</p>
        <pre className="crossarms-code-example">
          <code>{highlightCode(detail.code)}</code>
        </pre>
      </div>
    </section>
  )
}

export function CrossArmsExplanation({ detectionData }: ExplanationProps) {
  const data = detectionData as DetectionDataWithCrossArms | null
  const details = data?.actionDetails?.closs

  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)

  if (!details?.poseDetected) {
    return (
      <section className="crossarms">
        <div className="crossarms-emptyState">
          <h3>ウルトラマンの説明</h3>
          <p>骨格を検出中です。バックエンドからウルトラマンの判定データが届くと表示します。</p>
        </div>
      </section>
    )
  }

  const angleToleranceDeg = details.angleToleranceDeg
  const leftAngle = details.displayLeftAngle
  const rightAngle = details.displayRightAngle
  const leftRole = details.leftRole
  const rightRole = details.rightRole
  const leftRoleOk = details.leftRoleOk
  const rightRoleOk = details.rightRoleOk
  const distanceOk = details.distanceOk
  const distanceThreshold = details.distanceThreshold
  const forearmDistance = details.forearmDistance
  const result = details.result
  const activePattern = details.activePattern

  return (
    <section className="crossarms crossarms--compact" aria-label="十字腕ポーズの判定過程">
      <p className="crossarms-intro">
        ウルトラマンのポーズは、<strong>左右の腕をそれぞれ横役・縦役に割り当て、角度と前腕の距離を組み合わせて判定</strong>
        しています。腕の向きだけでなく、<strong>どちらの腕がどの役割か</strong>、さらに<strong>左右の前腕が十分近いか</strong>を確認することで、
        十字に見える姿勢だけを拾うようにしています。
      </p>

      <div className={`crossarms-hero ${result ? 'crossarms-hero--ok' : 'crossarms-hero--ng'}`}>
        <div className="crossarms-hero__icon">{result ? '✓' : '!'}</div>
        <div className="crossarms-hero__content">
          <h3>判定：{result ? 'OK' : 'NG'}</h3>
          <p>{patternLabel(activePattern)}</p>
        </div>
      </div>

      <div className="crossarms-grid">
        <DirectionDiagram
          title="左腕"
          angle={leftAngle}
          role={leftRole}
          roleOk={leftRoleOk}
          angleToleranceDeg={angleToleranceDeg}
        />
        <DirectionDiagram
          title="右腕"
          angle={rightAngle}
          role={rightRole}
          roleOk={rightRoleOk}
          angleToleranceDeg={angleToleranceDeg}
        />
      </div>

      <div className="crossarms-metrics">
        <article className="crossarms-metricCard">
          <div className="crossarms-metricCard__title">左右の役割</div>
          <div className="crossarms-roleList">
            <span className={`crossarms-roleChip ${leftRoleOk ? 'is-ok' : 'is-ng'}`}>
              左腕：{roleLabel(leftRole)}
            </span>
            <span className={`crossarms-roleChip ${rightRoleOk ? 'is-ok' : 'is-ng'}`}>
              右腕：{roleLabel(rightRole)}
            </span>
          </div>
        </article>

        <article className="crossarms-metricCard">
          <div className="crossarms-metricCard__title">前腕どうしの距離</div>
          <div className="crossarms-distanceHeader">
            <strong>{forearmDistance}</strong>
            <span>しきい値：{distanceThreshold} 以下</span>
          </div>
          <meter
            className={`crossarms-meter ${distanceOk ? 'is-ok' : 'is-ng'}`}
            min={0}
            max={distanceThreshold}
            value={forearmDistance}
          >
            {forearmDistance}
          </meter>
          <div className={`crossarms-condition ${distanceOk ? 'is-ok' : 'is-ng'}`}>
            {distanceOk ? '距離条件OK' : '距離条件NG'}
          </div>
        </article>
      </div>

      <div className="crossarms-section-header">
        <h4 className="crossarms-conditions-title">判定の条件</h4>
        <button
          type="button"
          className="crossarms-overview-toggle"
          onClick={() => setIsOverviewOpen(true)}
        >
          判定のアルゴリズム全体像
        </button>
      </div>

      {isOverviewOpen && (
        <div
          className="crossarms-detail-overlay"
          role="dialog"
          aria-label="十字腕ポーズ判定の全体像"
          onClick={() => setIsOverviewOpen(false)}
        >
          <section
            className="crossarms-detail crossarms-overview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crossarms-detail__heading">
              <div>
                <h2>💡 ウルトラマン（Cross Arms）を判定する仕組みの全体像</h2>
              </div>
              <button type="button" onClick={() => setIsOverviewOpen(false)}>
                閉じる
              </button>
            </div>

            <div className="crossarms-overview-layout">
              <div className="crossarms-overview-main">
                <p className="crossarms-overview-text">
                  十字腕ポーズは、<strong>「左右の腕をそれぞれ横向き・縦向きにそろえ、中央付近で十字に見える状態」</strong>を目指した判定です。
                </p>
                <p className="crossarms-overview-text">
                  カメラ映像から肩・肘・手首・腰の座標を取り出し、<strong>関節角度</strong>と<strong>左右の距離</strong>を組み合わせて判定しています。
                </p>

                <div className="crossarms-overview-steps">
                  <div className="crossarms-overview-step">
                    <span className="crossarms-step-badge">1</span>
                    <div className="crossarms-step-content">
                      <strong className="crossarms-step-title">腕ごとの角度を測る</strong>
                      <p className="crossarms-step-desc">
                        左肘13・左手首15、右肘14・右手首16の前腕角度を計算し、水平と鉛直のどちらに近いかを見ます。
                      </p>
                    </div>
                  </div>

                  <div className="crossarms-overview-step">
                    <span className="crossarms-step-badge">2</span>
                    <div className="crossarms-step-content">
                      <strong className="crossarms-step-title">左腕・右腕の役割を決める</strong>
                      <p className="crossarms-step-desc">
                        <code>activePattern</code> に応じて、左腕が横役か縦役か、右腕が横役か縦役かを切り替えます。
                      </p>
                    </div>
                  </div>

                  <div className="crossarms-overview-step">
                    <span className="crossarms-step-badge">3</span>
                    <div className="crossarms-step-content">
                      <strong className="crossarms-step-title">前腕どうしの距離を確認する</strong>
                      <p className="crossarms-step-desc">
                        左右の前腕の線分間距離を計算し、交差していれば0、そうでなければ近さを数値で判定します。
                      </p>
                    </div>
                  </div>
                </div>

                <p className="crossarms-overview-summary">
                  角度だけでは「万歳」や「別のポーズ」と混ざりやすく、距離だけでは「腕が近い別動作」を拾いやすいです。
                  <strong>役割判定・角度判定・距離判定を組み合わせることで、十字腕ポーズだけを安定して見分ける</strong>ようにしています。
                </p>
              </div>

              <aside className="crossarms-overview-aside">
                <div className="crossarms-math-card">
                  <h4 className="crossarms-math-title">📐 角度の計算方法</h4>
                  <p className="crossarms-math-intro">
                    肩や肘など3点の座標から、真ん中の関節を頂点とする角度を求めるときは、<strong>ベクトルの内積</strong>を使います。
                  </p>

                  <div className="crossarms-math-step">
                    <h5>① ベクトルを作る</h5>
                    <p>頂点を中心に、2本のベクトルを作成します。</p>
                  </div>

                  <div className="crossarms-math-step">
                    <h5>② 内積から cosθ を求める</h5>
                    <p>2本のベクトルの長さと内積を使って、角度のコサインを計算します。</p>
                    <div className="crossarms-math-formula">
                      <code>cosθ = (a · b) / (|a| × |b|)</code>
                    </div>
                  </div>

                  <div className="crossarms-math-step">
                    <h5>③ arccos で角度に変換する</h5>
                    <p>最後に逆余弦を使って、0〜180度の角度として扱います。</p>
                    <div className="crossarms-math-formula">
                      <code>θ = arccos(cosθ)</code>
                    </div>
                  </div>

                  <p className="crossarms-math-footer">
                    この計算をフレームごとに繰り返すことで、リアルタイムに腕の向きを追っています。
                  </p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      {selectedCondition !== null ? (
        <div
          className="crossarms-detail-overlay"
          role="dialog"
          aria-label="十字腕ポーズ判定の詳細"
          onClick={() => setSelectedCondition(null)}
        >
          <ConditionDetailPanel condition={selectedCondition} onClose={() => setSelectedCondition(null)} />
        </div>
      ) : null}

      <ol className="crossarms-conditions">
        <ConditionStep
          condition="left_role"
          passed={leftRoleOk}
          title={`左腕：${roleLabel(leftRole)} [${leftRoleOk ? 'OK' : 'NG'}]`}
          selected={selectedCondition === 'left_role'}
          onSelect={(condition) => setSelectedCondition((current) => (current === condition ? null : condition))}
        />
        <ConditionStep
          condition="right_role"
          passed={rightRoleOk}
          title={`右腕：${roleLabel(rightRole)} [${rightRoleOk ? 'OK' : 'NG'}]`}
          selected={selectedCondition === 'right_role'}
          onSelect={(condition) => setSelectedCondition((current) => (current === condition ? null : condition))}
        />
        <ConditionStep
          condition="distance"
          passed={distanceOk}
          title={`前腕距離 ≤ しきい値 (距離:${forearmDistance.toFixed(2)} / しきい値:${distanceThreshold.toFixed(2)})`}
          selected={selectedCondition === 'distance'}
          onSelect={(condition) => setSelectedCondition((current) => (current === condition ? null : condition))}
        />
      </ol>
    </section>
  )
}