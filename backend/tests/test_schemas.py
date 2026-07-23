from __future__ import annotations

from app.schemas.webrtc import ClientConfigMessage, OfferResponse


def test_client_config_message_uses_camel_case() -> None:
    message = ClientConfigMessage.model_validate(
        {"type": "config", "config": {"clapThreshold": 0.2}}
    )
    assert message.as_update_mapping() == {"clapThreshold": 0.2}


def test_offer_response_serializes_session_id_alias() -> None:
    response = OfferResponse(
        sdp="answer-sdp",
        type="answer",
        sessionId="12345678-1234-5678-1234-567812345678",
    )
    payload = response.model_dump(by_alias=True, mode="json")
    assert payload["sessionId"] == "12345678-1234-5678-1234-567812345678"
