export type ActionId = 'jump' | 'sit' | 'tpose' | 'clap' | 'grab'

export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
  presence?: number
}

export interface PoseDetection {
  landmarks: Landmark[]
}

export interface HandDetection {
  handedness: 'left' | 'right' | 'unknown' | string
  landmarks: Landmark[]
}

export interface ActionState {
  active: boolean
  triggered: boolean
  confidence: number
  metrics: Record<string, unknown>
}

export interface DetectionMessage {
  type: 'detection'
  schemaVersion: 1
  frame: {
    id: number
    receivedAtMs: number
    processedAtMs: number
    processingTimeMs: number
    width: number
    height: number
    mirrored: boolean
  }
  pose: PoseDetection | null
  hands: HandDetection[]
  actions: Record<ActionId, ActionState>
}

export const ACTION_IDS: ActionId[] = ['clap', 'tpose', 'sit', 'jump', 'grab']
