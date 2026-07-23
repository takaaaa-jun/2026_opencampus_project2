import type { MutableRefObject } from 'react'

import type { DetectionMessage } from '../../features/detection/types'
import type { TransportState } from '../../features/webrtc/useWebRTCTransport'
import { CameraStage } from './CameraStage'
import { HistoryStrip } from './HistoryStrip'

interface CameraPanelProps {
  stream: MediaStream | null
  latestDetectionRef: MutableRefObject<DetectionMessage | null>
  detection: DetectionMessage | null
  state: TransportState
  clapThreshold: number
}

const stateLabels: Record<TransportState, string> = {
  idle: '停止中',
  'requesting-camera': 'カメラ許可待ち',
  connecting: '接続中',
  connected: '解析中',
  failed: 'エラー',
}

export function CameraPanel({ stream, latestDetectionRef, detection, state, clapThreshold }: CameraPanelProps) {
  const rawClapDistance = detection?.actions.clap?.metrics.middleFingertipDistance
  const clapDistance = typeof rawClapDistance === 'number' ? rawClapDistance : null
  const clapActive = Boolean(detection?.actions.clap?.active)

  return (
    <section className="panel camera-panel">
      <div className="panel-heading panel-heading--camera">
        <div>
          <p className="eyebrow">LIVE MOTION</p>
          <h2>カメラと骨格の表示</h2>
          <p className="panel-copy">
            左にそのままの映像、右に骨格の重ね表示を並べています。下には、いまの距離だけを見やすくした1本のバーを置いています。
          </p>
        </div>
        <span className={`status-pill status-${state}`}>{stateLabels[state]}</span>
      </div>

      <div className="camera-body">
        <div className="camera-grid">
          <CameraStage
            stream={stream}
            latestDetectionRef={latestDetectionRef}
            mode="raw"
            title="Camera"
            subtitle="カメラ映像そのまま / 左右反転"
          />
          <CameraStage
            stream={stream}
            latestDetectionRef={latestDetectionRef}
            mode="annotated"
            title="Annotated"
            subtitle="骨格の重ね表示 / 左右反転"
          />
        </div>

        <HistoryStrip currentDistance={clapDistance ?? null} isClapActive={clapActive} clapThreshold={clapThreshold} />
      </div>
    </section>
  )
}
