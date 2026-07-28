import type { DetectionData } from '../../types/detection'

export type ExplanationId =
  | 'jump'
  | 'sit'
  | 'tpose'
  | 'surprise'
  | 'kick'
  | 'upper'
  | 'swing'
  | 'closs'
  | 'clap'
  | 'grab'
  | 'kamehameha'
  | 'kamehameha_continue'

export type ExplanationProps = {
  detectionData: DetectionData | null
}

export type ExplanationItem = {
  id: ExplanationId
  label: string
}
