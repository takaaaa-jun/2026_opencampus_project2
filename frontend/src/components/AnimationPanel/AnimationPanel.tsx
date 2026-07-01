import { ManimScene } from 'manim-web/react'
import type { ManimSceneDefinition } from '../../features/manim/types'
import './AnimationPanel.css'

interface AnimationPanelProps {
  scenes: ManimSceneDefinition[]
  activeSceneId: string
  onSceneChange: (sceneId: string) => void
}

export function AnimationPanel({ scenes, activeSceneId, onSceneChange }: AnimationPanelProps) {
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0]

  if (!activeScene) {
    return null
  }

  return (
    <section className="panel animation-panel">
      <div className="animation-panel__header">
        <div>
          <h2>Process Animation</h2>
          <p>{activeScene.description}</p>
        </div>

        <label className="scene-switcher">
          <span>Scene</span>
          <select value={activeScene.id} onChange={(event) => onSceneChange(event.target.value)}>
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="animation-stage">
        <ManimScene
          key={activeScene.id}
          width={640}
          height={360}
          onSceneReady={(scene) => {
            void activeScene.construct(scene)
          }}
        />
      </div>
    </section>
  )
}
