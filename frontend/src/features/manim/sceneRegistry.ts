import type { ManimSceneDefinition } from './types'
import { example } from './scenes/example'
import { forGhost } from './scenes/forGhost'

export const manimScenes: ManimSceneDefinition[] = [
  {
    id: 'example',
    title: 'example',
    description: '円が四角に変わる基本例。',
    construct: example,
  },
  {
    id: 'for-ghost',
    title: 'forおばけ',
    description: '指定された動作を必要回数行うことで，forおばけを倒す処理。',
    construct: forGhost,
  },
] 