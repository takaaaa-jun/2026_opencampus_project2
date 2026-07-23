type Props = {
  distance: number | null;
  threshold: number;
  maxDistance: number;
};

export const DistanceBar = ({ distance, threshold, maxDistance }: Props) => {
  const safeMax = Math.max(maxDistance, 1);
  const clamped = distance == null ? 0 : Math.min(distance, safeMax);
  const fillRatio = distance == null ? 0 : 1 - clamped / safeMax;
  const thresholdRatio = Math.min(threshold / safeMax, 1);
  const fillClass =
    distance == null
      ? 'bar-fill bar-fill--empty'
      : distance < threshold
        ? 'bar-fill bar-fill--good'
        : 'bar-fill bar-fill--warn';

  return (
    <div className="distance-bar-shell">
      <div className="distance-bar__title-row">
        <span className="distance-bar__title">中指先端の間隔</span>
        <span className="distance-bar__value">{distance == null ? '-- px' : `${distance.toFixed(1)} px`}</span>
      </div>
      <div className="distance-bar">
        <div className={fillClass} style={{ width: `${Math.max(fillRatio, 0) * 100}%` }} />
        <div className="distance-bar__threshold" style={{ left: `${thresholdRatio * 100}%` }} />
        <div className="distance-bar__knob" style={{ left: `${Math.max(fillRatio, 0) * 100}%` }} />
      </div>
      <div className="distance-bar__legend">
        <span>近い</span>
        <span>しきい値</span>
        <span>遠い</span>
      </div>
    </div>
  );
};
