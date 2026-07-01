import { Circle, Create, FadeIn, Rectangle, Text, Transform, Write } from 'manim-web'
import type { Scene } from 'manim-web'
import type { ManimConstruct } from '../types'

export const example: ManimConstruct = async (scene: Scene) => {
  const title = new Text({
    text: '例: 形の変化',
    fontSize: 34,
    color: '#f8fafc',
    fontWeight: 700,
  }).moveTo([0, 2.2, 0])

  const subtitle = new Text({
    text: '円が四角に変わる基本例',
    fontSize: 20,
    color: '#94a3b8',
  }).moveTo([0, 1.75, 0])

  const circle = new Circle({
    radius: 1.0,
    color: '#38bdf8',
    strokeWidth: 4,
    fillOpacity: 0.08,
    center: [-1.2, 0.0, 0],
  })

  const square = new Rectangle({
    width: 2.0,
    height: 2.0,
    color: '#a78bfa',
    strokeWidth: 4,
    fillOpacity: 0.08,
    center: [1.4, 0.0, 0],
  })

  const circleLabel = new Text({
    text: '円',
    fontSize: 28,
    color: '#e2e8f0',
    fontWeight: 700,
  }).moveTo(circle)

  const squareLabel = new Text({
    text: '四角',
    fontSize: 28,
    color: '#e2e8f0',
    fontWeight: 700,
  }).moveTo(square)

  const arrow = new Text({
    text: '→',
    fontSize: 44,
    color: '#facc15',
    fontWeight: 700,
  }).moveTo([0, 0, 0])

  const note = new Text({
    text: 'Create -> Transform -> FadeIn',
    fontSize: 18,
    color: '#cbd5e1',
  }).moveTo([0, -2.0, 0])

  await scene.play(new Create(title), new FadeIn(subtitle))
  await scene.play(new Create(circle), new Write(circleLabel))
  await scene.play(new FadeIn(arrow))
  await scene.play(new Create(square), new Write(squareLabel))
  await scene.play(new Transform(circle, square))
  await scene.play(new FadeIn(note))
  await scene.wait(0.8)
}
