import { useEffect, useRef } from 'react'
import { useWebRTC } from './hooks/useWebRTC'
import './App.css'

function App() {
  const { cameraStream, skeletonStream, connectionState, error, reconnect } = useWebRTC()
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const skeletonVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => {
    if (skeletonVideoRef.current) {
      skeletonVideoRef.current.srcObject = skeletonStream
    }
  }, [skeletonStream])

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
        <div className="rtc-foundation__videos">
          <div>
            <p>カメラ映像</p>
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className="rtc-foundation__video"
            />
          </div>
          <div>
            <p>骨格映像</p>
            <video
              ref={skeletonVideoRef}
              autoPlay
              playsInline
              muted
              className="rtc-foundation__video"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
