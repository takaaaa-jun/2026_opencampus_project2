import { useEffect, useRef, useState, useMemo } from 'react'
import {
  buildPoseSummary,
  drawPoseFrame,
  normalizeLandmarks,
  type PoseDisplayMode,
  type PoseFrame,
  type PoseSummaryRow,
} from '../../pose'
import { REGISTERED_FEATURES } from '../../features'

type Mode = 'send' | 'view'
type ConnectionStatus = 'idle' | 'requesting-camera' | 'streaming' | 'stopping' | 'error'

type PoseLatestResponse = {
  room_id: string
  pose: PoseFrame
}

type ImageLatestResponse = {
  room_id: string
  image: string
}

const DEFAULT_ROOM_ID = 'default'
const POSE_POLL_INTERVAL_MS = 150
const POSE_POST_INTERVAL_MS = 120

function toBooleanClass(value: boolean) {
  return value ? 'is-on' : 'is-off'
}

function PoseSummaryTable({ title, rows }: { title: string; rows: PoseSummaryRow[] }) {
  return (
    <div className="pose-summary">
      <div className="pose-summary-title">{title}</div>
      <div className="pose-summary-list">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="pose-summary-row">
              <span className="pose-summary-label">{row.label}</span>
              <span className="pose-summary-value">
                {row.visibility === null ? '—' : `v=${row.visibility.toFixed(2)}`}
              </span>
              <span className="pose-summary-value">
                x={row.x.toFixed(3)} / y={row.y.toFixed(3)}
              </span>
            </div>
          ))
        ) : (
          <div className="pose-summary-empty">骨格データがまだありません。</div>
        )}
      </div>
    </div>
  )
}

