type OfferResponse = {
  sdp: string;
  type: RTCSdpType;
  session_id: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export const requestOfferAnswer = async (offer: RTCSessionDescriptionInit) => {
  const response = await fetch(`${apiBaseUrl}/api/webrtc/offer/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offer),
  });

  if (!response.ok) {
    throw new Error(`failed to negotiate WebRTC: ${response.status}`);
  }

  return (await response.json()) as OfferResponse;
};

export const closeSession = async (sessionId: string) => {
  await fetch(`${apiBaseUrl}/api/webrtc/sessions/${sessionId}/close/`, {
    method: 'POST',
  }).catch(() => undefined);
};
