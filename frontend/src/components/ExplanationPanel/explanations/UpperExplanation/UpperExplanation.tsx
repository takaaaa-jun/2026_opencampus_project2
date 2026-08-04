import { useState, type ReactNode } from 'react'
import type { ExplanationProps } from '../../types'

import './UpperExplanation.css'

type NumericHistory = number[] | undefined

type HandDetail = {
  currentY?: number
  shoulderY?: number
  startAvg?: number
  endAvg?: number
  dy?: number
  history?: NumericHistory
  yHistory?: NumericHistory
  values?: NumericHistory
  aboveShoulder?: boolean
  passedDy?: boolean
  ok?: boolean
  currentX?: number
  shoulderX?: number
  historyX?: NumericHistory
  historyShoulderX?: NumericHistory
  historyShoulderY?: NumericHistory
  risesEnough?: boolean
  startsBelowShoulder?: boolean
  endsNearOrAboveShoulder?: boolean
  betweenShoulders?: boolean
}

type UpperDetails = {
  threshold?: number
  result?: boolean
  isOk?: boolean
  ok?: boolean
  frameHeight?: number
  left?: HandDetail
  right?: HandDetail
  leftHand?: HandDetail
  rightHand?: HandDetail
  leftRisesEnough?: boolean
  rightRisesEnough?: boolean
  leftStartsBelowShoulder?: boolean
  rightStartsBelowShoulder?: boolean
  leftEndsNearOrAboveShoulder?: boolean
  rightEndsNearOrAboveShoulder?: boolean
  leftBetweenShoulders?: boolean
  rightBetweenShoulders?: boolean
  shoulderWidth?: number
  riseThreshold?: number
  shoulderReachMargin?: number
}

type DetectionDataLike = NonNullable<ExplanationProps['detectionData']> & {
  imageHeight?: number
  frameHeight?: number
  videoHeight?: number
  canvasHeight?: number
  height?: number
  actionDetails?: { upper?: UpperDetails }
  upper?: UpperDetails
  action?: { upper?: UpperDetails }
  timestamp?: number | string
}

type ChartSeries = {
  label: string
  values: number[]
  className: string
}

type ReferenceLine = {
  label: string
  value: number
  className: string
}

type ConditionId = 'rise' | 'start' | 'reach' | 'between'

type ConditionDetail = {
  title: string
  summary: ReactNode
  code: string
}

function readNumeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function resolveFrameHeight(data: DetectionDataLike | null, details: UpperDetails | undefined): number | undefined {
  const candidates = [
    details?.frameHeight,
    data?.frameHeight,
    data?.imageHeight,
    data?.videoHeight,
    data?.canvasHeight,
    data?.height,
  ]

  for (const candidate of candidates) {
    const numeric = readNumeric(candidate)
    if (numeric !== undefined && numeric > 0) return numeric
  }

  return undefined
}

function resolveHistory(detail: HandDetail | undefined): number[] {
  const history = detail?.history ?? detail?.yHistory ?? detail?.values ?? []
  return history.filter((value): value is number => Number.isFinite(value))
}

function formatValue(value: number | null | undefined, digits = 1, suffix = ''): string {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : `${value.toFixed(digits)}${suffix}`
}

function formatBool(value: boolean | undefined): string {
  if (value === undefined) return '未取得'
  return value ? 'OK' : 'NG'
}

