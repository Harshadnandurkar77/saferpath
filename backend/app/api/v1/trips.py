import json
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db, get_transactional_db
from app.models.routing import Route
from app.modules.routing.schemas import Point
from app.modules.trips.schemas import (
    DeviationResponseRequest,
    DeviationResponseResult,
    EmergencyHandoffActionRequest,
    EmergencyHandoffCreateRequest,
    EmergencyHandoffSummary,
    SharingGrantCreateRequest,
    SharingGrantResponse,
    TripActionRequest,
    TripCreateRequest,
    TripEventRequest,
    TripPollResponse,
    TripResponse,
    TrustedContactCreateRequest,
    TrustedContactResponse,
    TrustedContactVerifyRequest,
)
from app.modules.trips.service import TripFailure, TripService
from app.schemas.errors import ErrorEnvelope

router = APIRouter(tags=["trips"])
service = TripService()


@router.post("/emergency/handoff/{handoff_id}/action", response_model=EmergencyHandoffSummary)
def emergency_handoff_action(handoff_id: str, request: Request, payload: EmergencyHandoffActionRequest, db: Session = Depends(get_transactional_db)) -> EmergencyHandoffSummary | JSONResponse:
    try:
        return service.emergency_handoff_action(db, handoff_id, payload)
    except TripFailure as exc:
        return failure(request, exc)

@router.post("/emergency/handoff", response_model=EmergencyHandoffSummary, status_code=status.HTTP_201_CREATED)
def create_emergency_handoff(request: Request, payload: EmergencyHandoffCreateRequest, db: Session = Depends(get_transactional_db)) -> EmergencyHandoffSummary | JSONResponse:
    try:
        return service.create_emergency_handoff(db, payload)
    except TripFailure as exc:
        return failure(request, exc)
FAILURES = {
    "not_found": (404, "TRIP_NOT_FOUND", "Trip was not found."),
    "route_not_found": (404, "ROUTE_NOT_FOUND", "Selected route was not found."),
    "access_denied": (403, "TRIP_ACCESS_DENIED", "Trip access is not permitted."),
    "invalid_route": (422, "TRIP_ROUTE_INVALID", "Selected route is not valid for this trip."),
    "expired": (410, "TRIP_EXPIRED", "Trip data is no longer available."),
    "stopped": (409, "TRIP_STOPPED", "Trip is no longer active."),
    "invalid_transition": (409, "TRIP_STATE_INVALID", "Trip state does not allow this action."),
    "idempotency_conflict": (
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key was used for a different request.",
    ),
    "location_not_permitted": (
        403,
        "LOCATION_NOT_PERMITTED",
        "Location sharing is not permitted for this trip.",
    ),
    "stream_closed": (410, "TRIP_STREAM_CLOSED", "Trip stream is no longer available."),
    "explicit_action_required": (422, "EXPLICIT_ACTION_REQUIRED", "Emergency handoff requires explicit user action."),
    "handoff_not_found": (404, "HANDOFF_NOT_FOUND", "Emergency handoff was not found."),
    "handoff_expired": (410, "HANDOFF_EXPIRED", "Emergency handoff has expired."),
    "handoff_invalid_state": (409, "HANDOFF_STATE_INVALID", "Handoff state does not allow this action."),
    "contact_not_found": (404, "CONTACT_NOT_FOUND", "Trusted contact was not found."),
    "contact_conflict": (409, "CONTACT_CONFLICT", "Trusted contact already exists."),
    "contact_revoked": (409, "CONTACT_REVOKED", "Trusted contact has been revoked."),
    "verification_expired": (410, "VERIFICATION_EXPIRED", "Verification token has expired."),
    "invalid_verification": (400, "INVALID_VERIFICATION", "Verification token is invalid."),
    "verification_delivery_unavailable": (503, "VERIFICATION_DELIVERY_UNAVAILABLE", "Verification delivery is unavailable."),
    "contact_not_verified": (409, "CONTACT_NOT_VERIFIED", "Trusted contact is not verified."),
    "grant_not_found": (404, "GRANT_NOT_FOUND", "Sharing grant was not found."),
    "grant_conflict": (409, "GRANT_CONFLICT", "Sharing grant already exists for this contact."),
    "grant_revoked": (409, "GRANT_REVOKED", "Sharing grant has been revoked."),
    "grant_expired": (410, "GRANT_EXPIRED", "Sharing grant has expired."),
    "scope_not_permitted": (403, "SCOPE_NOT_PERMITTED", "Scope is not permitted under this grant."),
    "deviation_not_found": (404, "DEVIATION_NOT_FOUND", "Active deviation was not found for this trip."),
    "demo_unavailable": (404, "DEMO_UNAVAILABLE", "Demo deviation is unavailable in this environment."),
}


