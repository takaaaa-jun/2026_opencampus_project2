import type { MotionKey } from './MotionTabs';
import { ClapExplanation } from './explanations/ClapExplanation';
import { PlaceholderExplanation } from './explanations/PlaceholderExplanation';

type Props = {
  motion: MotionKey;
};

export const ExplanationDetails = ({ motion }: Props) => {
  switch (motion) {
    case 'clap':
      return <ClapExplanation />;
    case 'next':
      return <PlaceholderExplanation title="次の動き" />;
    case 'extra':
      return <PlaceholderExplanation title="さらに追加" />;
    default:
      return null;
  }
};
