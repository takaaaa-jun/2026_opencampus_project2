import { useMemo, useRef } from 'react';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { useHandLandmarker } from '../../../hooks/useHandLandmarker';
import { VideoPanel } from '../../video/VideoPanel';
import { DistanceBar } from '../../video/DistanceBar';
import type { DetectionData } from '../../../features/detection/types';

type FlowStep = {
  title: string;
  note: string;
  active: boolean;
  done: boolean;
  triggered?: boolean;
};

const selectDetection = (
  backendDetection: DetectionData | null,
  localDetection: DetectionData | null,
): DetectionData | null => {
  const backendHasUsefulData = Boolean(
    backendDetection && (backendDetection.hands.length > 0 || backendDetection.pose?.landmarks?.length),
  );
  return backendHasUsefulData ? backendDetection : localDetection ?? backendDetection;
};

const FlowStepCard = ({ step, index }: { step: FlowStep; index: number }) => {
  const className = [
    'flow-step',
    step.done ? 'flow-step--done' : '',
    step.active ? 'flow-step--active' : '',
    step.triggered ? 'flow-step--triggered' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <div className="flow-step__dot" aria-hidden="true" />
      <div className="flow-step__content">
        <p className="flow-step__kicker">STEP {index + 1}</p>
        <h3 className="flow-step__title">{step.title}</h3>
        <p className="flow-step__note">{step.note}</p>
      </div>
    </div>
  );
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

  const hasPoseOrHands = Boolean(detection && (detection.hands.length > 0 || detection.pose?.landmarks?.length));
  const streamSent = cameraActive && backendState !== 'idle';
  const pipelineHint = streamSent
    ? '映像が流れ、骨格の検出と拍手判定が進んでいます。'
    : 'カメラを開始すると、処理の流れが上から順に光ります。';
  const detecting = Boolean(hasPoseOrHands);
  const measuring = distance != null;
  const reacting = Boolean(clap?.triggered || clap?.active);

  const steps: FlowStep[] = useMemo(
    () => [
      {
        title: 'カメラを開始',
        note: 'ブラウザのカメラを起動し、映像入力の準備をします。',
        active: cameraActive,
        done: cameraActive,
      },
      {
        title: '映像を送信',
        note: 'WebRTC でカメラ映像をバックエンドへ流します。',
        active: backendState === 'connecting' || backendState === 'connected',
        done: backendState === 'connected',
      },
      {
        title: '骨格を検出',
        note: 'MediaPipe が手や体のランドマークを読み取ります。',
        active: detecting,
        done: detecting,
      },
      {
        title: '指先の間隔を計算',
        note: '両手の中指先端の距離から、拍手に近いかを判定します。',
        active: measuring,
        done: measuring,
      },
      {
        title: '反応を表示',
        note: 'しきい値をまたいだ瞬間に、画面の反応を光らせます。',
        active: reacting,
        done: reacting,
        triggered: Boolean(clap?.triggered),
      },
    ],
    [cameraActive, backendState, detecting, measuring, reacting, clap?.triggered],
  );

  const statusText = cameraActive
    ? backendState === 'connected'
      ? 'LIVE'
      : backendState === 'connecting'
        ? 'CONNECTING'
        : 'CAMERA'
    : 'IDLE';

  return (
    <section className="panel panel--video panel--clap">
      <div className="clap-main">
        <div className="clap-visuals">
          <VideoPanel cameraRef={cameraRef} detection={detection} />

          <div className="distance-card distance-card--inside">
            <DistanceBar distance={distance} threshold={threshold} maxDistance={maxDistance} />
          </div>
        </div>

        <aside className="clap-side panel--flow">
          <div className="panel__actions panel__actions--inline clap-side__top">
            <span className={`status-pill status-pill--${cameraActive ? 'live' : 'idle'}`}>{statusText}</span>
            <button type="button" onClick={cameraActive ? disconnect : connect} className="primary-button">
              {cameraActive ? 'カメラを停止' : 'カメラを開始'}
            </button>
          </div>

          <div className="flowchart-card">
            <div className="flowchart-card__header">
              <div>
                <p className="eyebrow">Live pipeline</p>
                <h2>処理の流れ</h2>
                <p className="panel__desc">進んだ工程が光って、今どこを見ているか分かります。</p>
                <p className="panel__desc">{pipelineHint}</p>
              </div>
            </div>

            <div className="flowchart">
              {steps.map((step, index) => (
                <FlowStepCard key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {error ? <p className="panel__error panel__error--bottom">{error}</p> : null}
    </section>
  );
};
