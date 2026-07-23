import { useCallback, useEffect, useRef, useState } from 'react'
import type { DetectionData } from '../types/detection'

type ConnectionState = RTCPeerConnectionState | 'idle'

type OfferResponse = {
  type?: RTCSdpType
  sdp?: string
}

const MAX_AUTO_RECONNECT_ATTEMPTS = 3

function waitForIceGatheringComplete(peerConnection: RTCPeerConnection): Promise<void> {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const onIceGatheringStateChange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        peerConnection.removeEventListener('icegatheringstatechange', onIceGatheringStateChange)
        resolve()
      }
    }

    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange)
  })
}

export function useWebRTC() {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [skeletonStream, setSkeletonStream] = useState<MediaStream | null>(null)
  const [detectionData, setDetectionData] = useState<DetectionData | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [autoReconnectAttempts, setAutoReconnectAttempts] = useState(0)
  const [isCameraStarted, setIsCameraStarted] = useState(false)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const startCamera = useCallback(() => {
    setIsCameraStarted(true)
    setAutoReconnectAttempts(0)
    setConnectionAttempt((current) => current + 1)
  }, [])

  const reconnect = startCamera

  const stopCamera = useCallback(() => {
    setIsCameraStarted(false)
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    setCameraStream(null)
    setSkeletonStream(null)
    setDetectionData(null)
    setConnectionState('idle')
    setError(null)
    setAutoReconnectAttempts(0)

    void fetch('/api/webrtc/close/', { method: 'POST' })
  }, [])

  useEffect(() => {
    if (!isCameraStarted) {
      return
    }

    let disposed = false
    let reconnectScheduled = false
    let peerConnection: RTCPeerConnection | null = null

    const scheduleReconnect = () => {
      if (disposed || reconnectScheduled) {
        return
      }

      if (autoReconnectAttempts >= MAX_AUTO_RECONNECT_ATTEMPTS) {
        setError('自動再接続に3回失敗しました。再接続ボタンを押してください。')
        return
      }

      reconnectScheduled = true
      window.setTimeout(() => {
        if (!disposed) {
          setAutoReconnectAttempts((current) => current + 1)
          setConnectionAttempt((current) => current + 1)
        }
      }, 1000)
    }

    const connect = async () => {
      setConnectionState('connecting')
      setError(null)
      setCameraStream(null)
      setSkeletonStream(null)
      setDetectionData(null)

      try {
        const connection = new RTCPeerConnection({ iceServers: [] })
        peerConnection = connection
        peerConnectionRef.current = connection

        const cameraTransceiver = connection.addTransceiver('video', { direction: 'recvonly' })
        const skeletonTransceiver = connection.addTransceiver('video', { direction: 'recvonly' })
        const detectionChannel = connection.createDataChannel('detection', {
          ordered: false,
          maxRetransmits: 0,
        })

        connection.addEventListener('track', (event) => {
          // aiortcが2本の映像を同じMediaStreamに含める場合でも、
          // 各video要素には対応する1本のトラックだけを設定する。
          const stream = new MediaStream([event.track])

          if (event.transceiver === cameraTransceiver) {
            setCameraStream(stream)
          }
          if (event.transceiver === skeletonTransceiver) {
            setSkeletonStream(stream)
          }
        })

        detectionChannel.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') {
            return
          }

          try {
            setDetectionData(JSON.parse(event.data) as DetectionData)
          } catch {
            // JSONではないDataChannelメッセージは無視する。
          }
        })

        connection.addEventListener('connectionstatechange', () => {
          if (disposed || peerConnection !== connection) {
            return
          }

          setConnectionState(connection.connectionState)
          if (connection.connectionState === 'connected') {
            setAutoReconnectAttempts(0)
          }
          if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
            scheduleReconnect()
          }
        })

        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        await waitForIceGatheringComplete(connection)

        const response = await fetch('/api/webrtc/offer/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(connection.localDescription),
        })

        const answer = (await response.json()) as OfferResponse
        if (!response.ok || answer.type !== 'answer' || !answer.sdp) {
          throw new Error('WebRTC Answerを取得できませんでした。')
        }

        await connection.setRemoteDescription({ type: answer.type, sdp: answer.sdp })
      } catch (connectionError) {
        if (disposed) {
          return
        }

        setConnectionState('failed')
        setError(connectionError instanceof Error ? connectionError.message : 'WebRTC接続に失敗しました。')
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      disposed = true
      peerConnection?.close()
      if (peerConnectionRef.current === peerConnection) {
        peerConnectionRef.current = null
      }
    }
  }, [autoReconnectAttempts, connectionAttempt, isCameraStarted])

  return {
    cameraStream,
    skeletonStream,
    detectionData,
    connectionState,
    error,
    isCameraStarted,
    startCamera,
    stopCamera,
    reconnect,
  }
}
