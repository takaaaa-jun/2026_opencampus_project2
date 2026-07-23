import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { DetectionData, HandLandmarks, Landmark } from '../features/detection/types';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const CLAP_THRESHOLD_PX = 90;

const toLandmarks = (result: HandLandmarkerResult): Array<{ handedness?: string; landmarks: HandLandmarks }> => {
  const handedness = result.handedness ?? [];
  const landmarks = result.landmarks ?? [];

  return landmarks.map((handLandmarks, index) => ({
    handedness: handedness[index]?.[0]?.categoryName ?? undefined,
    landmarks: handLandmarks as HandLandmarks,
  }));
};

const distancePx = (a: Landmark, b: Landmark, width: number, height: number) => {
  const ax = a.x * width;
  const ay = a.y * height;
  const bx = b.x * width;
  const by = b.y * height;
  return Math.hypot(ax - bx, ay - by);
};

const buildDetection = (
  result: HandLandmarkerResult,
  video: HTMLVideoElement,
  lastClappingRef: MutableRefObject<boolean>,
): DetectionData => {
  const hands = toLandmarks(result);
  const frameWidth = video.videoWidth || 1280;
  const frameHeight = video.videoHeight || 720;

  let clapTriggered = false;
  let clapActive = false;
  let middleFingertipDistance: number | null = null;
  const first = hands[0]?.landmarks?.[12];
  const second = hands[1]?.landmarks?.[12];

  if (first && second) {
    middleFingertipDistance = distancePx(first, second, frameWidth, frameHeight);
    clapActive = middleFingertipDistance < CLAP_THRESHOLD_PX;
    clapTriggered = clapActive && !lastClappingRef.current;
    lastClappingRef.current = clapActive;
  } else {
    lastClappingRef.current = false;
  }

  return {
    schemaVersion: 1,
    source: 'local',
    frame: {
      id: Math.round(performance.now()),
      capturedAtMs: Math.round(performance.now()),
      processedAtMs: Date.now(),
      width: frameWidth,
      height: frameHeight,
      mirrored: true,
    },
    pose: null,
    hands,
    actions: {
      clap: {
        active: clapActive,
        triggered: clapTriggered,
        metrics: {
          middleFingertipDistance,
          threshold: CLAP_THRESHOLD_PX,
        },
      },
    },
  };
};

export const useHandLandmarker = (
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) => {
  const [latestDetection, setLatestDetection] = useState<DetectionData | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const lastClappingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);

  useEffect(() => {
    cancelRef.current = false;

    if (!enabled) {
      setLatestDetection(null);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const load = async () => {
      try {
        if (!landmarkerRef.current) {
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);
          landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        const loop = () => {
          if (cancelRef.current) return;
          const video = videoRef.current;
          const landmarker = landmarkerRef.current;

          if (
            video &&
            landmarker &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.currentTime !== lastVideoTimeRef.current
          ) {
            try {
              const result = landmarker.detectForVideo(video, performance.now());
              const detection = buildDetection(result, video, lastClappingRef);
              setLatestDetection(detection);
              lastVideoTimeRef.current = video.currentTime;
            } catch (error) {
              console.error('local hand detection failed', error);
            }
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (error) {
        console.error('failed to load local hand landmarker', error);
      }
    };

    void load();

    return () => {
      cancelRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, videoRef]);

  return latestDetection;
};
