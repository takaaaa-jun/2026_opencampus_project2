from __future__ import annotations

from app.core.config import Settings


def test_cors_origins_support_comma_separated_values() -> None:
    settings = Settings(
        cors_allowed_origins="http://localhost:5173,http://127.0.0.1:5173"
    )
    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_cors_origins_support_json_array() -> None:
    settings = Settings(
        cors_allowed_origins='["https://example.com", "https://demo.example.com"]'
    )
    assert settings.cors_origins == [
        "https://example.com",
        "https://demo.example.com",
    ]
