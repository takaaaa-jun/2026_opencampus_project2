import { useEffect, useRef, useState } from 'react'
import { ManimScene } from 'manim-web/react'
import type { Scene } from 'manim-web'
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
  const sceneRef = useRef<Scene | null>(null)
  const loopTokenRef = useRef(0)
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0]
  const activeSceneKey = activeScene?.id ?? ''

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
    return () => {
      loopTokenRef.current += 1
      sceneRef.current = null
    }
  }, [activeSceneKey])

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
          key={activeSceneKey}
          width={stageSize.width}
          height={stageSize.height}
          onSceneReady={(scene) => {
            sceneRef.current = scene
            const loopToken = loopTokenRef.current

            void (async () => {
              try {
                while (loopTokenRef.current === loopToken) {
                  await activeScene.construct(scene)

                  if (loopTokenRef.current !== loopToken) {
                    break
                  }

                  scene.stop()
                  scene.clear({ render: false })
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                }
              } catch (error) {
                if (loopTokenRef.current === loopToken) {
                  console.error('AnimationPanel scene loop failed', error)
                }
              }
            })()
          }}
        />
      </div>

      <p className="animation-panel__description">{activeScene.description}</p>
    </section>
  )
}
