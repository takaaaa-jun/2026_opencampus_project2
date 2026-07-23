# FastAPI WebRTC backend

This backend accepts the browser camera as a WebRTC video track, analyzes the latest frame with MediaPipe Pose and Hand Landmarker, and sends landmark and action JSON over the `detections` RTCDataChannel.

## Endpoints

- `POST /api/webrtc/offer/`
- `POST /api/webrtc/sessions/{session_id}/close/`
- `GET /api/webrtc/health/`
- `GET /api/health/`
- `GET /docs`

The endpoint paths match the existing React signaling client.

## Setup with uv

```bash
cd backend
cp .env.example .env
uv sync --extra dev
uv run python scripts/download_models.py
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Setup with pip

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python scripts/download_models.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Use one Uvicorn worker because PeerConnection sessions are kept in process memory.

## Tests

```bash
pytest
ruff check app tests scripts
```

## Data flow

```text
Browser getUserMedia
  -> WebRTC video track
  -> FastAPI signaling endpoint
  -> aiortc PeerConnection
  -> latest-frame analyzer
  -> MediaPipe Pose and Hand Landmarker
  -> ActionEngine
  -> RTCDataChannel JSON
  -> React Canvas overlay
```

The analyzer queue has a maximum size of one. If inference is slower than the camera, an old pending frame is replaced by the newest frame instead of increasing latency.
