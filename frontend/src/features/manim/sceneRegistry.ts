import type { ManimSceneDefinition } from './types'
import { executeFlow } from './scenes/executeFlow'
import { parseInput } from './scenes/parseInput'
import { validateData } from './scenes/validateData'

export const manimScenes: ManimSceneDefinition[] = [
  {
    id: 'parse-input',
    title: 'Parse Input',
    description: 'Input を分解して、後続処理へ渡す流れを見せる。',
    construct: parseInput,
  },
  {
    id: 'validate-data',
    title: 'Validate Data',
    description: '受け取ったデータの検証と分岐を見せる。',
    construct: validateData,
  },
  {
    id: 'execute-flow',
    title: 'Execute Flow',
    description: '処理の実行から結果出力までを見せる。',
    construct: executeFlow,
  },
]
