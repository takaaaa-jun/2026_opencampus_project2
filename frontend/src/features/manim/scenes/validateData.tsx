import { Create, FadeOut, Rectangle, Text, Transform } from 'manim-web'
import type { Scene } from 'manim-web'
import type { ManimConstruct } from '../types'

export const validateData: ManimConstruct = async (scene: Scene) => {
  const candidate = new Text({ text: 'Validate data' })
  const checked = new Text({ text: 'Valid / Invalid' })
  const frame = new Rectangle({ width: 6.2, height: 2.2 })

  await scene.play(new Create(frame))
  await scene.play(new Create(candidate))
  await scene.play(new Transform(candidate, checked))
  await scene.play(new FadeOut(candidate))
}
