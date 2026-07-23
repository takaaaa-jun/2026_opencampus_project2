import { useMemo, useRef, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useHandLandmarker } from '../hooks/useHandLandmarker';
import { VideoPanel } from '../components/video/VideoPanel';
import { ExplanationPanel } from '../components/explanation/ExplanationPanel';
import type { MotionKey } from '../components/explanation/MotionTabs';
import { DistanceBar } from '../components/video/DistanceBar';
import type { DetectionData } from '../features/detection/types';

const selectDetection = (
  backendDetection: DetectionData | null,
  localDetection: DetectionData | null,
): DetectionData | null => {
  const backendHasUsefulData = Boolean(
    backendDetection && (backendDetection.hands.length > 0 || backendDetection.pose?.landmarks?.length),
  );
  return backendHasUsefulData ? backendDetection : localDetection ?? backendDetection;
};

export default function DemoPage() {
  const [motion, setMotion] = useState<MotionKey>('clap');
  const cameraRef = useRef<HTMLVideoElement | null>(null);

  const { connect, disconnect, backendDetection, backendState, cameraActive, error } = useWebRTC(cameraRef);
  const localDetection = useHandLandmarker(cameraRef, cameraActive);

  const detection = useMemo(
    () => selectDetection(backendDetection, localDetection),
    [backendDetection, localDetection],
  );

  const clap = detection?.actions.clap;
  const distance = clap?.metrics?.middleFingertipDistance ?? null;
  const threshold = clap?.metrics?.threshold ?? 90;
  const maxDistance = Math.max(threshold * 2.2, 260);

  const statusText = cameraActive
    ? backendState === 'connected'
      ? 'LIVE'
      : backendState === 'connecting'
        ? 'CONNECTING'
        : 'CAMERA'
    : 'IDLE';

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="hero__eyebrow">React + MediaPipe Tasks Vision</p>
        <h1>AIが動きを読み取るデモ</h1>
        <p className="hero__text">
          カメラに映る手や体の動きを AI がその場で読み取り、骨格の重ね表示と判定の根拠を一緒に見せるデモです。
          ひと目で「どこを見ているのか」が伝わるように、映像と説明を同じ画面にまとめています。
        </p>
      </section>

      <div className="layout-grid">
        <div className="layout-grid__main">
          <VideoPanel
            cameraRef={cameraRef}
            detection={detection}
            onStart={connect}
            onStop={disconnect}
            started={cameraActive}
            statusText={statusText}
            backendState={backendState}
            error={error}
          />

          <div className="distance-card">
            <DistanceBar distance={distance} threshold={threshold} maxDistance={maxDistance} />
          </div>
        </div>

        <ExplanationPanel motion={motion} onMotionChange={setMotion} latestDetection={detection} />
      </div>
    </main>
  );
}
