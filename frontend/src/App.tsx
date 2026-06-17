import { ControlPanel } from './components/ControlPanel/ControlPanel'
import { VideoPanel } from './components/VideoPanel/VideoPanel'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <div className="app-frame">

        <div className="app-layout">
          <VideoPanel />
          <ControlPanel />
        </div>
      </div>
    </main>
  )
}

export default App
