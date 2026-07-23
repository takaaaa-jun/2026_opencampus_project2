import type { DetectionData, Landmark } from './types';

export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [12, 14], [13, 15], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

export const CLAP_THRESHOLD_PX = 90;

export const distancePx = (p1: Landmark, p2: Landmark, width: number, height: number) =>
  Math.hypot(p1.x * width - p2.x * width, p1.y * height - p2.y * height);

export const normalisedToPixel = (landmark: Landmark, width: number, height: number, mirrored = false) => ({
  x: mirrored ? width - landmark.x * width : landmark.x * width,
  y: landmark.y * height,
});

const drawConnections = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  connections: Array<[number, number]>,
  width: number,
  height: number,
  color: string,
  mirrored: boolean,
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [startIndex, endIndex] of connections) {
    const start = landmarks[startIndex];
    const end = landmarks[endIndex];
    if (!start || !end) continue;
    const startPx = normalisedToPixel(start, width, height, mirrored);
    const endPx = normalisedToPixel(end, width, height, mirrored);
    ctx.beginPath();
    ctx.moveTo(startPx.x, startPx.y);
    ctx.lineTo(endPx.x, endPx.y);
    ctx.stroke();
  }
};

const drawLandmarks = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  color: string,
  mirrored: boolean,
) => {
  ctx.fillStyle = color;
  for (const landmark of landmarks) {
    const point = normalisedToPixel(landmark, width, height, mirrored);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const drawDetectionFrame = (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detection: DetectionData | null,
) => {
  const width = video.videoWidth || detection?.frame.width || canvas.width || 1280;
  const height = video.videoHeight || detection?.frame.height || canvas.height || 720;
  if (width <= 0 || height <= 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.drawImage(video, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  if (!detection) return;

  if (detection.actions.clap?.triggered) {
    ctx.save();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const pose = detection.pose?.landmarks ?? [];
  if (pose.length) {
    ctx.save();
    drawConnections(ctx, pose, POSE_CONNECTIONS, width, height, 'rgba(6, 182, 212, 0.92)', true);
    drawLandmarks(ctx, pose, width, height, 'rgba(125, 211, 252, 0.96)', true);
    ctx.restore();
  }

  detection.hands.forEach((hand, index) => {
    const landmarks = hand.landmarks;
    if (!landmarks.length) return;
    const color = index === 0 ? 'rgba(167, 139, 250, 0.95)' : 'rgba(251, 191, 36, 0.95)';
    ctx.save();
    drawConnections(ctx, landmarks, HAND_CONNECTIONS, width, height, color, true);
    drawLandmarks(ctx, landmarks, width, height, color, true);
    ctx.restore();
  });

  if (detection.hands.length >= 2) {
    const first = detection.hands[0].landmarks[12];
    const second = detection.hands[1].landmarks[12];
    if (first && second) {
      const p1 = normalisedToPixel(first, width, height, true);
      const p2 = normalisedToPixel(second, width, height, true);
      const threshold = detection.actions.clap?.metrics?.threshold ?? CLAP_THRESHOLD_PX;
      const distance = detection.actions.clap?.metrics?.middleFingertipDistance ?? null;
      const ratio = distance == null ? 1 : Math.min(distance / Math.max(threshold, 1), 1);
      const lineColor = ratio < 0.5 ? 'rgba(34, 197, 94, 0.98)' : ratio < 1 ? 'rgba(245, 158, 11, 0.98)' : 'rgba(239, 68, 68, 0.98)';
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 7, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
};
