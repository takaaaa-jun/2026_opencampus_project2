import type { DetectionData } from '../../features/detection/types';
import type { MotionKey } from './MotionTabs';
import { Clap } from './details/Clap';
import { PlaceholderDetails } from './details/PlaceholderDetails';

type Props = {
  motion: MotionKey;
  latestDetection: DetectionData | null;
};

export const ExplanationDetails = ({ motion, latestDetection }: Props) => {
  switch (motion) {
    case 'clap':
      return <Clap latestDetection={latestDetection} />;
    case 'next':
      return <PlaceholderDetails title="次の動き" />;
    case 'extra':
      return <PlaceholderDetails title="さらに追加" />;
    default:
      return null;
  }
};
