import type { DetectionData } from '../../../features/detection/types';

type Props = {
  latestDetection: DetectionData | null;
};

export const Clap = ({ latestDetection }: Props) => {
  const clap = latestDetection?.actions.clap;
  const distance = clap?.metrics?.middleFingertipDistance;
  const threshold = clap?.metrics?.threshold;

  return (
    <div className="explanation-card__body clap-details">
      <p className="explanation-card__lead">
        両手の中指先端の距離を見て、近づいた瞬間だけ拍手として反応します。
      </p>
      <ul className="feature-list">
        <li>カメラ映像の上に骨格を重ねて、AI がどこを見ているかを見せます。</li>
        <li>下のバーは、今の距離がしきい値に対してどれくらい近いかを示します。</li>
        <li>しきい値をまたいだ瞬間だけ、拍手として発火します。</li>
      </ul>

      <div className="mini-metrics clap-details__metrics">
        <div>
          <span>現在の判定</span>
          <strong>{clap?.active ? 'CLAP' : 'OPEN'}</strong>
        </div>
        <div>
          <span>発火</span>
          <strong>{clap?.triggered ? 'YES' : 'NO'}</strong>
        </div>
        <div>
          <span>距離</span>
          <strong>{distance == null ? '—' : `${distance.toFixed(1)} px`}</strong>
        </div>
        <div>
          <span>しきい値</span>
          <strong>{threshold == null ? '—' : `${threshold.toFixed(1)} px`}</strong>
        </div>
      </div>
    </div>
  );
};
