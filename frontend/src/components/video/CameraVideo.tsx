import { forwardRef } from 'react';

type Props = {
  mirrored?: boolean;
};

export const CameraVideo = forwardRef<HTMLVideoElement, Props>(function CameraVideo(
  { mirrored = true },
  ref,
) {
  return (
    <div className="video-frame video-frame--camera">
      <div className="video-frame__label">Camera</div>
      <video ref={ref} className={mirrored ? 'mirror' : undefined} autoPlay playsInline muted />
    </div>
  );
});
