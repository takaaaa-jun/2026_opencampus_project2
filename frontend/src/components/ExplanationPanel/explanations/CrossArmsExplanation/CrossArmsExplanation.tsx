import type { CSSProperties } from 'react'
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

type DirectionDiagramProps = {
  title: string
  angle: number
  role: Role
  roleOk: boolean
  angleToleranceDeg: number
}

function DirectionDiagram({
  title,
  angle,
  role,
  roleOk,
  angleToleranceDeg,
}: DirectionDiagramProps) {
  const pointerStyle = {
    '--crossarms-angle': `${angle}deg`,
  } as CSSProperties

  return (
    <article className={`crossarms-circleCard ${roleOk ? 'is-ok' : 'is-ng'}`}>
      <header className="crossarms-circleCard__header">
        <h4>{title}</h4>
        <span className={`crossarms-pill crossarms-pill--${role}`}>
          {role === 'horizontal' ? '横役' : '縦役'}
        </span>
      </header>

      <div
        className={`crossarms-directionArea crossarms-directionArea--${role}`}
        style={pointerStyle}
        role="img"
        aria-label={`${title}の角度 ${angle}度、${role === 'horizontal' ? '横役' : '縦役'}`}
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

export function CrossArmsExplanation({ detectionData }: ExplanationProps) {
  const data = detectionData as DetectionDataWithCrossArms | null
  const details = data?.actionDetails?.closs

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

  return (
    <section className="crossarms crossarms--compact">
      <p className="crossarms-intro">
        ウルトラマンのポーズは、腕を十字にする動作です。各腕の角度を確認し、それぞれが横向き・縦向きの閾値（±{details.angleToleranceDeg}°）内に収まっているか、さらに左右の腕の距離が十分近いかを調べることで判定しています。
      </p>
      <div className={`crossarms-hero ${details.result ? 'crossarms-hero--ok' : 'crossarms-hero--ng'}`}>
        <div className="crossarms-hero__icon">{details.result ? '✓' : '!'}</div>
        <div className="crossarms-hero__content">
          <h3>判定：{details.result ? 'OK' : 'NG'}</h3>
          <p>
            {details.activePattern === 'left-horizontal'
              ? '左腕が横役・右腕が縦役'
              : '左腕が縦役・右腕が横役'}
          </p>
        </div>
      </div>

      <div className="crossarms-grid">
        <DirectionDiagram
          title="左腕"
          angle={details.displayLeftAngle}
          role={details.leftRole}
          roleOk={details.leftRoleOk}
          angleToleranceDeg={details.angleToleranceDeg}
        />
        <DirectionDiagram
          title="右腕"
          angle={details.displayRightAngle}
          role={details.rightRole}
          roleOk={details.rightRoleOk}
          angleToleranceDeg={details.angleToleranceDeg}
        />
      </div>

      <div className="crossarms-metrics">
        <article className="crossarms-metricCard">
          <div className="crossarms-metricCard__title">左右の役割</div>
          <div className="crossarms-roleList">
            <span className={`crossarms-roleChip ${details.leftRoleOk ? 'is-ok' : 'is-ng'}`}>
              左腕：{details.leftRole === 'horizontal' ? '横役' : '縦役'}
            </span>
            <span className={`crossarms-roleChip ${details.rightRoleOk ? 'is-ok' : 'is-ng'}`}>
              右腕：{details.rightRole === 'horizontal' ? '横役' : '縦役'}
            </span>
          </div>
        </article>

        <article className="crossarms-metricCard">
          <div className="crossarms-metricCard__title">前腕どうしの距離</div>
          <div className="crossarms-distanceHeader">
            <strong>{details.forearmDistance}</strong>
            <span>しきい値：{details.distanceThreshold} 以下</span>
          </div>
          <meter
            className={`crossarms-meter ${details.distanceOk ? 'is-ok' : 'is-ng'}`}
            min={0}
            max={details.distanceThreshold}
            value={details.forearmDistance}
          >
            {details.forearmDistance}
          </meter>
          <div className={`crossarms-condition ${details.distanceOk ? 'is-ok' : 'is-ng'}`}>
            {details.distanceOk ? '距離条件OK' : '距離条件NG'}
          </div>
        </article>
      </div>
    </section>
  )
}