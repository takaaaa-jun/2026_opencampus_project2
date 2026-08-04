import { useEffect, useState } from 'react'
import { ExplanationPanel } from './components/ExplanationPanel/ExplanationPanel'
import { VideoPanel } from './components/VideoPanel/VideoPanel'
import { useWebRTC } from './hooks/useWebRTC'
import type { DetectionData } from './types/detection'
import './App.css'

const actionLabels: Record<string, string> = {
  tpose: '十字架',
  upper: 'アッパー',
  swing: 'ふりおろし',
  closs: 'ウルトラマン',
  clap: 'たたく',
  kamehameha: 'かめはめ波',
}

function getDetectedActionLabel(detectionData: DetectionData | null): string | null {
  if (detectionData === null || typeof detectionData.actions !== 'object' || detectionData.actions === null) {
    return null
  }

  const actions = detectionData.actions as Record<string, unknown>
  return Object.entries(actionLabels).find(([actionId]) => actions[actionId] === true)?.[1] ?? null
}

function App() {
  const {
    cameraStream,
    skeletonStream,
    detectionData,
    connectionState,
    isCameraStarted,
    startCamera,
    stopCamera,
    reconnect,
  } = useWebRTC()
  const [lastDetectedAction, setLastDetectedAction] = useState('なし')

  useEffect(() => {
    if (!isCameraStarted) {
      setLastDetectedAction('なし')
      return
    }

    const detectedActionLabel = getDetectedActionLabel(detectionData)
    if (detectedActionLabel !== null) {
      setLastDetectedAction(detectedActionLabel)
    }
  }, [detectionData, isCameraStarted])

  const buttonState = isCameraStarted ? connectionState : 'idle'
  const buttonLabel = !isCameraStarted
    ? 'カメラを起動'
    : connectionState === 'failed'
      ? '再接続'
      : connectionState === 'connecting'
        ? '接続中（停止）'
        : 'カメラを停止'
  const handleCameraButton = !isCameraStarted
    ? startCamera
    : connectionState === 'failed'
      ? reconnect
      : stopCamera

  return (
    <main className="rtc-foundation">
      <section className="rtc-foundation__layout" aria-live="polite">
        <div className="rtc-foundation__video-column">
          <div className="rtc-foundation__video-header">
            <button
              type="button"
              className={`camera-control camera-control--${buttonState}`}
              onClick={handleCameraButton}
            >
              {buttonLabel}
            </button>
            <p className="last-detected-action">最後に検知：{lastDetectedAction}</p>
          </div>
          <VideoPanel cameraStream={cameraStream} skeletonStream={skeletonStream} />
        </div>
        <ExplanationPanel detectionData={detectionData} isCameraStarted={isCameraStarted} />
      </section>
    </main>
  )
}

export default App
