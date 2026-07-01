import { Arrow, Create, FadeOut, Rectangle, Text, Transform } from 'manim-web'
import type { Scene } from 'manim-web'
import type { ManimConstruct } from '../types'

export const parseInput: ManimConstruct = async (scene: Scene) => {
  const input = new Text({ text: 'Input' })
  const parsed = new Text({ text: 'Parse tokens' })
  const frame = new Rectangle({ width: 6.2, height: 2.2 })
  const arrow = new Arrow({ start: [-2.2, 0, 0], end: [2.2, 0, 0] })

  await scene.play(new Create(frame))
  await scene.play(new Create(input))
  await scene.play(new Create(arrow))
  await scene.play(new Transform(input, parsed))
  await scene.play(new FadeOut(arrow))
}
