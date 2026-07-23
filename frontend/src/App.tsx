import { useEffect, useRef } from 'react'
import { useWebRTC } from './hooks/useWebRTC'
import './App.css'

function App() {
  const { cameraStream, connectionState, error, reconnect } = useWebRTC()
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  return (
    <main className="rtc-foundation">
      <section className="rtc-foundation__card" aria-live="polite">
        <p className="rtc-foundation__eyebrow">WebRTC foundation</p>
        <h1>接続基盤を起動中</h1>
        <p>バックエンドとのWebRTC接続を確立しています。</p>
        <dl>
          <div>
            <dt>接続状態</dt>
            <dd>{connectionState}</dd>
          </div>
        </dl>
        {error ? <p className="rtc-foundation__error">{error}</p> : null}
        <button type="button" onClick={reconnect}>再接続</button>
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted
          className="rtc-foundation__video"
        />
      </section>
    </main>
  )
}

export default App
