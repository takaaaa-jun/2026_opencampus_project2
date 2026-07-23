import type { DetectionData, DetectionAction, HandLandmarks, Landmark, PoseLandmarks } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toLandmark = (value: unknown): Landmark | null => {
  if (!isRecord(value)) return null;
  if (!isNumber(value.x) || !isNumber(value.y)) return null;
  return {
    x: value.x,
    y: value.y,
    z: isNumber(value.z) ? value.z : undefined,
    visibility: isNumber(value.visibility) ? value.visibility : undefined,
  };
};

const toLandmarks = (value: unknown): Landmark[] => {
  if (!Array.isArray(value)) return [];
  return value.map(toLandmark).filter((item): item is Landmark => item !== null);
};

const normalizeAction = (value: unknown): DetectionAction | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    active: Boolean(value.active),
    triggered: Boolean(value.triggered),
    confidence: isNumber(value.confidence) ? value.confidence : undefined,
    metrics: isRecord(value.metrics)
      ? Object.fromEntries(
          Object.entries(value.metrics).map(([key, metricValue]) => [
            key,
            isNumber(metricValue) ? metricValue : null,
          ]),
        )
      : undefined,
  };
};

const normalizeActions = (value: unknown): Record<string, DetectionAction> => {
  if (!isRecord(value)) return {};
  const normalized: Record<string, DetectionAction> = {};

  for (const [key, actionValue] of Object.entries(value)) {
    const action = normalizeAction(actionValue);
    if (action) normalized[key] = action;
  }

  return normalized;
};

const firstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (isNumber(value)) return value;
  }
  return undefined;
};

const normalizeHands = (value: unknown): DetectionData['hands'] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const landmarks = toLandmarks(
        entry.landmarks ?? entry.landmark_list ?? entry.handLandmarks ?? entry.hand_landmarks,
      ) as HandLandmarks;
      if (!landmarks.length) return null;
      return {
        handedness: typeof entry.handedness === 'string' ? entry.handedness : undefined,
        landmarks,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

const normalizePose = (value: unknown): DetectionData['pose'] => {
  if (Array.isArray(value)) {
    const landmarks = toLandmarks(value) as PoseLandmarks;
    return landmarks.length ? { landmarks } : null;
  }

  if (!isRecord(value)) return null;
  const landmarks = toLandmarks(value.landmarks ?? value.poseLandmarks ?? value.pose_landmarks) as PoseLandmarks;
  return landmarks.length ? { landmarks } : null;
};

export const parseDetectionMessage = (raw: string): DetectionData | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;

    const frameValue = isRecord(value.frame) ? value.frame : {};
    const frameId = firstNumber(value.frameId, frameValue.id, value.timestampMs, value.frameTimestampMs) ?? Date.now();
    const processedAtMs = firstNumber(frameValue.processedAtMs, value.processedAtMs, value.receivedAtMs) ?? Date.now();
    const width = firstNumber(frameValue.width, value.width) ?? 1280;
    const height = firstNumber(frameValue.height, value.height) ?? 720;
    const mirrored = typeof frameValue.mirrored === 'boolean' ? frameValue.mirrored : true;

    const detection: DetectionData = {
      schemaVersion: 1,
      source: 'backend',
      frame: {
        id: frameId,
        capturedAtMs: firstNumber(frameValue.capturedAtMs, value.capturedAtMs),
        receivedAtMs: firstNumber(frameValue.receivedAtMs, value.receivedAtMs),
        processedAtMs,
        width,
        height,
        mirrored,
      },
      pose: normalizePose(value.pose ?? value.poseLandmarks ?? value.pose_landmarks),
      hands: normalizeHands(
        value.hands ?? value.handLandmarks ?? value.hand_landmarks ?? value.landmarks,
      ),
      actions: normalizeActions(value.actions ?? value.actionDetails ?? value.detectedActions),
    };

    return detection;
  } catch {
    return null;
  }
};
