import type { CSSProperties } from 'react';

type Props = {
  distance: number | null;
  threshold: number;
  maxDistance: number;
};

export const DistanceBar = ({ distance, threshold, maxDistance }: Props) => {
  const safeMax = Math.max(maxDistance, 1);
  const safeDistance = distance == null ? 0 : Math.max(0, Math.min(distance, safeMax));
  const ratio = distance == null ? 0 : safeDistance / safeMax;
  const thresholdRatio = Math.max(0, Math.min(threshold / safeMax, 1));
  const fillClass =
    distance == null
      ? 'bar-fill bar-fill--empty'
      : distance < threshold
        ? 'bar-fill bar-fill--good'
        : 'bar-fill bar-fill--warn';

  const trackStyle = {
    '--distance-ratio': `${ratio * 100}%`,
    '--threshold-ratio': `${thresholdRatio * 100}%`,
  } as CSSProperties;

  return (
    <div className="distance-bar-shell">
      <div className="distance-bar__title-row">
        <span className="distance-bar__title">中指先端の間隔</span>
        <span className="distance-bar__value">{distance == null ? '-- px' : `${distance.toFixed(1)} px`}</span>
      </div>

      <div className="distance-bar" style={trackStyle} aria-label="middle fingertip distance bar">
        <div className={fillClass} />
        <div className="distance-bar__thumb" />
        <div className="distance-bar__threshold" />
      </div>

      <div className="distance-bar__legend">
        <span>近い</span>
        <span>しきい値</span>
        <span>遠い</span>
      </div>
    </div>
  );
};
