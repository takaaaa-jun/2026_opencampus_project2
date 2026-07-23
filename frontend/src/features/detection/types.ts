export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type HandLandmarks = Landmark[];
export type PoseLandmarks = Landmark[];

export type DetectionAction = {
  active: boolean;
  triggered: boolean;
  confidence?: number;
  metrics?: Record<string, number | null>;
};

export type DetectionData = {
  schemaVersion: number;
  source: 'backend' | 'local';
  frame: {
    id: number;
    capturedAtMs?: number;
    receivedAtMs?: number;
    processedAtMs: number;
    width: number;
    height: number;
    mirrored: boolean;
  };
  pose: {
    landmarks: PoseLandmarks;
  } | null;
  hands: Array<{
    handedness?: string;
    landmarks: HandLandmarks;
  }>;
  actions: Record<string, DetectionAction>;
};
