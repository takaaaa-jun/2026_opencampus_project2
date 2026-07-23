import { useEffect, useRef, type MutableRefObject } from 'react'

import type { DetectionMessage, Landmark } from '../../features/detection/types'
import { HAND_CONNECTIONS, POSE_CONNECTIONS } from './connections'

interface CameraStageProps {
  stream: MediaStream | null
  latestDetectionRef: MutableRefObject<DetectionMessage | null>
  mode: 'raw' | 'annotated'
  title: string
  subtitle: string
}

function isVisible(landmark: Landmark): boolean {
  return landmark.visibility === undefined || landmark.visibility >= 0.45
}

function toPoint(landmark: Landmark, width: number, height: number, mirrored: boolean): [number, number] {
  const x = mirrored ? 1 - landmark.x : landmark.x
  return [x * width, landmark.y * height]
}

export function CameraStage({ stream, latestDetectionRef, mode, title, subtitle }: CameraStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const flashUntilRef = useRef(0)
  const lastClapFrameRef = useRef(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.srcObject = stream
    if (stream) {
      void video.play().catch(() => undefined)
    }
  }, [stream])

  useEffect(() => {
    if (mode !== 'annotated') {
      return undefined
    }

    let animationFrame = 0

    const draw = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) {
        animationFrame = requestAnimationFrame(draw)
        return
      }

      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720
      if (canvas.width !== width) {
        canvas.width = width
      }
      if (canvas.height !== height) {
        canvas.height = height
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        animationFrame = requestAnimationFrame(draw)
        return
      }

      ctx.clearRect(0, 0, width, height)

      const message = latestDetectionRef.current
      if (message) {
        const mirrored = message.frame.mirrored

        const drawSkeleton = (
          landmarks: Landmark[],
          connections: Array<[number, number]>,
          strokeStyle: string,
          pointStyle: string,
          lineWidth: number,
        ) => {
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = strokeStyle
          ctx.lineWidth = lineWidth
          for (const [from, to] of connections) {
            const a = landmarks[from]
            const b = landmarks[to]
            if (!a || !b || !isVisible(a) || !isVisible(b)) continue
            const [ax, ay] = toPoint(a, width, height, mirrored)
            const [bx, by] = toPoint(b, width, height, mirrored)
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.lineTo(bx, by)
            ctx.stroke()
          }
          ctx.fillStyle = pointStyle
          for (const landmark of landmarks) {
            if (!isVisible(landmark)) continue
            const [x, y] = toPoint(landmark, width, height, mirrored)
            ctx.beginPath()
            ctx.arc(x, y, lineWidth + 1.6, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        if (message.pose) {
          drawSkeleton(message.pose.landmarks, POSE_CONNECTIONS, 'rgba(73, 222, 255, 0.92)', '#effcff', 3)
        }
        for (const hand of message.hands) {
          const isLeft = hand.handedness === 'left'
          drawSkeleton(
            hand.landmarks,
            HAND_CONNECTIONS,
            isLeft ? 'rgba(96, 165, 250, 0.96)' : 'rgba(251, 146, 60, 0.96)',
            isLeft ? '#dbeafe' : '#ffedd5',
            3,
          )
        }

        if (message.actions.clap.triggered && message.frame.id !== lastClapFrameRef.current) {
          lastClapFrameRef.current = message.frame.id
          flashUntilRef.current = performance.now() + 380
        }
      }

      if (performance.now() < flashUntilRef.current) {
        const remaining = (flashUntilRef.current - performance.now()) / 380
        ctx.fillStyle = `rgba(250, 204, 21, ${0.08 + remaining * 0.12})`
        ctx.fillRect(0, 0, width, height)
      }

      animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [latestDetectionRef, mode])

  return (
    <article className="camera-stage-card">
      <div className="camera-stage-label">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <div className={`camera-stage ${mode === 'raw' ? 'is-raw' : 'is-annotated'}`}>
        <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
        {mode === 'annotated' && <canvas ref={canvasRef} className="overlay-canvas" />}
        {!stream && (
          <div className="camera-placeholder">
            <div>
              <strong>カメラを開始してください</strong>
              <span>ブラウザの許可を出すと、ここに映像と骨格の重ね表示が出ます。</span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