function getAxisHeight(frameHeight: number | undefined): number {
  if (frameHeight !== undefined && Number.isFinite(frameHeight) && frameHeight > 0) return frameHeight
  return 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const CONDITION_DETAILS: Record<ConditionId, ConditionDetail> = {
  rise: {
    title: '十分上昇しているか',
    summary: (
      <>
        ここでいう<strong>開始平均</strong>は、手首の履歴の<strong>最初の3フレーム</strong>の平均、
        <strong>終了平均</strong>は<strong>最後の3フレーム</strong>の平均です。
        1フレームだけの上下ではなく、動き出しと動き終わりの代表値を比べて、手が本当に上へ動いたかを見ています。
      </>
    ),
    code: `# 履歴の先頭3フレームと末尾3フレームの平均値を比較
start_avg = average(history[:3])
end_avg = average(history[-3:])

# 手が上に動くほど y は小さくなるので、差分が大きいほど上昇
dy = start_avg - end_avg
rises_enough = dy >= rise_threshold`,
  },
  start: {
    title: '肩より下から始まるか',
    summary: (
      <>
        動作の開始時点で、手が<strong>肩より下</strong>にあるかを確認します。
        すでに手が高い位置にある場合は、アッパーではない別の動作と区別しやすくなります。
      </>
    ),
    code: `# 開始位置が肩より下かを確認
starts_below_shoulder = start_avg > shoulder_y`,
  },
  reach: {
    title: '肩の高さまで到達するか',
    summary: (
      <>
        終了時点で、手が<strong>肩の高さまで近づいているか / 超えているか</strong>を確認します。
        これにより、途中までしか上がっていない動作を除外します。
      </>
    ),
    code: `# 終了位置が肩の高さまで届いているかを確認
ends_near_or_above_shoulder = end_avg <= shoulder_y + shoulder_reach_margin`,
  },
  between: {
    title: '肩の間を通るか',
    summary: (
      <>
        手が<strong>左右の肩の間</strong>を通っているかを確認します。
        体の正面で上がっているかを見るための条件で、横に流れた動作を除外するのに使います。
      </>
    ),
    code: `# 左右の肩の間を通るかを確認
between_shoulders = left_shoulder_x <= hand_x <= right_shoulder_x`,
  },
}

function MiniChart({
  series,
  references,
  frameHeight,
}: {
  series: ChartSeries[]
  references: ReferenceLine[]
  frameHeight?: number
}) {
  const width = 760
  const height = 300
  const padX = 34
  const padY = 12
  const chartWidth = width - padX * 2
  const chartHeight = height - padY * 2
  const axisHeight = getAxisHeight(frameHeight)
  const range = Math.max(axisHeight, 0.0001)

  const yFor = (value: number): number => padY + (clamp(value, 0, axisHeight) / range) * chartHeight
  const xFor = (index: number, count: number): number =>
    padX + (count <= 1 ? chartWidth / 2 : (chartWidth * index) / (count - 1))
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="upper-chartCard">
      <div className="upper-chartCard__head">
        <div>
          <div className="upper-chartCard__title">過去10フレームの高さ変化</div>
        </div>
      </div>

      <div className="upper-chartCard__body">
        {series.some((item) => item.values.length > 0) ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="upper-chart" aria-label="過去10フレームの高さ変化" role="img">
            <rect x="0" y="0" width={width} height={height} rx="18" className="upper-chart__bg" />

            {ticks.map((tick) => {
              const y = padY + chartHeight * tick
              const labelValue = axisHeight * tick
              return (
                <g key={tick}>
                  <line x1={padX} y1={y} x2={width - padX} y2={y} className="upper-chart__grid" />
                  <text x={10} y={y + 4} className="upper-chart__axisLabel">
                    {frameHeight ? `${Math.round(labelValue)}px` : labelValue.toFixed(1)}
                  </text>
                </g>
              )
            })}

            {references.map((ref) => {
              const y = yFor(ref.value)
              return (
                <g key={ref.label}>
                  <line x1={padX} y1={y} x2={width - padX} y2={y} className={`upper-chart__refLine ${ref.className}`} />
                  <text x={width - padX - 6} y={y - 6} className={`upper-chart__refLabel ${ref.className}`}>
                    {ref.label}
                  </text>
                </g>
              )
            })}

            {series.map((item, seriesIndex) => {
              const count = item.values.length
              const points = item.values.map((value, index) => `${xFor(index, count)},${yFor(value)}`).join(' ')
              return (
                <g key={item.label}>
                  <polyline points={points} className={`upper-chart__line ${item.className}`} />
                  {item.values.map((value, index) => (
                    <circle
                      key={`${item.label}-${index}`}
                      cx={xFor(index, count)}
                      cy={yFor(value)}
                      r={seriesIndex === 0 ? 4.2 : 3.8}
                      className={`upper-chart__dot ${item.className}`}
                    />
                  ))}
                </g>
              )
            })}

            {series.map((item) => {
              const first = item.values[0]
              const last = item.values[item.values.length - 1]
              if (first === undefined || last === undefined) return null

              const startY = yFor(first)
              const endY = yFor(last)
              const startX = xFor(0, item.values.length)
              const endX = xFor(item.values.length - 1, item.values.length)

              return (
                <g key={`${item.label}-span`}>
                  <line x1={startX} y1={startY} x2={endX} y2={endY} className={`upper-chart__span ${item.className}`} />
                  <text x={endX + 8} y={endY - 6} className={`upper-chart__tag ${item.className}`}>
                    {item.label}
                  </text>
                </g>
              )
            })}
          </svg>
        ) : (
          <div className="upper-chart__empty">
            <div className="upper-chart__emptyTitle">10フレーム分の履歴が入ると、ここに変化が出ます</div>
            <div className="upper-chart__emptyText">バックエンドから履歴が届くと、左手・右手の変化をそのまま表示します。</div>
          </div>
        )}
      </div>
    </div>
  )
}

