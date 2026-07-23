import type { MotionKey } from './MotionTabs';
import { MotionTabs } from './MotionTabs';

type Props = {
  motion: MotionKey;
  onChange: (value: MotionKey) => void;
};

export const ExplanationSelector = ({ motion, onChange }: Props) => (
  <div className="explanation-selector">
    <MotionTabs value={motion} onChange={onChange} />
  </div>
);
