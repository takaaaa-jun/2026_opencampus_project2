from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Open Campus Motion Detection API"
    app_version: str = "1.0.0"
    debug: bool = False
    log_level: str = "INFO"

    cors_allowed_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    mediapipe_max_analysis_fps: float = Field(default=15.0, ge=1.0, le=60.0)
    clap_threshold: float = Field(default=0.12, ge=0.03, le=0.5)
    hand_landmarker_model: Path = BACKEND_DIR / "models" / "hand_landmarker.task"
    pose_landmarker_model: Path = (
        BACKEND_DIR / "models" / "pose_landmarker_lite.task"
    )

    webrtc_ice_gathering_timeout_seconds: float = Field(
        default=5.0, ge=0.1, le=30.0
    )
    webrtc_disconnect_grace_seconds: float = Field(default=10.0, ge=0.0, le=120.0)
    data_channel_max_buffered_amount: int = Field(
        default=512_000, ge=16_384, le=16_777_216
    )
    frame_is_mirrored_in_ui: bool = True

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("hand_landmarker_model", "pose_landmarker_model", mode="before")
    @classmethod
    def resolve_model_path(cls, value: Any) -> Path:
        path = Path(value).expanduser()
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_allowed_origins.strip()
        if not raw:
            return []
        if raw.startswith("["):
            parsed = json.loads(raw)
            if not isinstance(parsed, list) or not all(
                isinstance(item, str) for item in parsed
            ):
                raise ValueError("CORS_ALLOWED_ORIGINS JSON must be a string array.")
            return [item.strip() for item in parsed if item.strip()]
        return [item.strip() for item in raw.split(",") if item.strip()]

    def model_files(self) -> dict[str, Path]:
        return {
            "hand": self.hand_landmarker_model,
            "pose": self.pose_landmarker_model,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
