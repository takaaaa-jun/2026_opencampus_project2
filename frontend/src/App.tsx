import { useState } from 'react'
import { AnimationPanel } from './components/AnimationPanel/AnimationPanel'
import { VideoPanel } from './components/VideoPanel/VideoPanel'
import { manimScenes } from './features/manim/sceneRegistry'
import { AuthGuard } from './components/Auth/AuthGuard'
import './App.css'

function App() {
  const [activeSceneId, setActiveSceneId] = useState(manimScenes[0]?.id ?? '')

  return (
    <AuthGuard>
      <main className="app-shell">
        <div className="app-frame">
          <div className="app-layout">
            <VideoPanel />
            <AnimationPanel
              scenes={manimScenes}
              activeSceneId={activeSceneId}
              onSceneChange={setActiveSceneId}
            />
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}

export default App
