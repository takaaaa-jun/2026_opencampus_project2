import { useEffect, useRef } from 'react'

type VideoPanelProps = {
  cameraStream: MediaStream | null
  skeletonStream: MediaStream | null
}

export function VideoPanel({ cameraStream, skeletonStream }: VideoPanelProps) {
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
    <div className="video-panel">
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
  )
}
