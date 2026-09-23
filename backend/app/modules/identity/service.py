import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.identity import (
    AuthenticationCode,
    ConsentRecord,
    User,
    UserProfile,
    UserSession,
)


class AuthenticationFailure(Exception):
    pass


def protected(value: str) -> str:
    return hmac.new(get_settings().auth_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


class FixtureAuthenticationCodeProvider:
    """Development/test boundary. Never construct this provider in production."""
    def __init__(self) -> None:
        self.last_code: str | None = None

    def generate(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def send(self, _email: str, code: str) -> None:
        self.last_code = code
        if get_settings().app_env.lower() not in {"production", "release"}:
            print(f"[DEV OTP] {code}", flush=True)


class AuthenticationService:
    def __init__(self, provider: FixtureAuthenticationCodeProvider) -> None:
        self.provider = provider

    def request_code(self, db: Session, email: str) -> None:
        now = datetime.now(UTC)
        email_key = protected(email.strip().lower())
        recent = db.scalar(select(AuthenticationCode).where(AuthenticationCode.email_key == email_key).order_by(AuthenticationCode.created_at.desc()))
        if (
            recent
            and recent.consumed_at is None
            and recent.created_at
            and recent.created_at > now - timedelta(seconds=get_settings().auth_code_resend_cooldown_seconds)
        ):
            return  # neutral response and resend bound
        code = self.provider.generate() if hasattr(self.provider, "generate") else f"{secrets.randbelow(1_000_000):06d}"
        db.add(AuthenticationCode(email_key=email_key, code_hash=protected(code), expires_at=now + timedelta(minutes=get_settings().auth_code_ttl_minutes)))
        db.flush()
        self.provider.send(email, code)

    def verify(self, db: Session, email: str, code: str) -> str:
        now = datetime.now(UTC)
        email_key = protected(email.strip().lower())
        record = db.scalar(select(AuthenticationCode).where(AuthenticationCode.email_key == email_key).order_by(AuthenticationCode.created_at.desc()).with_for_update())
        if not record or record.consumed_at or record.expires_at <= now or record.attempts >= get_settings().auth_code_max_attempts:
            raise AuthenticationFailure("invalid_code")
        record.attempts += 1
        if not hmac.compare_digest(record.code_hash, protected(code)):
            raise AuthenticationFailure("invalid_code")
        record.consumed_at = now
        user = db.scalar(select(User).where(User.email_key == email_key))
        if not user:
            user = User(public_id=f"usr_{uuid.uuid4().hex}", email_key=email_key)
            db.add(user)
            db.flush()
        db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)).update({UserSession.revoked_at: now})
        secret = secrets.token_urlsafe(32)
        session = UserSession(user_id=user.id, secret_hash=protected(secret), expires_at=now + timedelta(hours=get_settings().session_ttl_hours), last_seen_at=now)
        db.add(session)
        db.flush()
        return f"sp1.{session.id}.{secret}"

    def profile(self, db: Session, user: User) -> UserProfile | None:
        return db.get(UserProfile, user.id)

    def onboarding_complete(self, db: Session, user: User) -> bool:
        # A minimal account is usable; selecting a traveller type completes the optional onboarding flow.
        profile = self.profile(db, user)
        return bool(profile and profile.traveller_type)

    def account(self, db: Session, user: User) -> dict:
        profile = self.profile(db, user)
        complete = self.onboarding_complete(db, user)
        return {"public_id": user.public_id, "display_name": profile.display_name if profile else None,
                "verified_identifier": True, "account_status": user.status, "onboarding_complete": complete,
                "route_planning_available": True}

    def update_profile(self, db: Session, user: User, values: dict, clear_fields: set[str]) -> UserProfile:
        profile = self.profile(db, user)
        if not profile:
            profile = UserProfile(user_id=user.id, accessibility_preferences={}, profile_data={})
            db.add(profile)
            db.flush()
        for field in clear_fields:
            setattr(profile, field, {} if field in {"accessibility_preferences", "profile_data"} else None)
        for field, value in values.items():
            if field not in clear_fields and value is not None:
                setattr(profile, field, value)
        return profile

    def consent(self, db: Session, user: User, payload: dict, idempotency_key: str | None) -> ConsentRecord:
        if idempotency_key:
            old = db.scalar(select(ConsentRecord).where(ConsentRecord.user_id == user.id, ConsentRecord.idempotency_key == idempotency_key))
            if old:
                return old
        now = datetime.now(UTC)
        item = ConsentRecord(user_id=user.id, idempotency_key=idempotency_key, actor="USER", **payload,
                             granted_at=now if payload["granted"] else None, withdrawn_at=now if not payload["granted"] else None)
        db.add(item)
        db.flush()
        return item

    def current(self, db: Session, token: str) -> User:
        try:
            prefix, identifier, secret = token.split(".", 2)
            if prefix != "sp1":
                raise ValueError
            session = db.get(UserSession, uuid.UUID(identifier))
        except (ValueError, AttributeError):
            raise AuthenticationFailure("invalid_session") from None
        now = datetime.now(UTC)
        if not session or session.revoked_at or session.expires_at <= now or not hmac.compare_digest(session.secret_hash, protected(secret)):
            raise AuthenticationFailure("invalid_session")
        session.last_seen_at = now
        user = db.get(User, session.user_id)
        if not user or user.status != "ACTIVE":
            raise AuthenticationFailure("invalid_session")
        return user

    def revoke(self, db: Session, token: str) -> None:
        self.current(db, token)
        identifier = token.split(".", 2)[1]
        db.get(UserSession, uuid.UUID(identifier)).revoked_at = datetime.now(UTC)
