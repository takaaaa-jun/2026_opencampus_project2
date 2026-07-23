import type { RefObject } from 'react';
import type { DetectionData } from '../../features/detection/types';
import { CameraVideo } from './CameraVideo';
import { SkeletonVideo } from './SkeletonVideo';

type Props = {
  cameraRef: RefObject<HTMLVideoElement | null>;
  detection: DetectionData | null;
};

export const VideoPanel = ({ cameraRef, detection }: Props) => {
  return (
    <div className="video-grid">
      <CameraVideo ref={cameraRef} mirrored />
      <SkeletonVideo videoRef={cameraRef} detection={detection} />
    </div>
  );
};