function ConditionCard({
  title,
  status,
  children,
  onSelect,
}: {
  title: string
  status: string
  children: ReactNode
  onSelect: () => void
}) {
  const isOk = status === 'OK'

  return (
    <article className={`upper-condition ${isOk ? 'is-ok' : 'is-ng'}`}>
      <div className="upper-condition__head">
        <div className="upper-condition__title">{title}</div>
        <div className={`upper-miniPill ${isOk ? 'is-ok' : 'is-ng'}`}>{status}</div>
      </div>
      <div className="upper-condition__body">{children}</div>
      <button type="button" className="upper-condition__more" onClick={onSelect}>
        詳しく見る
      </button>
    </article>
  )
}

function pickHand(details: UpperDetails | undefined, side: 'left' | 'right'): HandDetail | undefined {
  if (!details) return undefined
  return side === 'left' ? details.left ?? details.leftHand : details.right ?? details.rightHand
}

function formatHeadlineValue(value: number | undefined, digits = 1, frameHeight?: number): string {
  return formatValue(value, digits, frameHeight ? 'px' : '')
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
      className="upper-detail"
      aria-label={`${detail.title}の詳細`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="upper-detail__heading">
        <div>
          <h2>{detail.title}</h2>
        </div>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>

      <div className="upper-detail__single">
        <p className="upper-detail__summary">{detail.summary}</p>
        <pre className="upper-code-example">
          <code>{detail.code}</code>
        </pre>
      </div>
    </section>
  )
}

