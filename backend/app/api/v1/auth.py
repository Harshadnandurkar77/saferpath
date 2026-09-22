from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.authz import current_user
from app.core.config import get_settings
from app.db.session import get_transactional_db
from app.models.identity import ConsentRecord, User
from app.modules.identity.schemas import (
    AccountResponse,
    CodeRequest,
    ConsentCreate,
    ConsentResponse,
    OnboardingStatus,
    ProfileResponse,
    ProfileUpdate,
    SessionResponse,
    VerifyRequest,
)
from app.modules.identity.service import (
    AuthenticationFailure,
    AuthenticationService,
    FixtureAuthenticationCodeProvider,
)

router = APIRouter(tags=["authentication"])
provider = FixtureAuthenticationCodeProvider()
service = AuthenticationService(provider)

def consent_response(item: ConsentRecord) -> ConsentResponse:
    return ConsentResponse(id=item.id, purpose=item.purpose, scope=item.scope, policy_version=item.policy_version, granted=item.granted, granted_at=item.granted_at, withdrawn_at=item.withdrawn_at, effective=item.granted and item.withdrawn_at is None)


@router.post("/auth/codes", status_code=202)
def request_code(payload: CodeRequest, db: Session = Depends(get_transactional_db)) -> dict:
    if get_settings().app_env.lower() in {"production", "release"}:
        raise HTTPException(status_code=503, detail="Authentication delivery is unavailable.")
    service.request_code(db, payload.email)
    return {"accepted": True}

@router.post("/auth/verify", response_model=SessionResponse)
def verify(payload: VerifyRequest, db: Session = Depends(get_transactional_db)) -> SessionResponse:
    try:
        token = service.verify(db, payload.email, payload.code)
        user = service.current(db, token)
        account = service.account(db, user)
        return SessionResponse(session_token=token, account=account, onboarding_required=not account["onboarding_complete"])
    except AuthenticationFailure as exc:
        raise HTTPException(status_code=401, detail="Authentication could not be completed.") from exc

@router.post("/auth/revoke", status_code=204)
def revoke(authorization: str | None = Header(default=None, alias="Authorization"), db: Session = Depends(get_transactional_db)) -> Response:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication could not be completed.")
    try:
        service.revoke(db, authorization[7:])
    except AuthenticationFailure as exc:
        raise HTTPException(status_code=401, detail="Authentication could not be completed.") from exc
    return Response(status_code=204)


@router.get("/auth/me", response_model=AccountResponse)
def me(user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> dict:
    return service.account(db, user)


@router.get("/profile", response_model=ProfileResponse)
def get_profile(user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> ProfileResponse:
    item = service.profile(db, user)
    return ProfileResponse.model_validate(item, from_attributes=True) if item else ProfileResponse(display_name=None, traveller_type=None, language=None, accessibility_preferences={}, profile_data={})


@router.patch("/profile", response_model=ProfileResponse)
@router.put("/profile", response_model=ProfileResponse)
def update_profile(payload: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> ProfileResponse:
    item = service.update_profile(db, user, payload.model_dump(exclude={"clear_fields"}, exclude_unset=True), payload.clear_fields)
    return ProfileResponse.model_validate(item, from_attributes=True)


@router.get("/onboarding/status", response_model=OnboardingStatus)
def onboarding_status(user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> OnboardingStatus:
    complete = service.onboarding_complete(db, user)
    return OnboardingStatus(profile_complete=complete, required_actions_remaining=[] if complete else ["choose_traveller_type_or_skip"], optional_actions_available=["display_name", "language", "accessibility_preferences", "profile_details", "location_consents"])


@router.post("/consents", response_model=ConsentResponse)
def create_consent(payload: ConsentCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"), user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> ConsentResponse:
    if idempotency_key is not None and not 1 <= len(idempotency_key) <= 128:
        raise HTTPException(status_code=422, detail="Request validation failed.")
    return consent_response(service.consent(db, user, payload.model_dump(), idempotency_key))


@router.get("/consents", response_model=list[ConsentResponse])
def list_consents(user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> list[ConsentResponse]:
    return [consent_response(item) for item in db.scalars(select(ConsentRecord).where(ConsentRecord.user_id == user.id).order_by(ConsentRecord.created_at.desc()))]


@router.post("/consents/{consent_id}/withdraw", response_model=ConsentResponse)
def withdraw_consent(consent_id: str, user: User = Depends(current_user), db: Session = Depends(get_transactional_db)) -> ConsentResponse:
    import uuid
    from datetime import UTC, datetime
    try:
        item = db.scalar(select(ConsentRecord).where(ConsentRecord.id == uuid.UUID(consent_id), ConsentRecord.user_id == user.id))
    except ValueError:
        item = None
    if not item:
        raise HTTPException(status_code=404, detail="Consent record was not found.")
    if item.withdrawn_at is None:
        item.granted, item.withdrawn_at = False, datetime.now(UTC)
    return consent_response(item)
