import type { PoseFrame } from '../pose'

export interface FeatureMetric {
  label: string
  value: number
  max?: number
  unit?: string
}

export interface FeatureResult {
  statusText?: string
  successEffect?: string
  metrics?: FeatureMetric[]
}

export interface ViewerFeature {
  id: string
  name: string
  category: 'highlight' | 'analysis' | 'game'
  description?: string
  
  // 骨格フレームを解析・描画する際に、強調表示させたいランドマーク（関節ID）の配列を返す
  getHighlightIndices?: (frame: PoseFrame) => number[]
  
  // 骨格フレームを受け取り、リアルタイムメーター表示やポーズ判定結果を返す
  processFrame?: (frame: PoseFrame) => FeatureResult
}