export function UpperExplanation({ detectionData }: ExplanationProps) {
  const data = detectionData as DetectionDataLike | null
  const details = data?.actionDetails?.upper ?? data?.upper ?? data?.action?.upper

  const frameHeight = resolveFrameHeight(data, details)
  const left = pickHand(details, 'left')
  const right = pickHand(details, 'right')

  const leftHistory = resolveHistory(left)
  const rightHistory = resolveHistory(right)

  const leftRisesEnough = details?.leftRisesEnough ?? left?.risesEnough ?? left?.passedDy
  const rightRisesEnough = details?.rightRisesEnough ?? right?.risesEnough ?? right?.passedDy

  const leftStartsBelowShoulder = details?.leftStartsBelowShoulder ?? left?.startsBelowShoulder
  const rightStartsBelowShoulder = details?.rightStartsBelowShoulder ?? right?.startsBelowShoulder

  const leftEndsNearOrAboveShoulder =
    details?.leftEndsNearOrAboveShoulder ?? left?.endsNearOrAboveShoulder ?? left?.aboveShoulder
  const rightEndsNearOrAboveShoulder =
    details?.rightEndsNearOrAboveShoulder ?? right?.endsNearOrAboveShoulder ?? right?.aboveShoulder

  const leftBetweenShoulders = details?.leftBetweenShoulders ?? left?.betweenShoulders
  const rightBetweenShoulders = details?.rightBetweenShoulders ?? right?.betweenShoulders

  const overallOk = details?.result ?? details?.isOk ?? details?.ok ?? false

  const references: ReferenceLine[] = [
    ...(left?.shoulderY !== undefined ? [{ label: '左肩', value: left.shoulderY, className: 'is-leftShoulder' }] : []),
    ...(right?.shoulderY !== undefined ? [{ label: '右肩', value: right.shoulderY, className: 'is-rightShoulder' }] : []),
  ]

  const [selectedCondition, setSelectedCondition] = useState<ConditionId | null>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)

  if (!details) {
    return (
      <section className="upperPanel">
        <div className="upper-emptyState">
          <h3>アッパーの説明</h3>
          <p>バックエンドから判定データが届くと、ここにアルゴリズムの説明を表示します。</p>
        </div>
      </section>
    )
  }

  return (
    <section className="upperPanel" aria-label="アッパーの判定過程">
      <p className="crossarms-intro">
        アッパーは体の正面で手を振り上げる動作です。肩の高さより下から上へ手が移動し、左右の肩の間を通っているかを判定することで、体の正面で行われているかを確認しています。腕を振り上げる閾値は肩幅の0.5倍の距離を採用しています。
      </p>

      <div className={`crossarms-hero ${overallOk ? 'crossarms-hero--ok' : 'crossarms-hero--ng'}`}>
        <div className="crossarms-hero__icon">{overallOk ? '✓' : '!'}</div>
        <div className="crossarms-hero__content">
          <h3>判定：{overallOk ? 'OK' : 'NG'}</h3>
          <p>
            まずは履歴の最初3フレームと最後3フレームを比べて、手が本当に上へ動いたかを見ます。
            そのうえで、肩より下から始まり、肩の高さまで上がり、肩の間を通るかを確認します。
          </p>
        </div>
      </div>

      <div className="upperConditions">
        <ConditionCard
          title="条件1：十分上昇している"
          status={formatBool((leftRisesEnough === true) || (rightRisesEnough === true))}
          onSelect={() => setSelectedCondition('rise')}
        >
          <div className="upperConditionItem__name">開始平均と終了平均の差分</div>
          <div className="upperConditionItem__value">
            開始平均は履歴の<strong>最初の3フレーム</strong>、終了平均は<strong>最後の3フレーム</strong>です。
            <br />
            左 {formatHeadlineValue(left?.startAvg, 1, frameHeight)} → {formatHeadlineValue(left?.endAvg, 1, frameHeight)}
            <br />
            右 {formatHeadlineValue(right?.startAvg, 1, frameHeight)} → {formatHeadlineValue(right?.endAvg, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftRisesEnough === true) || (rightRisesEnough === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftRisesEnough === true) || (rightRisesEnough === true))}
          </div>
        </ConditionCard>

        <ConditionCard
          title="条件2：肩より下から始まる"
          status={formatBool((leftStartsBelowShoulder === true) || (rightStartsBelowShoulder === true))}
          onSelect={() => setSelectedCondition('start')}
        >
          <div className="upperConditionItem__name">開始位置と肩の高さ</div>
          <div className="upperConditionItem__value">
            動作の最初に、手首が肩より下にあるかを見ます。
            <br />
            左 {formatHeadlineValue(left?.startAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(left?.shoulderY, 1, frameHeight)}
            <br />
            右 {formatHeadlineValue(right?.startAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(right?.shoulderY, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftStartsBelowShoulder === true) || (rightStartsBelowShoulder === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftStartsBelowShoulder === true) || (rightStartsBelowShoulder === true))}
          </div>
        </ConditionCard>

        <ConditionCard
          title="条件3：肩の高さまで到達"
          status={formatBool((leftEndsNearOrAboveShoulder === true) || (rightEndsNearOrAboveShoulder === true))}
          onSelect={() => setSelectedCondition('reach')}
        >
          <div className="upperConditionItem__name">終了位置が肩の高さ以上</div>
          <div className="upperConditionItem__value">
            終了平均は履歴の<strong>最後の3フレーム</strong>です。
            <br />
            左 {formatHeadlineValue(left?.endAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(left?.shoulderY, 1, frameHeight)}
            <br />
            右 {formatHeadlineValue(right?.endAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(right?.shoulderY, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftEndsNearOrAboveShoulder === true) || (rightEndsNearOrAboveShoulder === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftEndsNearOrAboveShoulder === true) || (rightEndsNearOrAboveShoulder === true))}
          </div>
        </ConditionCard>

        <ConditionCard
          title="条件4：肩の間を通る"
          status={formatBool((leftBetweenShoulders === true) || (rightBetweenShoulders === true))}
          onSelect={() => setSelectedCondition('between')}
        >
          <div className="upperConditionItem__name">肩の間の通過判定</div>
          <div className="upperConditionItem__value">
            左 {formatBool(leftBetweenShoulders)} / 右 {formatBool(rightBetweenShoulders)}
            <br />
            肩幅 {formatHeadlineValue(details.shoulderWidth, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftBetweenShoulders === true) || (rightBetweenShoulders === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftBetweenShoulders === true) || (rightBetweenShoulders === true))}
          </div>
        </ConditionCard>
      </div>

      <MiniChart
        frameHeight={frameHeight}
        references={references}
        series={[
          { label: '左手', values: leftHistory, className: 'is-left' },
          { label: '右手', values: rightHistory, className: 'is-right' },
        ]}
      />

      <div className="upper-section-header">
        <h4 className="upper-conditions-title">判定の条件</h4>
        <button
          type="button"
          className="upper-overview-toggle"
          onClick={() => setIsOverviewOpen(true)}
        >
          判定のアルゴリズム全体像
        </button>
      </div>

      {isOverviewOpen && (
        <div
          className="upper-detail-overlay"
          role="dialog"
          aria-label="アッパー判定の全体像"
          onClick={() => setIsOverviewOpen(false)}
        >
          <section
            className="upper-detail upper-overview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="upper-detail__heading">
              <div>
                <h2>💡 アッパーを判定する仕組みの全体像</h2>
              </div>
              <button type="button" onClick={() => setIsOverviewOpen(false)}>
                閉じる
              </button>
            </div>

            <div className="upper-overview-layout">
              <div className="upper-overview-main">
                <p className="upper-overview-text">
                  アッパーは、<strong>体の正面で手を下から上へ振り上げる動作</strong>です。単に手が上がるだけではなく、
                  <strong>開始位置・上昇量・到達位置・通過位置</strong>を順番に確認して判定します。
                </p>
                <p className="upper-overview-text">
                  ここでいう<strong>開始平均</strong>は履歴の最初の3フレーム、<strong>終了平均</strong>は最後の3フレームの平均です。
                  1フレームだけだとブレやすいので、数フレームをまとめて平均し、動き出しと動き終わりの代表値を作っています。
                </p>
                <p className="upper-overview-text">
                  つまり、開始平均は「振り上げる前の高さの代表」、終了平均は「振り上げ終わったあとの高さの代表」です。
                  この2つを比べて、手が本当に上へ動いたかを見ます。
                </p>

                <div className="upper-overview-steps">
                  <div className="upper-overview-step">
                    <span className="upper-step-badge">1</span>
                    <div className="upper-step-content">
                      <strong className="upper-step-title">十分に上がっているか</strong>
                      <p className="upper-step-desc">
                        開始平均との差と終了平均との差を比べ、しきい値以上の上昇があるかを見ます。
                      </p>
                    </div>
                  </div>

                  <div className="upper-overview-step">
                    <span className="upper-step-badge">2</span>
                    <div className="upper-step-content">
                      <strong className="upper-step-title">最初は肩より下か</strong>
                      <p className="upper-step-desc">
                        すでに高い位置から始まっていると、アッパーではない別動作の可能性があります。
                      </p>
                    </div>
                  </div>

                  <div className="upper-overview-step">
                    <span className="upper-step-badge">3</span>
                    <div className="upper-step-content">
                      <strong className="upper-step-title">肩の高さまで届くか</strong>
                      <p className="upper-step-desc">
                        終了時に肩の高さに届いているかを見て、途中で止まった動作を除外します。
                      </p>
                    </div>
                  </div>

                  <div className="upper-overview-step">
                    <span className="upper-step-badge">4</span>
                    <div className="upper-step-content">
                      <strong className="upper-step-title">肩の間を通るか</strong>
                      <p className="upper-step-desc">
                        体の横に流れた動作ではなく、正面を通る上昇になっているかを確認します。
                      </p>
                    </div>
                  </div>
                </div>

                <p className="upper-overview-summary">
                  ひとつの条件だけでは誤検知しやすいため、<strong>4つの条件を組み合わせてアッパーを判定</strong>しています。
                  この組み合わせにより、ただ手を上げただけの姿勢と、前に出て振り上げた動作を区別しやすくしています。
                </p>
              </div>

              <aside className="upper-overview-aside">
                <div className="upper-math-card">
                  <h4 className="upper-math-title">📐 判定の考え方</h4>
                  <p className="upper-math-intro">
                    アッパーの判定は、手の高さの変化を数値で見るシンプルなルールです。特に、<strong>開始平均</strong> と <strong>終了平均</strong> の差が重要です。
                  </p>

                  <div className="upper-math-step">
                    <h5>① 履歴の平均を取る</h5>
                    <p>直近のフレームの高さをまとめて、開始側と終了側の平均値を出します。</p>
                  </div>

                  <div className="upper-math-step">
                    <h5>② 上昇量を比較する</h5>
                    <p>開始平均との差がしきい値を超えていれば、「十分に上がった」とみなします。</p>
                    <div className="upper-math-formula">
                      <code>dy = start_avg - end_avg</code>
                    </div>
                  </div>

                  <div className="upper-math-step">
                    <h5>③ 肩の基準と比べる</h5>
                    <p>肩より下から始まり、肩の高さまで届き、さらに肩の間を通るかを順番に確認します。</p>
                  </div>

                  <p className="upper-math-footer">
                    この流れをフレームごとに繰り返すことで、リアルタイムにアッパー動作を見分けています。
                  </p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      {selectedCondition !== null ? (
        <div
          className="upper-detail-overlay"
          role="dialog"
          aria-label="アッパー判定の詳細"
          onClick={() => setSelectedCondition(null)}
        >
          <ConditionDetailPanel condition={selectedCondition} onClose={() => setSelectedCondition(null)} />
        </div>
      ) : null}
    </section>
  )
}

export default UpperExplanation