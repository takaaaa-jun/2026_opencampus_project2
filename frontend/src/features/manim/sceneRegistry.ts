import type { ManimSceneDefinition } from './types'
import { example } from './scenes/example'

export const manimScenes: ManimSceneDefinition[] = [
  {
    id: 'example',
    title: 'example',
    description: '円が四角に変わる基本例。',
    construct: example,
  },
]
