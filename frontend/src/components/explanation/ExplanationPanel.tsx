import type { DetectionData } from '../../features/detection/types';
import type { MotionKey } from './MotionTabs';
import { ExplanationSelector } from './ExplanationSelector';
import { ExplanationDetails } from './ExplanationDetails';

type Props = {
  motion: MotionKey;
  onMotionChange: (value: MotionKey) => void;
  latestDetection: DetectionData | null;
};

export const ExplanationPanel = ({ motion, onMotionChange, latestDetection }: Props) => {
  const clap = latestDetection?.actions.clap;

  return (
    <aside className="panel panel--explanation">
      <header className="panel__header panel__header--compact">
        <div>
          <p className="eyebrow">Why it works</p>
          <h2>選択中の項目を解説</h2>
        </div>
      </header>

      <ExplanationSelector motion={motion} onChange={onMotionChange} />
      <ExplanationDetails motion={motion} />

      <div className="mini-metrics">
        <div>
          <span>現在の判定</span>
          <strong>{clap?.active ? 'CLAP' : 'OPEN'}</strong>
        </div>
        <div>
          <span>発火</span>
          <strong>{clap?.triggered ? 'YES' : 'NO'}</strong>
        </div>
        <div>
          <span>取得元</span>
          <strong>{latestDetection?.source?.toUpperCase() ?? '—'}</strong>
        </div>
        <div>
          <span>距離</span>
          <strong>{clap?.metrics?.middleFingertipDistance ? `${clap.metrics.middleFingertipDistance.toFixed(1)} px` : '—'}</strong>
        </div>
      </div>
    </aside>
  );
};
