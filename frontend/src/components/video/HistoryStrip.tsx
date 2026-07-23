interface HistoryStripProps {
  currentDistance: number | null
  isClapActive: boolean
  clapThreshold: number
}

function formatDistance(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '--'
  }
  return `${value.toFixed(3)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function HistoryStrip({ currentDistance, isClapActive, clapThreshold }: HistoryStripProps) {
  // Normalize the bar onto a fixed visual scale so it stays readable.
  // The threshold line moves with the configured clap threshold.
  const maxDistance = Math.max(0.3, clapThreshold * 2.5)
  const currentRatio = currentDistance === null ? 0 : clamp(currentDistance / maxDistance, 0, 1)
  const thresholdRatio = clamp(clapThreshold / maxDistance, 0, 1)

  const currentLabel = currentDistance === null ? '--' : formatDistance(currentDistance)
  const thresholdLabel = formatDistance(clapThreshold)

  return (
    <div className="history-strip history-strip--simple">
      <div className="history-header">
        <div>
          <p className="history-title">中指先端の距離</p>
          <p className="history-subtitle">
            左に行くほど近く、右に行くほど遠い。中指先端どうしの距離を、その場で見える形にしています。
          </p>
        </div>
        <div className="history-values">
          <span>現在 <strong>{currentLabel}</strong></span>
          <span>しきい値 <strong>{thresholdLabel}</strong></span>
          <span>状態 <strong>{isClapActive ? 'CLAP' : 'OPEN'}</strong></span>
        </div>
      </div>

      <div className="distance-meter distance-meter--simple" aria-hidden="true">
        <div className="distance-meter__labels">
          <span>近い</span>
          <span>遠い</span>
        </div>

        <div className="distance-meter__track distance-meter__track--simple">
          <div className="distance-meter__track-fill" style={{ width: `${currentRatio * 100}%` }} />
          <div className="distance-meter__threshold" style={{ left: `${thresholdRatio * 100}%` }}>
            <span className="distance-meter__threshold-line" />
            <span className="distance-meter__threshold-chip">THRESHOLD</span>
          </div>
          <div className="distance-meter__marker" style={{ left: `${currentRatio * 100}%` }}>
            <span className={isClapActive ? 'distance-meter__dot is-active' : 'distance-meter__dot'} />
          </div>
        </div>
      </div>
    </div>
  )
}
