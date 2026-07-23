# Frontend

Open Campus motion demo frontend.

## Features

- Camera start/stop button
- WebRTC video upload to backend
- Skeleton overlay drawn on the local camera view
- Motion tabs for future actions
- Compact distance history strip under the camera
- Rich explanation panel in Japanese

## Environment

Create a `.env` from `.env.example` if needed.

- `VITE_SIGNALING_BASE_URL`: optional, empty means same-origin/proxy
- `VITE_ICE_SERVERS_JSON`: optional JSON array for RTCIceServer
- `VITE_CLAP_THRESHOLD`: optional clap threshold sent to backend

## Run

```bash
npm install
npm run dev
```
