import { useState } from 'react'

import { ExplanationPanel } from './components/explanation/ExplanationPanel'
import { MotionTabs } from './components/explanation/MotionTabs'
import { CameraPanel } from './components/video/CameraPanel'
import type { ActionId } from './features/detection/types'
import { useWebRTCTransport, readClapThreshold } from './features/webrtc/useWebRTCTransport'
import './App.css'

function App() {
  const { localStream, latestDetectionRef, detection, state, error, start, stop } = useWebRTCTransport()
  const [selectedAction, setSelectedAction] = useState<ActionId>('clap')
  const clapThreshold = readClapThreshold()

  const running = state === 'requesting-camera' || state === 'connecting' || state === 'connected'

  return (
    <main className="app-shell">
      <header className="hero-banner">
        <div className="hero-copy-block">
          <p className="eyebrow">OPEN CAMPUS 2026</p>
          <h1>AIが動きを読み取るデモ</h1>
          <p className="hero-copy">
            カメラに映る手や体の動きをその場で読み取り、骨格の重ね表示と判定の根拠を同じ画面で見せます。
            どこを見て、どう判断したのかが直感的に伝わるように、映像と説明をひとまとめにしました。
          </p>
        </div>

        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={() => void start()} disabled={running}>
            カメラを開始
          </button>
          <button type="button" className="secondary-button" onClick={() => void stop()} disabled={state === 'idle'}>
            カメラを停止
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <MotionTabs selected={selectedAction} onSelect={setSelectedAction} />

      <div className="app-layout">
        <CameraPanel
          stream={localStream}
          latestDetectionRef={latestDetectionRef}
          detection={detection}
          state={state}
          clapThreshold={clapThreshold}
        />
        <ExplanationPanel selectedAction={selectedAction} detection={detection} />
      </div>
    </main>
  )
}

export default App
