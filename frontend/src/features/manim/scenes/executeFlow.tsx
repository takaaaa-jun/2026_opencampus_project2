import { Create, FadeOut, Rectangle, Text, Transform } from 'manim-web'
import type { Scene } from 'manim-web'
import type { ManimConstruct } from '../types'

export const executeFlow: ManimConstruct = async (scene: Scene) => {
  const step = new Text({ text: 'Execute workflow' })
  const result = new Text({ text: 'Emit result' })
  const frame = new Rectangle({ width: 6.2, height: 2.2 })

  await scene.play(new Create(frame))
  await scene.play(new Create(step))
  await scene.play(new Transform(step, result))
  await scene.play(new FadeOut(step))
}
