import type { Scene } from 'manim-web'

export type ManimConstruct = (scene: Scene) => Promise<void> | void

export interface ManimSceneDefinition {
  id: string
  title: string
  description: string
  construct: ManimConstruct
}
