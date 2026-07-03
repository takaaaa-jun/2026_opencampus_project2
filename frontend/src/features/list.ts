import type { ViewerFeature } from './types'

// 1. 顔・頭部のハイライト
export const headHighlight: ViewerFeature = {
  id: 'head-highlight',
  name: '👤 顔・頭部 (鼻/目/耳)',
  category: 'highlight',
  description: '頭部（鼻、目、耳、口角など 0〜10番の骨格点）をハイライトします。',
  getHighlightIndices: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

// 2. 左腕のハイライト
export const leftArmHighlight: ViewerFeature = {
  id: 'left-arm-highlight',
  name: '💪 左手・左腕 (肩/肘/手首)',
  category: 'highlight',
  description: '左側の腕（肩11番、肘13番、手首15番）をハイライトします。',
  getHighlightIndices: () => [11, 13, 15],
}

// 3. 右腕のハイライト
export const rightArmHighlight: ViewerFeature = {
  id: 'right-arm-highlight',
  name: '💪 右手・右腕 (肩/肘/手首)',
  category: 'highlight',
  description: '右側の腕（肩12番、肘14番、手首16番）をハイライトします。',
  getHighlightIndices: () => [12, 14, 16],
}

// 4. 下半身・両脚のハイライト
export const legsHighlight: ViewerFeature = {
  id: 'legs-highlight',
  name: '🦵 両足・腰 (腰/膝/足首)',
  category: 'highlight',
  description: '下半身の骨格点（腰23,24番、膝25,26番、足首27,28番）をハイライトします。',
  getHighlightIndices: () => [23, 24, 25, 26, 27, 28],
}

