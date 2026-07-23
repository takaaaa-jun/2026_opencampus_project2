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
  return (
    <aside className="panel panel--explanation">
      <header className="panel__header panel__header--compact">
        <div>
          <p className="eyebrow">Why it works</p>
          <h2>選択中の項目を解説</h2>
        </div>
      </header>

      <ExplanationSelector motion={motion} onChange={onMotionChange} />
      <ExplanationDetails motion={motion} latestDetection={latestDetection} />
    </aside>
  );
};
