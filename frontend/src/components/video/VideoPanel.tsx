import type { RefObject } from 'react';
import type { DetectionData } from '../../features/detection/types';
import { CameraVideo } from './CameraVideo';
import { SkeletonVideo } from './SkeletonVideo';

type Props = {
  cameraRef: RefObject<HTMLVideoElement | null>;
  detection: DetectionData | null;
  onStart: () => void;
  onStop: () => void;
  started: boolean;
  statusText: string;
  backendState: string;
  error: string | null;
};

export const VideoPanel = ({
  cameraRef,
  detection,
  onStart,
  onStop,
  started,
  statusText,
  backendState,
  error,
}: Props) => {
  return (
    <section className="panel panel--video">
      <header className="panel__header">
        <div>
          <p className="eyebrow">Live demo</p>
          <h2>カメラ映像と骨格の比較</h2>
          <p className="panel__desc">
            カメラ映像そのままと、骨格を重ねた映像を横に並べて、AI が見ている場所を一目で分かるようにしています。
          </p>
        </div>
        <div className="panel__actions">
          <span className={`status-pill status-pill--${started ? 'live' : 'idle'}`}>{statusText}</span>
          <button type="button" onClick={started ? onStop : onStart} className="primary-button">
            {started ? 'カメラを停止' : 'カメラを開始'}
          </button>
        </div>
      </header>

      <div className="video-grid">
        <CameraVideo ref={cameraRef} mirrored />
        <SkeletonVideo videoRef={cameraRef} detection={detection} />
      </div>

      <div className="panel__footnote">
        <span>Backend: {backendState}</span>
        {error ? <span className="panel__error">{error}</span> : <span>Local fallback ready</span>}
      </div>
    </section>
  );
};
