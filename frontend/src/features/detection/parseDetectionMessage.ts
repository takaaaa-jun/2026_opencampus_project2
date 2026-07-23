import type { DetectionMessage } from './types'

export function parseDetectionMessage(raw: unknown): DetectionMessage | null {
  if (typeof raw !== 'string') {
    return null
  }

  try {
    const value = JSON.parse(raw) as Partial<DetectionMessage>
    if (
      value.type !== 'detection' ||
      value.schemaVersion !== 1 ||
      typeof value.frame?.id !== 'number' ||
      typeof value.frame?.processingTimeMs !== 'number' ||
      !Array.isArray(value.hands) ||
      !value.actions
    ) {
      return null
    }
    return value as DetectionMessage
  } catch {
    return null
  }
}
