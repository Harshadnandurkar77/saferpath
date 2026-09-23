import re
from uuid import uuid4

from sqlalchemy import text

from app.db.session import SessionLocal


def _login(client, capsys, email: str) -> str:
    assert client.post("/v1/auth/codes", json={"email": email}).status_code == 202
    output = capsys.readouterr().out
    match = re.search(r"\[DEV OTP\] (\d{6})", output)
    assert match is not None
    assert email not in output
    assert "token" not in output.lower()
    response = client.post("/v1/auth/verify", json={"email": email, "code": match.group(1)})
    assert response.status_code == 200
    return response.json()["session_token"]


def test_authenticated_api_session_lifecycle(client, capsys):
    """The same current bearer works across profile/consent and rotates after logout."""
    email = f"auth-api-{uuid4()}@example.test"
    token_a = _login(client, capsys, email)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    assert client.get("/v1/profile", headers=headers_a).status_code == 200
    assert client.patch(
        "/v1/profile",
        headers=headers_a,
        json={"display_name": "Test traveller", "traveller_type": "SKIP"},
    ).status_code == 200
    assert client.post(
        "/v1/consents",
        headers=headers_a | {"Idempotency-Key": f"consent-{uuid4()}"},
        json={"purpose": "ACTIVE_TRIP_LOCATION", "granted": True, "scope": {}, "policy_version": "2026-01"},
    ).status_code == 200
    assert client.get("/v1/consents", headers=headers_a).status_code == 200

    assert client.post("/v1/auth/revoke", headers=headers_a).status_code == 204
    assert client.get("/v1/profile", headers=headers_a).status_code == 401

    token_b = _login(client, capsys, email)
    assert token_b != token_a
    assert client.get("/v1/profile", headers={"Authorization": f"Bearer {token_b}"}).status_code == 200

    with SessionLocal.begin() as db:
        db.execute(text("DELETE FROM consent_records"))
        db.execute(text("DELETE FROM user_profiles"))
        db.execute(text("DELETE FROM user_sessions"))
        db.execute(text("DELETE FROM authentication_codes"))
        db.execute(text("DELETE FROM users"))