def failure(request: Request, exc: TripFailure) -> JSONResponse:
    status_code, code, message = FAILURES.get(
        exc.category, (500, "TRIP_INTERNAL_ERROR", "Trip could not be completed.")
    )
    return JSONResponse(
        status_code=status_code,
        content=ErrorEnvelope(
            error={"code": code, "message": message, "request_id": request.state.request_id}
        ).model_dump(exclude_none=True),
    )


# ------------------------------------------------------------------
# Trip Core Endpoints
# ------------------------------------------------------------------


@router.post("/trips", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    request: Request, payload: TripCreateRequest, db: Session = Depends(get_transactional_db)
) -> TripResponse | JSONResponse:
    try:
        return service.create(db, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/trips/{trip_id}/events", response_model=TripResponse)
def trip_event(
    trip_id: str,
    request: Request,
    payload: TripEventRequest,
    session_id: str = Query(min_length=1, max_length=128),
    db: Session = Depends(get_transactional_db),
) -> TripResponse | JSONResponse:
    try:
        return service.event(db, trip_id, session_id, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/trips/{trip_id}/check-in", response_model=TripResponse)
def check_in(
    trip_id: str,
    request: Request,
    payload: TripActionRequest,
    db: Session = Depends(get_transactional_db),
) -> TripResponse | JSONResponse:
    try:
        return service.checkin(db, trip_id, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/trips/{trip_id}/stop", response_model=TripResponse)
def stop_trip(
    trip_id: str,
    request: Request,
    payload: TripActionRequest,
    db: Session = Depends(get_transactional_db),
) -> TripResponse | JSONResponse:
    try:
        return service.stop(db, trip_id, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.get("/trips/{trip_id}", response_model=TripPollResponse)
def get_trip(
    trip_id: str,
    request: Request,
    session_id: str = Query(min_length=1, max_length=128),
    db: Session = Depends(get_transactional_db),
) -> TripPollResponse | JSONResponse:
    try:
        return service.poll(db, trip_id, session_id)
    except TripFailure as exc:
        return failure(request, exc)


@router.get("/trips/{trip_id}/stream", response_model=None)
def trip_stream(
    trip_id: str,
    request: Request,
    session_id: str = Query(min_length=1, max_length=128),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    db: Session = Depends(get_db),
) -> StreamingResponse | JSONResponse:
    try:
        trip = service.owned(db, trip_id, session_id)
        if trip.status in {"STOPPED", "COMPLETED", "EXPIRED"}:
            raise TripFailure("stream_closed")
        events = service.stream_events(db, trip, last_event_id)
    except TripFailure as exc:
        return failure(request, exc)

    def body() -> Iterator[str]:
        for event in events:
            # Only the already-redacted, client-intended event fields leave this boundary.
            yield f"id: {event.event_id}\nevent: {event.event_type}\ndata: {json.dumps({'type': event.event_type, 'occurred_at': event.occurred_at.isoformat(), 'payload': event.redacted_payload}, separators=(',', ':'))}\n\n"
        if trip.last_update_at < datetime.now(UTC) - timedelta(
            minutes=get_settings().trip_stale_minutes
        ):
            yield "event: trip_stale\ndata: {\"stale\":true}\n\n"
        yield ": heartbeat\n\n"

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ------------------------------------------------------------------
# Smart Active Deviation Endpoints
# ------------------------------------------------------------------


@router.post("/trips/{trip_id}/deviation-response", response_model=DeviationResponseResult)
def respond_to_deviation(
    trip_id: str,
    request: Request,
    payload: DeviationResponseRequest,
    db: Session = Depends(get_transactional_db),
) -> DeviationResponseResult | JSONResponse:
    try:
        return service.respond_deviation(db, trip_id, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/trips/{trip_id}/demo-deviation", response_model=TripPollResponse)
def trigger_demo_deviation(
    trip_id: str,
    request: Request,
    session_id: str = Query(min_length=1, max_length=128),
    db: Session = Depends(get_transactional_db),
) -> TripPollResponse | JSONResponse:
    try:
        if get_settings().app_env.lower() in {"production", "release"}:
            raise TripFailure("demo_unavailable")
        trip = service.owned(db, trip_id, session_id)
        if trip.status not in {"ACTIVE", "DEVIATED"}:
            raise TripFailure("invalid_transition")
        pt_coords = db.execute(
            select(func.ST_X(func.ST_StartPoint(Route.geometry)), func.ST_Y(func.ST_StartPoint(Route.geometry)))
            .where(Route.id == trip.route_id)
        ).first()
        if pt_coords and pt_coords[0] is not None and pt_coords[1] is not None:
            dev_point = Point(longitude=float(pt_coords[0]) + 0.02, latitude=float(pt_coords[1]) + 0.02)
        else:
            dev_point = Point(longitude=72.90, latitude=19.10)

        now = datetime.now(UTC)
        event_payload = TripEventRequest(
            event_id=f"demo-dev-{uuid.uuid4().hex[:16]}",
            idempotency_key=f"demo-dev-idemp-{uuid.uuid4().hex[:16]}",
            event_type="TRIP_UPDATED",
            actor="USER",
            occurred_at=now,
            location=dev_point,
        )
        service.event(db, trip_id, session_id, event_payload)
        return service.poll(db, trip_id, session_id)
    except TripFailure as exc:
        return failure(request, exc)


# ------------------------------------------------------------------
# Trusted Contacts Endpoints
# ------------------------------------------------------------------


@router.post(
    "/trusted-contacts",
    response_model=TrustedContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_trusted_contact(
    request: Request,
    payload: TrustedContactCreateRequest,
    db: Session = Depends(get_transactional_db),
) -> TrustedContactResponse | JSONResponse:
    try:
        return service.create_contact(db, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.get("/trusted-contacts", response_model=list[TrustedContactResponse])
def list_trusted_contacts(
    request: Request,
    session_id: str = Query(min_length=1, max_length=128),
    db: Session = Depends(get_transactional_db),
) -> list[TrustedContactResponse] | JSONResponse:
    try:
        return service.list_contacts(db, session_id)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/trusted-contacts/{contact_id}/verify", response_model=TrustedContactResponse)
def verify_trusted_contact(
    contact_id: str,
    request: Request,
    payload: TrustedContactVerifyRequest,
    db: Session = Depends(get_transactional_db),
) -> TrustedContactResponse | JSONResponse:
    try:
        return service.verify_contact(db, contact_id, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/trusted-contacts/{contact_id}/revoke", response_model=TrustedContactResponse)
def revoke_trusted_contact(
    contact_id: str,
    request: Request,
    session_id: str = Query(min_length=1, max_length=128),
    db: Session = Depends(get_transactional_db),
) -> TrustedContactResponse | JSONResponse:
    try:
        return service.revoke_contact(db, contact_id, session_id)
    except TripFailure as exc:
        return failure(request, exc)


# ------------------------------------------------------------------
# Sharing Grants Endpoints
# ------------------------------------------------------------------


@router.post(
    "/sharing-grants",
    response_model=SharingGrantResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sharing_grant(
    request: Request,
    payload: SharingGrantCreateRequest,
    db: Session = Depends(get_transactional_db),
) -> SharingGrantResponse | JSONResponse:
    try:
        return service.create_grant(db, payload)
    except TripFailure as exc:
        return failure(request, exc)


@router.post("/sharing-grants/{grant_id}/revoke", response_model=SharingGrantResponse)
def revoke_sharing_grant(
    grant_id: str,
    request: Request,
    session_id: str = Query(min_length=1, max_length=128),
    db: Session = Depends(get_transactional_db),
) -> SharingGrantResponse | JSONResponse:
    try:
        return service.revoke_grant(db, grant_id, session_id)
    except TripFailure as exc:
        return failure(request, exc)


# ------------------------------------------------------------------
# Contact-Scoped Trip Access & Stream via Share Token
# ------------------------------------------------------------------


@router.get("/shared-trips/{share_token}", response_model=TripPollResponse)
def get_shared_trip(
    share_token: str,
    request: Request,
    db: Session = Depends(get_transactional_db),
) -> TripPollResponse | JSONResponse:
    try:
        grant, trip, _ = service.validate_grant_access(db, share_token)
        poll_resp = service.poll(db, trip.public_reference, trip.owner_session_id)
        # Apply scope privacy filtering
        if grant.scope == "STATUS_ONLY" and poll_resp.deviation:
            # Mask detailed coordinate or context info if not permitted
            poll_resp.deviation.explanation = None
        if grant.scope == "STATUS_ONLY" and poll_resp.emergency_handoff:
            poll_resp.emergency_handoff = {"status": poll_resp.emergency_handoff["status"]}
        return poll_resp
    except TripFailure as exc:
        return failure(request, exc)


@router.get("/shared-trips/{share_token}/stream", response_model=None)
def shared_trip_stream(
    share_token: str,
    request: Request,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    db: Session = Depends(get_db),
) -> StreamingResponse | JSONResponse:
    try:
        grant, trip, _ = service.validate_grant_access(db, share_token)
        if trip.status in {"STOPPED", "COMPLETED", "EXPIRED"}:
            raise TripFailure("stream_closed")
        filtered_events = service.stream_grant_events(db, grant, last_event_id)
    except TripFailure as exc:
        return failure(request, exc)

    def body() -> Iterator[str]:
        for event in filtered_events:
            yield f"id: {event['id']}\nevent: {event['event']}\ndata: {json.dumps(event, separators=(',', ':'))}\n\n"
        if trip.last_update_at < datetime.now(UTC) - timedelta(
            minutes=get_settings().trip_stale_minutes
        ):
            yield 'event: trip_stale\ndata: {"stale":true}\n\n'
        yield ": heartbeat\n\n"

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
