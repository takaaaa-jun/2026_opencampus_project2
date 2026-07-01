import { useEffect, useRef, useState } from 'react'
import { ManimScene } from 'manim-web/react'
import type { ManimSceneDefinition } from '../../features/manim/types'
import './AnimationPanel.css'

interface AnimationPanelProps {
  scenes: ManimSceneDefinition[]
  activeSceneId: string
  onSceneChange: (sceneId: string) => void
}

export function AnimationPanel({ scenes, activeSceneId, onSceneChange }: AnimationPanelProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 640, height: 512 })
  const [loopEpoch, setLoopEpoch] = useState(0)
  const renderRunIdRef = useRef(0)
  const activeSceneIdRef = useRef(activeSceneId)
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0]

  useEffect(() => {
    const stageElement = stageRef.current

    if (!stageElement) {
      return
    }

    const updateSize = () => {
      const { width, height } = stageElement.getBoundingClientRect()
      setStageSize({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(stageElement)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    renderRunIdRef.current += 1
    activeSceneIdRef.current = activeScene.id
  }, [activeScene.id])

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

      <div className="animation-stage" ref={stageRef}>
        <ManimScene
          key={`${activeScene.id}-${loopEpoch}`}
          width={stageSize.width}
          height={stageSize.height}
          onSceneReady={(scene) => {
            const runId = renderRunIdRef.current
            const sceneId = activeScene.id

            void (async () => {
              await activeScene.construct(scene)

              if (renderRunIdRef.current !== runId || activeSceneIdRef.current !== sceneId) {
                return
              }

              setLoopEpoch((current) => current + 1)
            })()
          }}
        />
      </div>

      <p className="animation-panel__description">{activeScene.description}</p>
    </section>
  )
}
