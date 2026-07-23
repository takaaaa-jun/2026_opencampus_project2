import { useEffect, useRef, type RefObject } from 'react';
import { drawDetectionFrame } from '../../features/detection/draw';
import type { DetectionData } from '../../features/detection/types';

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  detection: DetectionData | null;
};

export const SkeletonVideo = ({ videoRef, detection }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectionRef = useRef<DetectionData | null>(detection);

  useEffect(() => {
    detectionRef.current = detection;
  }, [detection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let rafId = 0;

    const tick = () => {
      drawDetectionFrame(canvas, video, detectionRef.current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [videoRef]);

  return (
    <div className="video-frame video-frame--skeleton">
      <div className="video-frame__label">Skeleton</div>
      <canvas ref={canvasRef} />
    </div>
  );
};
