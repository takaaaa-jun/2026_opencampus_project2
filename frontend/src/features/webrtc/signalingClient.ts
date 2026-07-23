interface OfferResponse {
  sdp: string
  type: RTCSdpType
  sessionId: string
}

const baseUrl = (import.meta.env.VITE_SIGNALING_BASE_URL ?? '').replace(/\/$/, '')

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; detail?: string }
    return payload.error ?? payload.detail ?? `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

export async function exchangeOffer(description: RTCSessionDescriptionInit): Promise<OfferResponse> {
  const response = await fetch(`${baseUrl}/api/webrtc/offer/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(description),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return (await response.json()) as OfferResponse
}

export async function closeRemoteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/webrtc/sessions/${sessionId}/close/`, {
    method: 'POST',
    keepalive: true,
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
}