export function VideoPanel() {
  const [mode, setMode] = useState<Mode>(() =>
    window.location.pathname.includes('/view') ? 'view' : 'send',
  )

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef(false)
  const poseTimerRef = useRef<number | null>(null)
  const poseBusyRef = useRef(false)
  const lastPosePostAtRef = useRef(0)
  const activePoseInstanceRef = useRef<any>(null)

  // MJPEG 画像中継用
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const remoteImageRef = useRef<HTMLImageElement | null>(null)

  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [message, setMessage] = useState(
    mode === 'send'
      ? 'カメラ PC で送信を開始します。別 PC は /view を開いて確認します。'
      : '視聴用ページです。送信 PC が先に Start してからデータを受信します。',
  )
  const [error, setError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID)
  const [displayMode, setDisplayMode] = useState<PoseDisplayMode>('both')
  const [localPoseFrame, setLocalPoseFrame] = useState<PoseFrame | null>(null)
  const [latestPoseFrame, setLatestPoseFrame] = useState<PoseFrame | null>(null)
  const [viewerPollStatus, setViewerPollStatus] = useState<'idle' | 'polling' | 'waiting' | 'ready'>('idle')

  // ONになっている機能IDのリスト
  const [enabledFeatureIds, setEnabledFeatureIds] = useState<string[]>([])

  const activePoseFrame = mode === 'send' ? localPoseFrame : latestPoseFrame
  const keySummary = buildPoseSummary(activePoseFrame)

  // 有効化されている全機能からハイライト対象の関節IDを取得してマージ
  const highlightIndices = useMemo(() => {
    if (!activePoseFrame) return []
    const indicesSet = new Set<number>()
    REGISTERED_FEATURES.forEach((feature) => {
      if (enabledFeatureIds.includes(feature.id) && feature.getHighlightIndices) {
        feature.getHighlightIndices(activePoseFrame).forEach((idx) => indicesSet.add(idx))
      }
    })
    return Array.from(indicesSet)
  }, [activePoseFrame, enabledFeatureIds])

  // サーバーのAPIエンドポイントベースURLを設定
  const backendBase = useMemo(() => {
    // 1. URLクエリパラメータがある場合は最優先（手動指定用）
    const urlParams = new URLSearchParams(window.location.search)
    const queryIp = urlParams.get('server_ip')
    const queryPort = urlParams.get('server_port')
    const queryPath = urlParams.get('server_path')

    if (queryIp || queryPort || queryPath) {
      const ip = queryIp || window.location.hostname
      const port = queryPort || (window.location.port ? window.location.port : '80')
      const pathPrefix = queryPath ? `/${queryPath.replace(/^\/+|\/+$/g, '')}` : ''
      return `http://${ip}:${port}${pathPrefix}`
    }

    // 2. クエリパラメータがない場合は、現在のアドレスから自動判定
    const protocol = window.location.protocol // "http:" or "https:"
    const host = window.location.hostname
    const port = window.location.port ? `:${window.location.port}` : ''
    const pathPrefix = window.location.pathname.includes('/2026_opencampus_project2')
      ? '/2026_opencampus_project2'
      : ''

    return `${protocol}//${host}${port}${pathPrefix}`
  }, [])

  const clearPoseLoop = () => {
    if (poseTimerRef.current !== null) {
      window.clearTimeout(poseTimerRef.current)
      poseTimerRef.current = null
    }
    try {
      activePoseInstanceRef.current?.close?.()
    } catch {
      // ignore
    }
    poseBusyRef.current = false
    activePoseInstanceRef.current = null
  }

  const drawCurrentFrame = (frame: PoseFrame | null) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) {
      return
    }

    // 背景イメージの指定（閲覧側かつ「骨格だけ」ではない場合）
    const bgImg = (mode === 'view' && displayMode !== 'skeleton') ? remoteImageRef.current : null

    drawPoseFrame(canvas, frame, {
      showLabels: mode === 'send',
      backgroundImage: bgImg,
      background: '#0b1220', // ダークブルー背景
      emptyText: mode === 'send' ? 'MediaPipe で骨格を検出中...' : '送信 PC のデータを待機中',
      highlightIndices: highlightIndices,
      highlightColor: '#ffcc00', // 強調色はネオンイエロー
    })
  }

  const uploadPoseFrame = async (frame: PoseFrame) => {
    const now = Date.now()
    if (now - lastPosePostAtRef.current < POSE_POST_INTERVAL_MS) {
      return
    }
    lastPosePostAtRef.current = now

    try {
      await fetch(`${backendBase}/api/webrtc/pose/update/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frame),
      })
    } catch {
      // best effort
    }
  }

  const uploadImageFrame = async (video: HTMLVideoElement) => {
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas')
    }
    const canvas = captureCanvasRef.current
    const width = video.videoWidth || 640
    const height = video.videoHeight || 360

    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, width, height)
    const base64Image = canvas.toDataURL('image/jpeg', 0.5)

    try {
      await fetch(`${backendBase}/api/webrtc/image/update/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          image: base64Image,
        }),
      })
    } catch {
      // best effort
    }
  }

  const stopAll = async (updateUi: boolean) => {
    abortRef.current = true
    clearPoseLoop()

    const stream = localStreamRef.current
    localStreamRef.current = null

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }

    drawCurrentFrame(null)

    if (updateUi) {
      setStatus('idle')
      setMessage(mode === 'send' ? '停止しました。' : '切断しました。')
      setViewerPollStatus('idle')
    }
  }

  const startPoseAnalysis = async (video: HTMLVideoElement, room: string) => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    )

    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-tasks/pose_landmarker/pose_landmarker_lite.task',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    })

    activePoseInstanceRef.current = pose

    const tick = async () => {
      if (abortRef.current) {
        return
      }

      const ready = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      if (!ready) {
        poseTimerRef.current = window.setTimeout(tick, 120)
        return
      }

      if (!poseBusyRef.current) {
        poseBusyRef.current = true
        try {
          const timestamp = performance.now()
          const result = pose.detectForVideo(video, timestamp)

          const landmarks = normalizeLandmarks(
            (result.landmarks?.[0] ?? []) as unknown as Array<Record<string, unknown>>,
          )

          const frame: PoseFrame = {
            room_id: room,
            updated_at: Date.now(),
            image_width: video.videoWidth || 1280,
            image_height: video.videoHeight || 720,
            landmarks,
          }

          setLocalPoseFrame(frame)
          drawCurrentFrame(frame)
          void uploadPoseFrame(frame)
          void uploadImageFrame(video)
        } catch (err) {
          if (!abortRef.current) {
            console.error('Pose inference failed:', err)
          }
        } finally {
          poseBusyRef.current = false
        }
      }

      poseTimerRef.current = window.setTimeout(tick, 120)
    }

    tick()
  }

  useEffect(() => {
    return () => {
      abortRef.current = true
      void stopAll(false)
    }
  }, [])

  // 画像と骨格データのGETポーリング
  useEffect(() => {
    if (mode !== 'view') {
      return
    }

    let cancelled = false
    let timerId: number | null = null

    const poll = async () => {
      if (cancelled) {
        return
      }

      setViewerPollStatus((current) => (current === 'ready' ? 'ready' : 'polling'))

      try {
        // 1. 骨格データ
        const poseRes = await fetch(`${backendBase}/api/webrtc/pose/latest/?room_id=${encodeURIComponent(roomId)}`)
        let freshFrame: PoseFrame | null = null
        if (poseRes.ok) {
          const data = (await poseRes.json()) as PoseLatestResponse
          freshFrame = data.pose
          setLatestPoseFrame(data.pose)
          setViewerPollStatus('ready')
        } else if (poseRes.status === 404) {
          setLatestPoseFrame(null)
          setViewerPollStatus('waiting')
        }

        // 2. 画像データ（骨格だけモード以外）
        if (displayMode !== 'skeleton') {
          const imgRes = await fetch(`${backendBase}/api/webrtc/image/latest/?room_id=${encodeURIComponent(roomId)}`)
          if (imgRes.ok) {
            const data = (await imgRes.json()) as ImageLatestResponse

            if (!remoteImageRef.current) {
              remoteImageRef.current = new Image()
            }

            remoteImageRef.current.onload = () => {
              if (!cancelled) {
                drawCurrentFrame(freshFrame || latestPoseFrame)
              }
            }
            remoteImageRef.current.src = data.image
          }
        } else {
          remoteImageRef.current = null
          drawCurrentFrame(freshFrame || latestPoseFrame)
        }

      } catch (err) {
        if (!cancelled) {
          setViewerPollStatus('waiting')
        }
      }

      timerId = window.setTimeout(poll, POSE_POLL_INTERVAL_MS)
    }

    void poll()

    return () => {
      cancelled = true
      if (timerId !== null) {
        window.clearTimeout(timerId)
      }
    }
  }, [mode, roomId, displayMode])

  useEffect(() => {
    if (mode === 'send') {
      drawCurrentFrame(localPoseFrame)
      return
    }

    if (displayMode === 'video') {
      drawCurrentFrame(null)
      return
    }

    drawCurrentFrame(latestPoseFrame)
  }, [displayMode, latestPoseFrame, localPoseFrame, mode])

  const startSend = async () => {
    abortRef.current = false
    setError(null)
    setStatus('requesting-camera')
    setMessage('カメラを取得しています。')
    setLocalPoseFrame(null)
    setLatestPoseFrame(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (abortRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      setStatus('streaming')
      setMessage('送信中です。別 PC の /view で確認できます。')

      if (localVideoRef.current) {
        await startPoseAnalysis(localVideoRef.current, roomId)
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err)
      setError(messageText)
      setStatus('error')
      setMessage('カメラの起動に失敗しました。')
      await stopAll(false)
    }
  }

  const startView = async () => {
    abortRef.current = false
    setError(null)
    setStatus('streaming')
    setMessage('視聴中です（HTTP中継方式）。')
  }

  const onStart = async () => {
    if (mode === 'send') {
      await startSend()
      return
    }
    await startView()
  }

  const onStop = async () => {
    setStatus('stopping')
    setMessage('停止しています。')
    await stopAll(true)
  }

  const toggleFeature = (id: string) => {
    setEnabledFeatureIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const pageTitle = mode === 'send' ? '送信用 PC' : '視聴用 PC'
  const streamStatusClass =
    status === 'streaming' ? 'ok' : status === 'error' ? 'err' : ''

  const handleModeToggle = () => {
    void stopAll(true)
    const nextMode = mode === 'send' ? 'view' : 'send'
    setMode(nextMode)
    window.history.pushState({}, '', `./${nextMode}`)
    setMessage(
      nextMode === 'send'
        ? 'カメラ PC で送信を開始します。別 PC は /view を開いて確認します。'
        : '視聴用ページです。送信 PC が先に Start してからデータを受信します。',
    )
  }

  return (
    <section className="panel video-panel">
      <div className="panel-header">
        <div className="header-meta">
          <span className="badge">HTTP Relay</span>
          <span className="badge">room: {roomId}</span>
          <span className="badge">mode: {pageTitle}</span>
        </div>
        <div className="header-controls">
          <button className="mode-toggle-btn" onClick={handleModeToggle}>
            Switch to {mode === 'send' ? 'View' : 'Send'}
          </button>
        </div>
      </div>

      <div className="video-card">
        <div className="card-heading-row">
          <h2>{mode === 'send' ? 'Local preview + MediaPipe' : 'Remote stream + Skeleton overlay'}</h2>
          {mode === 'view' && (
            <div className="mode-switches" aria-label="表示モード切り替え">
              {(['video', 'skeleton', 'both'] as PoseDisplayMode[]).map((option) => (
                <button
                  key={option}
                  className={`mini-btn ${toBooleanClass(displayMode === option)}`}
                  onClick={() => setDisplayMode(option)}
                  type="button"
                >
                  {option === 'video' ? '映像のみ' : option === 'skeleton' ? '骨格のみ' : '同時表示'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="stage-viewport">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={mode === 'view' ? 'is-hidden' : ''}
            style={{ width: mode === 'view' ? 0 : '100%', height: mode === 'view' ? 0 : 'auto', display: mode === 'view' ? 'none' : 'block' }}
          />
          <canvas
            ref={overlayCanvasRef}
            className={mode === 'view' && displayMode === 'video' ? 'is-hidden' : ''}
          />
        </div>
      </div>

      <div className="control-card">
        <div className="input-group">
          <label htmlFor="room-id">Room ID</label>
          <input
            id="room-id"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value.trim() || DEFAULT_ROOM_ID)}
            placeholder="default"
          />
        </div>
        <div className="actions-row">
          <button
            className="btn-primary"
            onClick={() => void onStart()}
            disabled={status === 'requesting-camera' || status === 'streaming'}
          >
            Start
          </button>
          <button className="btn-secondary" onClick={() => void onStop()} disabled={status === 'idle'}>
            Stop
          </button>
        </div>

        {message && <div className={`status-banner ${streamStatusClass}`}>{message}</div>}
        {error && <div className="status-banner err">{error}</div>}
      </div>

      {mode === 'view' && (
        <div className="features-card">
          <h3>🎨 部位ハイライト設定</h3>
          <p className="note">ONにした部位の検出点（関節）が黄色く光ります。</p>
          <div className="feature-buttons">
            {REGISTERED_FEATURES.map((feature) => {
              const isEnabled = enabledFeatureIds.includes(feature.id)
              return (
                <button
                  key={feature.id}
                  type="button"
                  className={`mini-btn ${toBooleanClass(isEnabled)}`}
                  onClick={() => toggleFeature(feature.id)}
                >
                  {feature.name}
                </button>
              )}
            )}
          </div>
        </div>
      )}

      <div className="stats-card">
        <h3>{mode === 'send' ? '検出データ' : '接続・同期ステータス'}</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">{mode === 'send' ? '検出フレーム' : '接続状態'}</span>
            <span className="stat-value">
              {mode === 'send'
                ? (localPoseFrame ? new Date(localPoseFrame.updated_at).toLocaleTimeString() : '—')
                : status}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{mode === 'send' ? 'ランドマーク数' : 'データ同期'}</span>
            <span className="stat-value">
              {mode === 'send'
                ? (localPoseFrame?.landmarks?.length ?? 0)
                : viewerPollStatus}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{mode === 'send' ? '送信先 Room' : '表示モード'}</span>
            <span className="stat-value">
              {mode === 'send' ? roomId : displayMode}
            </span>
          </div>
        </div>
        <PoseSummaryTable title={mode === 'send' ? '主要関節の概要' : '最新の骨格データ'} rows={keySummary} />
      </div>
    </section>
  )
}
