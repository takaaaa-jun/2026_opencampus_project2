from __future__ import annotations

import hashlib
import shutil
import sys
import urllib.request
from pathlib import Path

MODELS = {
    "hand_landmarker.task": (
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
        "hand_landmarker/float16/1/hand_landmarker.task"
    ),
    "pose_landmarker_lite.task": (
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
        "pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path) -> None:
    if destination.is_file() and destination.stat().st_size > 0:
        print(
            f"skip: {destination} "
            f"({destination.stat().st_size} bytes, sha256={sha256(destination)})"
        )
        return

    print(f"download: {url}")
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "open-campus-model-downloader/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            with temporary.open("wb") as output:
                shutil.copyfileobj(response, output)
        if temporary.stat().st_size == 0:
            raise RuntimeError(f"Downloaded an empty file from {url}")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)

    print(
        f"saved: {destination} "
        f"({destination.stat().st_size} bytes, sha256={sha256(destination)})"
    )


def main() -> int:
    model_dir = Path(__file__).resolve().parent.parent / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    try:
        for filename, url in MODELS.items():
            download(url, model_dir / filename)
    except Exception as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
