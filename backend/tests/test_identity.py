from uuid import uuid4

import pytest

from app.db.session import SessionLocal
from app.models.identity import AuthenticationCode, ConsentRecord, User, UserProfile, UserSession
from app.modules.identity.service import (
    AuthenticationFailure,
    AuthenticationService,
    FixtureAuthenticationCodeProvider,
)


def test_one_time_code_session_rotation_and_revoke():
    provider = FixtureAuthenticationCodeProvider()
    service = AuthenticationService(provider)
    email = f"user-{uuid4()}@example.test"
    with SessionLocal.begin() as db:
        service.request_code(db, email)
        assert provider.last_code
        token = service.verify(db, email, provider.last_code)
        assert service.current(db, token).public_id.startswith("usr_")
        with pytest.raises(AuthenticationFailure):
            service.verify(db, email, provider.last_code)
        service.revoke(db, token)
        with pytest.raises(AuthenticationFailure):
            service.current(db, token)
    with SessionLocal.begin() as db:
        db.query(AuthenticationCode).delete()
        db.query(UserSession).delete()
        db.query(User).delete()


def test_progressive_profile_and_idempotent_consent_are_user_scoped():
    provider = FixtureAuthenticationCodeProvider()
    service = AuthenticationService(provider)
    email = f"profile-{uuid4()}@example.test"
    with SessionLocal.begin() as db:
        service.request_code(db, email)
        token = service.verify(db, email, provider.last_code)
        user = service.current(db, token)
        assert not service.onboarding_complete(db, user)
        profile = service.update_profile(db, user, {"traveller_type": "SKIP", "display_name": "River"}, set())
        assert profile.display_name == "River"
        assert service.onboarding_complete(db, user)
        payload = {"purpose": "ROUTE_PLANNING_LOCATION", "scope": {}, "policy_version": "2026-01", "granted": True}
        first = service.consent(db, user, payload, "request-1")
        assert service.consent(db, user, payload, "request-1").id == first.id
        assert db.query(ConsentRecord).filter(ConsentRecord.user_id == user.id).count() == 1
    with SessionLocal.begin() as db:
        db.query(AuthenticationCode).delete()
        db.query(UserSession).delete()
        db.query(UserProfile).delete()
        db.query(ConsentRecord).delete()
        db.query(User).delete()


def test_dev_otp_terminal_output_and_login(client, capsys):
    import re
    email = f"terminal-otp-{uuid4()}@example.test"

    # 1. Request OTP via /auth/codes
    res = client.post("/v1/auth/codes", json={"email": email})
    assert res.status_code == 202
    assert res.json() == {"accepted": True}

    # 2. Verify terminal output has [DEV OTP] followed by 6 digits
    captured = capsys.readouterr()
    match = re.search(r"\[DEV OTP\] (\d{6})", captured.out)
    assert match is not None, f"Expected [DEV OTP] 6-digit code in output, got: {captured.out}"
    otp_code = match.group(1)

    # 3. Ensure no sensitive details (email, hashes) are printed
    assert email not in captured.out
    assert "password" not in captured.out.lower()
    assert "token" not in captured.out.lower()

    # 4. Verify that the displayed OTP successfully logs in via /auth/verify
    verify_res = client.post("/v1/auth/verify", json={"email": email, "code": otp_code})
    assert verify_res.status_code == 200
    session_data = verify_res.json()
    assert "session_token" in session_data
    token = session_data["session_token"]

    # 5. Verify authenticated session works
    me_res = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["verified_identifier"] is True

    # 6. Verify production environment never logs OTP
    from app.core.config import get_settings
    provider = FixtureAuthenticationCodeProvider()
    original_env = get_settings().app_env
    try:
        get_settings().app_env = "production"
        provider.send(email, "999999")
        prod_captured = capsys.readouterr()
        assert "[DEV OTP]" not in prod_captured.out
    finally:
        get_settings().app_env = original_env

    # Cleanup
    with SessionLocal.begin() as db:
        db.query(AuthenticationCode).delete()
        db.query(UserSession).delete()
        db.query(UserProfile).delete()
        db.query(ConsentRecord).delete()
        db.query(User).delete()

