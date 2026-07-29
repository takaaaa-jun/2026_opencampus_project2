import type { ReactNode } from 'react'

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

function MiniChart({
  title,
  series,
  references,
  frameHeight,
}: {
  title: string
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
  const xFor = (index: number, count: number): number => padX + (count <= 1 ? chartWidth / 2 : (chartWidth * index) / (count - 1))
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
}: {
  title: string
  status: string
  children: ReactNode
}) {
  const isOk = status === 'OK'
  return (
    <div className={`upper-condition ${isOk ? 'is-ok' : 'is-ng'}`}>
      <div className="upper-condition__head">
        <div className="upper-condition__title">{title}</div>
        <div className={`upper-miniPill ${isOk ? 'is-ok' : 'is-ng'}`}>{status}</div>
      </div>
      <div className="upper-condition__body">{children}</div>
    </div>
  )
}

function formatHeadlineValue(value: number | undefined, digits = 1, frameHeight?: number): string {
  return formatValue(value, digits, frameHeight ? 'px' : '')
}

function pickHand(details: UpperDetails | undefined, side: 'left' | 'right'): HandDetail | undefined {
  if (!details) return undefined
  return side === 'left' ? details.left ?? details.leftHand : details.right ?? details.rightHand
}

export function UpperExplanation({ detectionData }: ExplanationProps) {
  const data = detectionData as DetectionDataLike | null
  const details = data?.actionDetails?.upper ?? data?.upper ?? data?.action?.upper

  const frameHeight = resolveFrameHeight(data, details)
  const left = pickHand(details, 'left')
  const right = pickHand(details, 'right')

  const leftHistory = resolveHistory(left)
  const rightHistory = resolveHistory(right)

  const leftResult = details?.leftRisesEnough ?? left?.risesEnough ?? left?.passedDy
  const rightResult = details?.rightRisesEnough ?? right?.risesEnough ?? right?.passedDy

  const leftStartBelow = details?.leftStartsBelowShoulder ?? left?.startsBelowShoulder
  const rightStartBelow = details?.rightStartsBelowShoulder ?? right?.startsBelowShoulder

  const leftEndOk = details?.leftEndsNearOrAboveShoulder ?? left?.endsNearOrAboveShoulder ?? left?.aboveShoulder
  const rightEndOk = details?.rightEndsNearOrAboveShoulder ?? right?.endsNearOrAboveShoulder ?? right?.aboveShoulder

  const leftBetween = details?.leftBetweenShoulders ?? left?.betweenShoulders
  const rightBetween = details?.rightBetweenShoulders ?? right?.betweenShoulders

  const overallOk = details?.result ?? details?.isOk ?? details?.ok ?? false

  const references: ReferenceLine[] = [
    ...(left?.shoulderY !== undefined ? [{ label: '左肩', value: left.shoulderY, className: 'is-leftShoulder' }] : []),
    ...(right?.shoulderY !== undefined ? [{ label: '右肩', value: right.shoulderY, className: 'is-rightShoulder' }] : []),
  ]

  return (
    <section className="upperPanel">
      <header className="upperIntro">
        <div className={`crossarms-hero ${overallOk ? 'crossarms-hero--ok' : 'crossarms-hero--ng'}`}>
          <div className="crossarms-hero__icon">{overallOk ? '✓' : '!'}</div>
          <div className="crossarms-hero__content">
            <h3>判定：{overallOk ? 'OK' : 'NG'}</h3>
          </div>
        </div>
      </header>

      <div className="upperConditions" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <ConditionCard title="条件1：十分上昇している" status={formatBool((leftResult === true) || (rightResult === true))}>
          <div className="upperConditionItem__name">開始 → 終了 の差分</div>
          <div className="upperConditionItem__value">
            左 {formatHeadlineValue(left?.startAvg, 1, frameHeight)} → {formatHeadlineValue(left?.endAvg, 1, frameHeight)}
            <br />
            右 {formatHeadlineValue(right?.startAvg, 1, frameHeight)} → {formatHeadlineValue(right?.endAvg, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftResult === true) || (rightResult === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftResult === true) || (rightResult === true))}
          </div>
        </ConditionCard>

        <ConditionCard title="条件2：肩より下で始まる" status={formatBool((leftStartBelow === true) || (rightStartBelow === true))}>
          <div className="upperConditionItem__name">開始位置と肩の高さ</div>
          <div className="upperConditionItem__value">
            左 {formatHeadlineValue(left?.startAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(left?.shoulderY, 1, frameHeight)}
            <br />
            右 {formatHeadlineValue(right?.startAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(right?.shoulderY, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftStartBelow === true) || (rightStartBelow === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftStartBelow === true) || (rightStartBelow === true))}
          </div>
        </ConditionCard>

        <ConditionCard title="条件3：肩の高さまで到達" status={formatBool((leftEndOk === true) || (rightEndOk === true))}>
          <div className="upperConditionItem__name">終了位置が肩の高さ以上</div>
          <div className="upperConditionItem__value">
            左 {formatHeadlineValue(left?.endAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(left?.shoulderY, 1, frameHeight)}
            <br />
            右 {formatHeadlineValue(right?.endAvg, 1, frameHeight)} / 肩 {formatHeadlineValue(right?.shoulderY, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftEndOk === true) || (rightEndOk === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftEndOk === true) || (rightEndOk === true))}
          </div>
        </ConditionCard>

        <ConditionCard title="条件4：肩の間を通る" status={formatBool((leftBetween === true) || (rightBetween === true))}>
          <div className="upperConditionItem__name">肩の間の通過判定</div>
          <div className="upperConditionItem__value">
            左 {formatBool(leftBetween)} / 右 {formatBool(rightBetween)}
            <br />
            肩幅 {formatHeadlineValue(details?.shoulderWidth, 1, frameHeight)}
          </div>
          <div className={`upperConditionItem__flag ${(leftBetween === true) || (rightBetween === true) ? 'is-ok' : 'is-ng'}`}>
            {formatBool((leftBetween === true) || (rightBetween === true))}
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
    </section>
  )
}

export default UpperExplanation