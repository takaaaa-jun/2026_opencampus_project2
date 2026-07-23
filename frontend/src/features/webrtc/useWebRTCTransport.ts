import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

import { parseDetectionMessage } from '../detection/parseDetectionMessage'
import type { DetectionMessage } from '../detection/types'
import { closeRemoteSession, exchangeOffer } from './signalingClient'

export type TransportState = 'idle' | 'requesting-camera' | 'connecting' | 'connected' | 'failed'

interface UseWebRTCTransportResult {
  localStream: MediaStream | null
  latestDetectionRef: MutableRefObject<DetectionMessage | null>
  detection: DetectionMessage | null
  history: number[]
  state: TransportState
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function readClapThreshold(): number {
  const raw = Number(import.meta.env.VITE_CLAP_THRESHOLD)
  if (Number.isFinite(raw) && raw > 0) {
    return Math.max(0.03, Math.min(0.5, raw))
  }
  return 0.12
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onStateChange)
        resolve()
      }
    }

    pc.addEventListener('icegatheringstatechange', onStateChange)
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onStateChange)
      resolve()
    }, 5000)
  })
}

function iceServersFromEnv(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON
  if (!raw) {
    return []
  }
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? (value as RTCIceServer[]) : []
  } catch {
    return []
  }
}

export function useWebRTCTransport(): UseWebRTCTransportResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [detection, setDetection] = useState<DetectionMessage | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [state, setState] = useState<TransportState>('idle')
  const [error, setError] = useState<string | null>(null)

  const latestDetectionRef = useRef<DetectionMessage | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const latestFrameIdRef = useRef(0)
  const lastUiUpdateRef = useRef(0)

  const sendConfig = useCallback(() => {
    const channel = dataChannelRef.current
    if (channel?.readyState !== 'open') {
      return
    }
    channel.send(
      JSON.stringify({
        type: 'config',
        config: { clapThreshold: readClapThreshold() },
      }),
    )
  }, [])

  const teardown = useCallback(async (notifyServer: boolean) => {
    const sessionId = sessionIdRef.current
    sessionIdRef.current = null

    dataChannelRef.current?.close()
    dataChannelRef.current = null

    pcRef.current?.close()
    pcRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setLocalStream(null)
    latestDetectionRef.current = null
    latestFrameIdRef.current = 0
    setDetection(null)
    setHistory([])
    setState('idle')

    if (notifyServer && sessionId) {
      try {
        await closeRemoteSession(sessionId)
      } catch {
        // The PeerConnection may already have closed on the server.
      }
    }
  }, [])

  const start = useCallback(async () => {
    if (pcRef.current) {
      return
    }

    setError(null)
    setState('requesting-camera')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('カメラAPIを利用できません。HTTPSまたはlocalhostで開いてください。')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      })
      streamRef.current = stream
      setLocalStream(stream)
      setState('connecting')

      const pc = new RTCPeerConnection({ iceServers: iceServersFromEnv() })
      pcRef.current = pc

      const channel = pc.createDataChannel('detections', {
        ordered: false,
        maxRetransmits: 0,
      })
      dataChannelRef.current = channel

      channel.addEventListener('open', sendConfig)
      channel.addEventListener('message', (event) => {
        const message = parseDetectionMessage(event.data)
        if (!message || message.frame.id <= latestFrameIdRef.current) {
          return
        }

        latestFrameIdRef.current = message.frame.id
        latestDetectionRef.current = message

        const clapDistance = message.actions.clap?.metrics.middleFingertipDistance
        if (typeof clapDistance === 'number' && Number.isFinite(clapDistance)) {
          setHistory((current) => {
            const next = [...current, clapDistance]
            return next.length > 28 ? next.slice(next.length - 28) : next
          })
        }

        const now = performance.now()
        const hasTrigger = Object.values(message.actions).some((action) => action.triggered)
        if (hasTrigger || now - lastUiUpdateRef.current >= 100) {
          lastUiUpdateRef.current = now
          setDetection(message)
        }
      })

      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') {
          setState('connected')
        } else if (pc.connectionState === 'failed') {
          setError('WebRTC接続に失敗しました。バックエンドとネットワーク設定を確認してください。')
          void teardown(true).finally(() => setState('failed'))
        }
      })

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIceGatheringComplete(pc)
      if (!pc.localDescription) {
        throw new Error('SDP offerを作成できませんでした。')
      }

      const answer = await exchangeOffer(pc.localDescription)
      sessionIdRef.current = answer.sessionId
      await pc.setRemoteDescription({ sdp: answer.sdp, type: answer.type })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(message)
      setState('failed')
      await teardown(true)
      setState('failed')
    }
  }, [sendConfig, teardown])

  const stop = useCallback(async () => {
    await teardown(true)
    setError(null)
  }, [teardown])

  useEffect(() => {
    return () => {
      void teardown(true)
    }
  }, [teardown])

  return {
    localStream,
    latestDetectionRef,
    detection,
    history,
    state,
    error,
    start,
    stop,
  }
}
