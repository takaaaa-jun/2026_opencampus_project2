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
        <div className="scene-tabs" role="tablist" aria-label="Animation scenes">
          {scenes.map((scene) => {
            const isActive = scene.id === activeScene.id

            return (
              <button
                key={scene.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`scene-tab${isActive ? ' is-active' : ''}`}
                onClick={() => onSceneChange(scene.id)}
              >
                {scene.title}
              </button>
            )
          })}
        </div>
      </div>

      <div className="animation-stage">
        <ManimScene
          key={activeScene.id}
          width={760}
          height={428}
          onSceneReady={(scene) => {
            void activeScene.construct(scene)
          }}
        />
      </div>

      <p className="animation-panel__description">{activeScene.description}</p>
    </section>
  )
}
