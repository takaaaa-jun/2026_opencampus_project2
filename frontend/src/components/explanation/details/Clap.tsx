import { useMemo, useRef } from 'react';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { useHandLandmarker } from '../../../hooks/useHandLandmarker';
import { VideoPanel } from '../../video/VideoPanel';
import { DistanceBar } from '../../video/DistanceBar';
import type { DetectionData } from '../../../features/detection/types';

const selectDetection = (
  backendDetection: DetectionData | null,
  localDetection: DetectionData | null,
): DetectionData | null => {
  const backendHasUsefulData = Boolean(
    backendDetection && (backendDetection.hands.length > 0 || backendDetection.pose?.landmarks?.length),
  );
  return backendHasUsefulData ? backendDetection : localDetection ?? backendDetection;
};

type FlowStep = {
  title: string;
  description: string;
  active: boolean;
};

export const Clap = () => {
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const { connect, disconnect, backendDetection, backendState, cameraActive, error } = useWebRTC(cameraRef);
  const localDetection = useHandLandmarker(cameraRef, cameraActive);

  const detection = useMemo(
    () => selectDetection(backendDetection, localDetection),
    [backendDetection, localDetection],
  );

  const clap = detection?.actions.clap;
  const liveClap = localDetection?.actions.clap ?? clap;
  const distance = liveClap?.metrics?.middleFingertipDistance ?? null;
  const threshold = liveClap?.metrics?.threshold ?? clap?.metrics?.threshold ?? 90;
  const maxDistance = Math.max(threshold * 2.2, 260);

  const statusText = cameraActive
    ? backendState === 'connected'
      ? 'LIVE'
      : backendState === 'connecting'
        ? 'CONNECTING'
        : 'CAMERA'
    : 'IDLE';

  const flowSteps: FlowStep[] = [
    {
      title: 'カメラを開始',
      description: 'ブラウザで映像を取得して、デモの入口を開きます。',
      active: cameraActive,
    },
    {
      title: '映像を送信',
      description: backendState === 'connected' ? 'WebRTC でフレームをバックエンドへ送っています。' : '接続を準備しています。',
      active: backendState === 'connecting' || backendState === 'connected',
    },
    {
      title: '骨格を検出',
      description: '手や体のランドマークを AI が読み取ります。',
      active: Boolean(detection?.hands.length || detection?.pose?.landmarks?.length),
    },
    {
      title: '中指先端の間隔を計算',
      description: distance == null ? '両手がそろうと距離を算出します。' : `${distance.toFixed(1)} px を表示中です。`,
      active: distance != null,
    },
    {
      title: '反応を表示',
      description: clap?.triggered ? '拍手の瞬間にフラッシュを出しています。' : 'しきい値をまたぐと反応します。',
      active: Boolean(clap?.triggered),
    },
  ];

  return (
    <section className="panel panel--video panel--clap">
      <div className="clap-main">
        <div className="clap-visual">
          <VideoPanel cameraRef={cameraRef} detection={detection} />

          <div className="distance-card distance-card--inside clap-distance-wrap">
            <DistanceBar distance={distance} threshold={threshold} maxDistance={maxDistance} />
          </div>
        </div>

        <aside className="clap-side">
          <div className="panel__actions panel__actions--inline clap-side__top">
            <span className={`status-pill status-pill--${cameraActive ? 'live' : 'idle'}`}>{statusText}</span>
            <button type="button" onClick={cameraActive ? disconnect : connect} className="primary-button">
              {cameraActive ? 'カメラを停止' : 'カメラを開始'}
            </button>
          </div>

          <p className="clap-side__summary">
            現在の判定 <strong>{clap?.active ? 'CLAP' : 'OPEN'}</strong>
            <span>距離 <strong>{distance == null ? '—' : `${distance.toFixed(1)} px`}</strong></span>
            <span>しきい値 <strong>{threshold.toFixed(1)} px</strong></span>
          </p>

          <div className="clap-flow">
            <div className="eyebrow clap-flow__eyebrow">PROCESS FLOW</div>
            <h3 className="clap-flow__title">処理の流れ</h3>
            <div className="clap-flow__track" aria-label="processing flow">
              {flowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className={step.active ? 'clap-flow__step clap-flow__step--active' : 'clap-flow__step'}
                >
                  <div className="clap-flow__node">
                    <span>{index + 1}</span>
                  </div>
                  <div className="clap-flow__content">
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {error ? <p className="panel__error panel__error--bottom">{error}</p> : null}
    </section>
  );
};
