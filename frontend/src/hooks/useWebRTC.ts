import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { closeSession, requestOfferAnswer } from '../features/webrtc/signalingClient';
import { parseDetectionMessage } from '../features/detection/parseDetectionMessage';
import type { DetectionData } from '../features/detection/types';

type BackendState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export const useWebRTC = (videoRef: RefObject<HTMLVideoElement | null>) => {
  const [backendState, setBackendState] = useState<BackendState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [backendDetection, setBackendDetection] = useState<DetectionData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const stopCamera = useCallback(async () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, [videoRef]);

  const stopBackend = useCallback(async () => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;

    if (sessionIdRef.current) {
      await closeSession(sessionIdRef.current);
      sessionIdRef.current = null;
      setSessionId(null);
    }
  }, []);

  const disconnect = useCallback(async () => {
    startedRef.current = false;
    await stopBackend();
    await stopCamera();
    setBackendDetection(null);
    setBackendState('idle');
    setError(null);
  }, [stopBackend, stopCamera]);

  useEffect(() => () => {
    void disconnect();
  }, [disconnect]);

  const connect = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setError(null);
    setBackendState('connecting');
    setCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      localStreamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = pc.createDataChannel('detections', {
        ordered: false,
        maxRetransmits: 0,
      });
      dataChannelRef.current = channel;

      channel.onmessage = (event) => {
        const parsed = parseDetectionMessage(String(event.data));
        if (!parsed) return;
        setBackendDetection(parsed);
      };
      channel.onopen = () => setBackendState('connected');
      channel.onerror = () => setBackendState('error');
      channel.onclose = () => {
        if (startedRef.current) setBackendState('disconnected');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setBackendState(pc.connectionState === 'failed' ? 'error' : 'disconnected');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const answer = await requestOfferAnswer(offer);
      sessionIdRef.current = answer.session_id;
      setSessionId(answer.session_id);
      await pc.setRemoteDescription(answer);
    } catch (err) {
      console.error(err);
      setBackendState('error');
      setError(err instanceof Error ? err.message : 'WebRTC connection failed');
      if (!localStreamRef.current) {
        startedRef.current = false;
        setCameraActive(false);
      }
      // Keep camera open so the local fallback detection still works when possible.
    }
  }, [videoRef]);

  const sendConfig = useCallback((payload: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify({ type: 'config', config: payload }));
  }, []);

  const values = useMemo(
    () => ({
      backendState,
      error,
      sessionId,
      backendDetection,
      cameraActive,
    }),
    [backendState, error, sessionId, backendDetection, cameraActive],
  );

  return {
    ...values,
    connect,
    disconnect,
    sendConfig,
  };
};
