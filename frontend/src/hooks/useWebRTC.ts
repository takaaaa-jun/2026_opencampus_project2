import { useCallback, useEffect, useState } from 'react'

type ConnectionState = RTCPeerConnectionState | 'idle'

type OfferResponse = {
  type?: RTCSdpType
  sdp?: string
}

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
  const [detectionData, setDetectionData] = useState<Record<string, unknown> | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)

  const reconnect = useCallback(() => {
    setConnectionAttempt((current) => current + 1)
  }, [])

  useEffect(() => {
    let disposed = false
    let reconnectScheduled = false
    let peerConnection: RTCPeerConnection | null = null

    const scheduleReconnect = () => {
      if (disposed || reconnectScheduled) {
        return
      }

      reconnectScheduled = true
      window.setTimeout(() => {
        if (!disposed) {
          reconnect()
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

        const cameraTransceiver = connection.addTransceiver('video', { direction: 'recvonly' })
        const skeletonTransceiver = connection.addTransceiver('video', { direction: 'recvonly' })
        const detectionChannel = connection.createDataChannel('detection', {
          ordered: false,
          maxRetransmits: 0,
        })

        connection.addEventListener('track', (event) => {
          const stream = event.streams[0] ?? new MediaStream([event.track])

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
            setDetectionData(JSON.parse(event.data) as Record<string, unknown>)
          } catch {
            // JSONではないDataChannelメッセージは無視する。
          }
        })

        connection.addEventListener('connectionstatechange', () => {
          if (disposed || peerConnection !== connection) {
            return
          }

          setConnectionState(connection.connectionState)
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
    }
  }, [connectionAttempt, reconnect])

  return {
    cameraStream,
    skeletonStream,
    detectionData,
    connectionState,
    error,
    reconnect,
  }
}
