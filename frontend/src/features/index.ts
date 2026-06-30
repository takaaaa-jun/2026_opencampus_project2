import type { ViewerFeature } from './types'
import * as features from './list'

export type { ViewerFeature, FeatureResult, FeatureMetric } from './types'

export const REGISTERED_FEATURES: ViewerFeature[] = [
  features.headHighlight,
  features.leftArmHighlight,
  features.rightArmHighlight,
  features.legsHighlight,
]
