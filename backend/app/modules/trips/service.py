import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.job_run import JobRun
from app.models.routing import Route, RouteRequest, RouteSegment
from app.models.trips import (
    EmergencyHandoff,
    NotificationDispatch,
    SharingGrant,
    TripDeviation,
    TripEvent,
    TripSession,
    TrustedContact,
)
from app.modules.context.service import SafetyContextService
from app.modules.routing.normalization import _coordinates, canonical_segment_id
from app.modules.routing.provider import ProviderRouteRequest, RoutingProviderError
from app.modules.routing.service import RouteComparisonService
from app.modules.trips.emergency import (
    EmergencyHandoffProvider,
    UnavailableEmergencyHandoffProvider,
)
from app.modules.trips.notifications import (
    NotificationMessage,
    NotificationProvider,
    UnavailableNotificationProvider,
)
from app.modules.trips.schemas import (
    DeviationResponseRequest,
    DeviationResponseResult,
    DeviationSummary,
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


class TripFailure(Exception):
    def __init__(self, category: str) -> None:
        self.category = category


class TrustedContactVerificationProvider:
    def generate(self) -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def send(self, recipient: str, code: str) -> None:
        raise NotImplementedError


class DevelopmentTrustedContactVerificationProvider(TrustedContactVerificationProvider):
    """Development/test delivery boundary; it never exposes the recipient."""

    def send(self, _recipient: str, code: str) -> None:
        if get_settings().app_env.lower() not in {"production", "release"}:
            print(f"[DEV TRUSTED CONTACT OTP] {code}", flush=True)


class UnavailableTrustedContactVerificationProvider(TrustedContactVerificationProvider):
    def send(self, _recipient: str, _code: str) -> None:
        raise TripFailure("verification_delivery_unavailable")

HANDOFF_TRANSITIONS = {"GUIDANCE_DISPLAYED": {"CALL_INITIATED", "CALL_OPENED", "CANCELLED", "EXPIRED"}, "CALL_INITIATED": {"CALL_OPENED", "FAILED", "CANCELLED", "EXPIRED"}, "CALL_OPENED": {"FAILED", "CANCELLED", "EXPIRED"}, "SUBMITTED_APPROVED_INTEGRATION": {"OFFICIAL_CONFIRMATION", "FAILED", "UNAVAILABLE", "CANCELLED", "EXPIRED"}, "OFFICIAL_CONFIRMATION": set(), "FAILED": set(), "UNAVAILABLE": set(), "CANCELLED": set(), "EXPIRED": set()}


TRANSITIONS = {
    "PLANNED": {"ACTIVE", "EXPIRED"},
    "ACTIVE": {"CHECKIN_PENDING", "DEVIATED", "MISSED_CHECKIN", "STOPPED", "COMPLETED", "EXPIRED"},
    "CHECKIN_PENDING": {"ACTIVE", "MISSED_CHECKIN", "STOPPED", "EXPIRED"},
    "DEVIATED": {"ACTIVE", "CHECKIN_PENDING", "STOPPED", "COMPLETED", "EXPIRED"},
    "MISSED_CHECKIN": {"ACTIVE", "STOPPED", "COMPLETED", "EXPIRED"},
    "STOPPED": set(),
    "COMPLETED": set(),
    "EXPIRED": set(),
}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class TripJobService:
    """Small durable boundary; a worker can call ``run`` repeatedly without duplicate effects."""

    JOB_TYPES = ("trip_checkin_prompt", "trip_missed_checkin", "trip_expiry", "trip_retention")
    JOB_TYPES = (
        "trip_checkin_prompt",
        "trip_missed_checkin",
        "trip_expiry",
        "trip_retention",
        "sharing_grant_expiry",
        "deviation_notification_dispatch",
        "emergency_handoff_expiry",
    )

    def schedule(self, db: Session, trip: TripSession) -> None:
        for job_type in self.JOB_TYPES:
            key = f"{trip.id}:{job_type}"
            if not db.scalar(
                select(JobRun).where(JobRun.job_type == job_type, JobRun.idempotency_key == key)
            ):
                db.add(JobRun(job_type=job_type, idempotency_key=key, status="pending"))

    def run(self, db: Session, job: JobRun, now: datetime | None = None) -> None:
        now = now or datetime.now(UTC)
        if job.status == "completed":
            return
        job.attempts += 1
        job.started_at = now
        try:
            service = TripService()
            if job.job_type == "sharing_grant_expiry":
                grant_id_str = job.idempotency_key.split(":", 1)[0]
                grant = db.get(SharingGrant, uuid.UUID(grant_id_str))
                if grant and grant.status == "ACTIVE" and now >= grant.expires_at:
                    grant.status = "EXPIRED"
                job.status, job.completed_at = "completed", now
                return

            if job.job_type == "emergency_handoff_expiry":
                handoff_id = uuid.UUID(job.idempotency_key.split(":", 1)[0])
                handoff = db.get(EmergencyHandoff, handoff_id)
                if handoff and handoff.status not in {"OFFICIAL_CONFIRMATION", "FAILED", "UNAVAILABLE", "CANCELLED", "EXPIRED"} and now >= handoff.expires_at:
                    handoff.status = "EXPIRED"
                    handoff.completed_at = now
                    self_trip = db.get(TripSession, handoff.trip_id)
                    if self_trip:
                        service.internal_event(db, self_trip, "EMERGENCY_HANDOFF_EXPIRED", now, {"handoff_id": handoff.public_reference, "status": "EXPIRED"}, f"handoff-expiry:{handoff.id}")
                job.status, job.completed_at = "completed", now
                return

            if job.job_type == "deviation_notification_dispatch":
                dispatch_id_str = job.idempotency_key.split(":", 1)[0]
                dispatch = db.get(NotificationDispatch, uuid.UUID(dispatch_id_str))
                if dispatch and dispatch.status == "QUEUED":
                    provider = service.notification_provider
                    msg = NotificationMessage(
                        recipient_reference=dispatch.recipient_reference,
                        event_type=dispatch.event_type,
                        body=dispatch.payload.get("message", "Active trip deviation detected. Traveler verification is pending."),
                        channel=dispatch.channel,
                        metadata=dispatch.payload,
                    )
                    res = provider.send(msg)
                    dispatch.attempts += 1
                    dispatch.status = res.status
                    dispatch.error_message = res.error_message
                    dispatch.dispatched_at = res.dispatched_at or now
                job.status, job.completed_at = "completed", now
                return

            trip_id = job.idempotency_key.split(":", 1)[0]
            trip = db.get(TripSession, uuid.UUID(trip_id))
            if trip is None:
                job.status, job.completed_at = "completed", now
                return
            service = TripService()

            if job.job_type == "trip_checkin_prompt":
                due = trip.planned_arrival - timedelta(
                    minutes=get_settings().trip_checkin_prompt_minutes_before_arrival
                )
                if now >= due and trip.status == "ACTIVE":
                    service.transition(db, trip, "CHECKIN_PENDING", now)
                    service.internal_event(
                        db,
                        trip,
                        "CHECKIN_PROMPT_DUE",
                        now,
                        {"prompt_due": True},
                        job.idempotency_key,
                    )
            elif job.job_type == "trip_missed_checkin":
                due = trip.planned_arrival + timedelta(
                    minutes=get_settings().trip_checkin_grace_minutes
                )
                if now >= due and trip.status == "CHECKIN_PENDING":
                    service.transition(db, trip, "MISSED_CHECKIN", now)
                    service.internal_event(
                        db, trip, "CHECKIN_MISSED", now, {"checkin": "missed"}, job.idempotency_key
                    )
            elif (
                job.job_type == "trip_expiry"
                and now >= trip.retention_until
                and trip.status not in {"STOPPED", "COMPLETED", "EXPIRED"}
            ):
                service.transition(db, trip, "EXPIRED", now)
            elif job.job_type == "trip_retention" and now >= trip.retention_until:
                trip.status = "EXPIRED"
                trip.last_update_at = now
            job.status, job.completed_at, job.error_class, job.error_message = (
                "completed",
                now,
                None,
                None,
            )
        except ValueError:
            job.status, job.error_class = "failed", "non_retryable"
        except Exception as exc:
            job.status, job.error_class, job.error_message = (
                "pending",
                "retryable",
                type(exc).__name__,
            )


class TripService:
    def create_emergency_handoff(self, db: Session, payload: EmergencyHandoffCreateRequest) -> EmergencyHandoffSummary:
        trip = self.owned(db, payload.trip_id, payload.session_id)
        if trip.status in {"STOPPED", "COMPLETED", "EXPIRED"}:
            raise TripFailure("invalid_transition")
        if not payload.explicit_user_action:
            raise TripFailure("explicit_action_required")
        fingerprint = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
        existing = db.scalar(select(EmergencyHandoff).where(EmergencyHandoff.trip_id == trip.id, EmergencyHandoff.idempotency_key == payload.idempotency_key))
        if existing:
            if existing.request_fingerprint != fingerprint:
                raise TripFailure("idempotency_conflict")
            return self._handoff_summary(existing)
        now = datetime.now(UTC)
        provider_result = self.emergency_provider.submit(payload.idempotency_key) if payload.method == "APPROVED_INTEGRATION" else None
        status = provider_result.status if provider_result else "GUIDANCE_DISPLAYED"
        settings = get_settings()
        handoff = EmergencyHandoff(public_reference=f"eh_{secrets.token_urlsafe(16)}", trip_id=trip.id, initiated_by=payload.session_id, handoff_type=payload.method, status=status, requested_at=now, expires_at=now + timedelta(minutes=settings.emergency_handoff_ttl_minutes), consent_version=payload.consent_version, consent_source=payload.consent_source, provider_reference=provider_result.provider_reference if provider_result else None, failure_code=provider_result.failure_code if provider_result else None, idempotency_key=payload.idempotency_key, request_fingerprint=fingerprint, retention_until=now + timedelta(days=settings.emergency_handoff_retention_days))
        try:
            with db.begin_nested():
                db.add(handoff)
                db.flush()
        except IntegrityError:
            existing = db.scalar(select(EmergencyHandoff).where(EmergencyHandoff.trip_id == trip.id, EmergencyHandoff.idempotency_key == payload.idempotency_key))
            if existing and existing.request_fingerprint == fingerprint:
                return self._handoff_summary(existing)
            raise TripFailure("idempotency_conflict") from None
        event_type = "EMERGENCY_HANDOFF_UNAVAILABLE" if status == "UNAVAILABLE" else "EMERGENCY_HANDOFF_INITIATED"
        self.internal_event(db, trip, event_type, now, {"handoff": status, "method": payload.method}, f"handoff:{handoff.id}")
        job_key = f"{handoff.id}:emergency_handoff_expiry"
        db.add(JobRun(job_type="emergency_handoff_expiry", idempotency_key=job_key, status="pending"))
        return self._handoff_summary(handoff)

    def emergency_handoff_action(self, db: Session, handoff_id: str, payload: EmergencyHandoffActionRequest) -> EmergencyHandoffSummary:
        handoff = db.scalar(select(EmergencyHandoff).where(EmergencyHandoff.public_reference == handoff_id))
        if handoff is None:
            raise TripFailure("handoff_not_found")
        trip = db.get(TripSession, handoff.trip_id)
        if trip is None or not secrets.compare_digest(trip.owner_session_id, payload.session_id):
            raise TripFailure("access_denied")
        if handoff.expires_at <= datetime.now(UTC):
            handoff.status = "EXPIRED"
            raise TripFailure("handoff_expired")
        targets = {"CALL_INITIATED": "CALL_INITIATED", "CALL_OPENED": "CALL_OPENED", "CANCEL": "CANCELLED"}
        target = targets[payload.action]
        if target == handoff.status:
            return self._handoff_summary(handoff)
        if target not in HANDOFF_TRANSITIONS.get(handoff.status, set()):
            raise TripFailure("handoff_invalid_state")
        handoff.status = target
        if target == "CANCELLED":
            handoff.completed_at = datetime.now(UTC)
        event_type = {"CALL_INITIATED": "EMERGENCY_CALL_INITIATED", "CALL_OPENED": "EMERGENCY_CALL_OPENED", "CANCELLED": "EMERGENCY_HANDOFF_CANCELLED"}[target]
        self.internal_event(db, trip, event_type, datetime.now(UTC), {"handoff_id": handoff.public_reference, "status": target}, f"handoff-action:{handoff.id}:{payload.idempotency_key}")
        return self._handoff_summary(handoff)

    @staticmethod
    def _handoff_summary(handoff: EmergencyHandoff) -> EmergencyHandoffSummary:
        next_action = "Open the official emergency mechanism." if handoff.status in {"GUIDANCE_DISPLAYED", "CALL_INITIATED"} else "No approved provider is configured." if handoff.status == "UNAVAILABLE" else "No further action is available from this service."
        return EmergencyHandoffSummary(handoff_id=handoff.public_reference, method=handoff.handoff_type, status=handoff.status, requested_at=handoff.requested_at, next_action=next_action, provider_reference=handoff.provider_reference)

    def __init__(
        self,
        notification_provider: NotificationProvider | None = None,
        context_service: SafetyContextService | None = None,
        emergency_provider: EmergencyHandoffProvider | None = None,
        trusted_contact_provider: TrustedContactVerificationProvider | None = None,
    ) -> None:
        self.notification_provider = notification_provider or UnavailableNotificationProvider()
        self.context_service = context_service or SafetyContextService()
        self.emergency_provider = emergency_provider or UnavailableEmergencyHandoffProvider()
        self.trusted_contact_provider = trusted_contact_provider or (
            UnavailableTrustedContactVerificationProvider()
            if get_settings().app_env.lower() in {"production", "release"}
            else DevelopmentTrustedContactVerificationProvider()
        )

    def create(self, db: Session, payload: TripCreateRequest) -> TripResponse:
        route = db.scalar(
            select(Route).join(RouteRequest).where(Route.id == self._uuid(payload.route_id))
        )
        if route is None:
            raise TripFailure("route_not_found")
        request = db.get(RouteRequest, route.route_request_id)
        if (
            not request
            or not request.session_id
            or not secrets.compare_digest(request.session_id, payload.session_id)
        ):
            raise TripFailure("access_denied")
        if (
            route.normalized_state != "normalized"
            or route.duration_seconds <= 0
            or route.provider != "fixture"
        ):
            raise TripFailure("invalid_route")
        if route.route_request.travel_mode != payload.travel_mode:
            raise TripFailure("invalid_route")
        now = datetime.now(UTC)
        trip = TripSession(
            public_reference=f"trip_{secrets.token_urlsafe(16)}",
            owner_session_id=payload.session_id,
            route_id=route.id,
            planned_departure=payload.planned_departure,
            planned_arrival=payload.planned_arrival,
            travel_mode=payload.travel_mode,
            consent_reference=payload.consent_reference,
            consent_version=payload.consent_version,
            consent_active=True,
            sharing_scope=payload.sharing_scope,
            status="ACTIVE",
            started_at=now,
            last_update_at=now,
            retention_until=now + timedelta(days=get_settings().trip_retention_days),
        )
        db.add(trip)
        db.flush()
        self.internal_event(db, trip, "TRIP_STARTED", now, {"state": "ACTIVE"}, f"start:{trip.id}")
        TripJobService().schedule(db, trip)
        return self.response(trip)

    def owned(
        self, db: Session, trip_id: str, session_id: str, *, allow_expired: bool = False
    ) -> TripSession:
        trip = db.scalar(select(TripSession).where(TripSession.public_reference == trip_id))
        if trip is None:
            raise TripFailure("not_found")
        if not secrets.compare_digest(trip.owner_session_id, session_id):
            raise TripFailure("access_denied")
        if not allow_expired and trip.status == "EXPIRED":
            raise TripFailure("expired")
        return trip

    def event(
        self, db: Session, trip_id: str, session_id: str, payload: TripEventRequest
    ) -> TripResponse:
        trip = self.owned(db, trip_id, session_id)
        fingerprint = self._fingerprint(payload)
        existing = db.scalar(
            select(TripEvent).where(
                TripEvent.trip_id == trip.id, TripEvent.idempotency_key == payload.idempotency_key
            )
        )
        if existing:
            if existing.request_fingerprint != fingerprint or existing.event_id != payload.event_id:
                raise TripFailure("idempotency_conflict")
            return self.response(trip)
        if trip.status in {"STOPPED", "COMPLETED"}:
            raise TripFailure("stopped")
        if payload.event_type == "SHARING_GRANT_REVOKED":
            trip.consent_active = False
            self.transition(db, trip, "STOPPED", payload.occurred_at)
            redacted = {"sharing": "revoked"}
        elif payload.event_type == "USER_CONFIRMED_OK":
            if trip.status not in {"ACTIVE", "CHECKIN_PENDING", "DEVIATED", "MISSED_CHECKIN"}:
                raise TripFailure("invalid_transition")
            self.transition(
                db, trip, "ACTIVE", payload.occurred_at
            ) if trip.status != "ACTIVE" else None
            redacted = {"checkin": "confirmed"}
        else:
            redacted = self._location_result(db, trip, payload)
        event = TripEvent(
            trip_id=trip.id,
            event_id=payload.event_id,
            event_type=payload.event_type,
            actor=payload.actor,
            occurred_at=payload.occurred_at,
            consent_reference=trip.consent_reference,
            consent_version=trip.consent_version,
            idempotency_key=payload.idempotency_key,
            request_fingerprint=fingerprint,
            redacted_payload=redacted,
            retention_until=trip.retention_until,
        )
        try:
            with db.begin_nested():
                db.add(event)
                db.flush()
        except IntegrityError:
            existing = db.scalar(
                select(TripEvent).where(
                    TripEvent.trip_id == trip.id,
                    (TripEvent.idempotency_key == payload.idempotency_key)
                    | (TripEvent.event_id == payload.event_id),
                )
            )
            if (
                existing
                and existing.request_fingerprint == fingerprint
                and existing.event_id == payload.event_id
            ):
                return self.response(trip)
            raise TripFailure("idempotency_conflict") from None
        trip.last_update_at = payload.occurred_at
        return self.response(trip)

    def checkin(self, db: Session, trip_id: str, payload: TripActionRequest) -> TripResponse:
        return self.event(
            db,
            trip_id,
            payload.session_id,
            TripEventRequest(
                event_id=payload.event_id,
                idempotency_key=payload.idempotency_key,
                event_type="USER_CONFIRMED_OK",
                occurred_at=payload.occurred_at,
            ),
        )

    def stop(self, db: Session, trip_id: str, payload: TripActionRequest) -> TripResponse:
        trip = self.owned(db, trip_id, payload.session_id)
        fingerprint = self._fingerprint(payload)
        existing = db.scalar(
            select(TripEvent).where(
                TripEvent.trip_id == trip.id, TripEvent.idempotency_key == payload.idempotency_key
            )
        )
        if existing:
            if existing.request_fingerprint != fingerprint or existing.event_id != payload.event_id:
                raise TripFailure("idempotency_conflict")
            return self.response(trip)
        if trip.status not in {"ACTIVE", "CHECKIN_PENDING", "DEVIATED", "MISSED_CHECKIN"}:
            raise TripFailure("invalid_transition")
        self.transition(db, trip, "STOPPED", payload.occurred_at)
        self.internal_event(
            db,
            trip,
            "TRIP_STOPPED",
            payload.occurred_at,
            {"state": "STOPPED"},
            payload.idempotency_key,
            payload.event_id,
            fingerprint,
        )
        return self.response(trip)

    def transition(self, db: Session, trip: TripSession, target: str, at: datetime) -> None:
        if target == trip.status:
            return
        if target not in TRANSITIONS.get(trip.status, set()):
            raise TripFailure("invalid_transition")
        trip.status, trip.last_update_at = target, at
        if target in {"ACTIVE", "DEVIATED"} and trip.started_at is None:
            trip.started_at = at
        if target in {"STOPPED", "COMPLETED", "EXPIRED"}:
            trip.ended_at = at

    def internal_event(
        self,
        db: Session,
        trip: TripSession,
        event_type: str,
        at: datetime,
        payload: dict,
        key: str,
        event_id: str | None = None,
        fingerprint: str | None = None,
    ) -> None:
        if db.scalar(
            select(TripEvent).where(TripEvent.trip_id == trip.id, TripEvent.idempotency_key == key)
        ):
            return
        db.add(
            TripEvent(
                trip_id=trip.id,
                event_id=event_id or f"internal-{hashlib.sha256(key.encode()).hexdigest()[:48]}",
                event_type=event_type,
                actor="SYSTEM",
                occurred_at=at,
                consent_reference=trip.consent_reference,
                consent_version=trip.consent_version,
                idempotency_key=key,
                request_fingerprint=fingerprint or hashlib.sha256(key.encode()).hexdigest(),
                redacted_payload=payload,
                retention_until=trip.retention_until,
            )
        )

    def poll(self, db: Session, trip_id: str, session_id: str) -> TripPollResponse:
        trip = self.owned(db, trip_id, session_id)
        latest = db.scalar(
            select(TripEvent)
            .where(TripEvent.trip_id == trip.id)
            .order_by(TripEvent.created_at.desc())
        )
        stale = trip.last_update_at < datetime.now(UTC) - timedelta(
            minutes=get_settings().trip_stale_minutes
        )

        deviation_record = db.scalar(
            select(TripDeviation)
            .where(TripDeviation.trip_id == trip.id)
            .order_by(TripDeviation.created_at.desc())
        )
        handoff = db.scalar(select(EmergencyHandoff).where(EmergencyHandoff.trip_id == trip.id).order_by(EmergencyHandoff.created_at.desc()))
        dev_summary = None
        if deviation_record:
            dev_summary = DeviationSummary(
                deviation_id=deviation_record.public_reference,
                status=deviation_record.status,
                detected_at=deviation_record.detected_at,
                confirmation_required=(deviation_record.status == "DEVIATION_PENDING_CONFIRMATION"),
                user_response=deviation_record.user_response,
                alternate_route_id=str(deviation_record.alternate_route_id) if deviation_record.alternate_route_id else None,
                context_band=deviation_record.context_band,
                confidence=deviation_record.confidence,
                explanation=deviation_record.explanation,
            )

        return TripPollResponse(
            **self.response(trip).model_dump(),
            latest_event_id=latest.event_id if latest else None,
            stale=stale,
            deviation=dev_summary,
            emergency_handoff=self._handoff_summary(handoff).model_dump() if handoff else None,
        )

    def stream_events(
        self, db: Session, trip: TripSession, last_event_id: str | None
    ) -> list[TripEvent]:
        events = list(
            db.scalars(
                select(TripEvent)
                .where(TripEvent.trip_id == trip.id)
                .order_by(TripEvent.created_at.asc())
            ).all()
        )
        if last_event_id:
            ids = [item.event_id for item in events]
            if last_event_id in ids:
                events = events[ids.index(last_event_id) + 1 :]
        return events[-get_settings().trip_stream_replay_limit :]

    def _location_result(self, db: Session, trip: TripSession, payload: TripEventRequest) -> dict:
        if payload.location is None:
            return {"update": "accepted"}
        if not trip.consent_active or trip.sharing_scope != "LOCATION":
            raise TripFailure("location_not_permitted")
        point = func.ST_SetSRID(
            func.ST_MakePoint(payload.location.longitude, payload.location.latitude), 4326
        )
        on_route = db.scalar(
            select(
                func.ST_DWithin(
                    func.Geography(Route.geometry),
                    func.Geography(point),
                    get_settings().trip_deviation_meters,
                )
            ).where(Route.id == trip.route_id)
        )
        if not on_route and trip.status == "ACTIVE":
            self.transition(db, trip, "DEVIATED", payload.occurred_at)
            dev_key = f"deviation:{payload.event_id}"
            self.internal_event(
                db,
                trip,
                "TRIP_DEVIATION_DETECTED",
                payload.occurred_at,
                {"route_context": "outside_threshold"},
                f"deviation:{payload.event_id}",
                dev_key,
            )
            # Smart Active Deviation: create durable TripDeviation record and notifications
            self._handle_deviation_detected(db, trip, payload, dev_key)
        elif on_route and trip.status == "DEVIATED":
            self.transition(db, trip, "ACTIVE", payload.occurred_at)
        return {
            "location_processed": True,
            "route_context": "on_route" if on_route else "outside_threshold",
        }

    def _handle_deviation_detected(
        self, db: Session, trip: TripSession, payload: TripEventRequest, dev_key: str
    ) -> None:
        """Create durable deviation record and notify contacts through abstraction."""
        existing_dev = db.scalar(
            select(TripDeviation).where(
                TripDeviation.trip_id == trip.id,
                TripDeviation.deviation_event_id == dev_key,
            )
        )
        if not existing_dev:
            deviation = TripDeviation(
                public_reference=f"dev_{secrets.token_urlsafe(16)}",
                trip_id=trip.id,
                original_route_id=trip.route_id,
                status="DEVIATION_PENDING_CONFIRMATION",
                detected_at=payload.occurred_at,
                deviation_event_id=dev_key,
                retention_until=trip.retention_until,
            )
            db.add(deviation)
            db.flush()

            # Emit DEVIATION_CONFIRMATION_REQUIRED event
            self.internal_event(
                db,
                trip,
                "DEVIATION_CONFIRMATION_REQUIRED",
                payload.occurred_at,
                {
                    "prompt": "You're no longer following your selected route. Did you choose this route?",
                    "options": ["CONFIRM_ROUTE_CHANGE", "REJECT_ROUTE_CHANGE", "UNSURE"],
                    "deviation_id": deviation.public_reference,
                },
                f"prompt:{deviation.public_reference}",
            )

            # Enqueue minimal notification to contacts with active sharing grants
            now = datetime.now(UTC)
            grants = list(
                db.scalars(
                    select(SharingGrant)
                    .join(TrustedContact)
                    .where(
                        SharingGrant.trip_id == trip.id,
                        SharingGrant.status == "ACTIVE",
                        SharingGrant.expires_at > now,
                        TrustedContact.verification_status == "VERIFIED",
                    )
                ).all()
            )
            for grant in grants:
                dispatch_key = f"dev_notif:{deviation.id}:{grant.id}"
                if not db.scalar(
                    select(NotificationDispatch).where(NotificationDispatch.idempotency_key == dispatch_key)
                ):
                    dispatch = NotificationDispatch(
                        public_reference=f"notif_{secrets.token_urlsafe(16)}",
                        trip_id=trip.id,
                        contact_id=grant.contact_id,
                        recipient_reference=grant.contact.contact_reference,
                        event_type="DEVIATION_PENDING_CONFIRMATION",
                        channel="IN_APP",
                        status="QUEUED",
                        idempotency_key=dispatch_key,
                        payload={
                            "message": "Active trip deviation detected. Traveler verification is pending.",
                            "trip_id": trip.public_reference,
                            "deviation_id": deviation.public_reference,
                        },
                    )
                    db.add(dispatch)
                    db.flush()
                    job_key = f"{dispatch.id}:deviation_notification_dispatch"
                    if not db.scalar(
                        select(JobRun).where(
                            JobRun.job_type == "deviation_notification_dispatch",
                            JobRun.idempotency_key == job_key,
                        )
                    ):
                        job = JobRun(
                            job_type="deviation_notification_dispatch",
                            idempotency_key=job_key,
                            status="pending",
                        )
                        db.add(job)
                        db.flush()
                        TripJobService().run(db, job, payload.occurred_at)

                    # Schedule durable job
                    job_key = f"{dispatch.id}:deviation_notification_dispatch"
                    if not db.scalar(
                        select(JobRun).where(
                            JobRun.job_type == "deviation_notification_dispatch",
                            JobRun.idempotency_key == job_key,
                        )
                    ):
                        job = JobRun(
                            job_type="deviation_notification_dispatch",
                            idempotency_key=job_key,
                            status="pending",
                        )
                        db.add(job)
                        db.flush()
                        # Execute immediately via provider
                        TripJobService().run(db, job, now)

    # ------------------------------------------------------------------
    # Smart Active Deviation: User Confirmation & Alternate Path
    # ------------------------------------------------------------------

    def respond_deviation(
        self, db: Session, trip_id: str, payload: DeviationResponseRequest
    ) -> DeviationResponseResult:
        trip = self.owned(db, trip_id, payload.session_id)
        deviation = db.scalar(
            select(TripDeviation)
            .where(TripDeviation.trip_id == trip.id)
            .order_by(TripDeviation.created_at.desc())
        )
        if not deviation:
            raise TripFailure("deviation_not_found")

        # Idempotency check
        resp_key = f"dev_resp:{payload.idempotency_key}"
        existing_event = db.scalar(
            select(TripEvent).where(
                TripEvent.trip_id == trip.id,
                TripEvent.idempotency_key == resp_key,
            )
        )
        if existing_event:
            if existing_event.request_fingerprint != hashlib.sha256(resp_key.encode()).hexdigest():
                raise TripFailure("idempotency_conflict")
            return DeviationResponseResult(
                trip_id=trip.public_reference,
                deviation_id=deviation.public_reference,
                status=deviation.status,
                user_response=deviation.user_response or payload.response,
                alternate_route_id=str(deviation.alternate_route_id) if deviation.alternate_route_id else None,
                context_band=deviation.context_band,
                confidence=deviation.confidence,
                explanation=deviation.explanation,
            )

        if deviation.status not in {"DEVIATION_PENDING_CONFIRMATION", "USER_UNCERTAIN"} and deviation.user_response is not None:
            # If user already responded, allow changing mind (ALTERNATE -> ORIGINAL)
            if payload.response == "REJECT_ROUTE_CHANGE" and deviation.status == "ALTERNATE_PATH_EVALUATED":
                deviation.status = "USER_REJECTED_CHANGE"
                deviation.user_response = payload.response
                deviation.user_response_at = payload.occurred_at
                self.internal_event(
                    db,
                    trip,
                    "USER_REJECTED_ROUTE_CHANGE",
                    payload.occurred_at,
                    {"action": "return_to_planned_route"},
                    resp_key,
                )
                return DeviationResponseResult(
                    trip_id=trip.public_reference,
                    deviation_id=deviation.public_reference,
                    status=deviation.status,
                    user_response=deviation.user_response,
                    alternate_route_id=str(deviation.alternate_route_id) if deviation.alternate_route_id else None,
                    context_band=deviation.context_band,
                    confidence=deviation.confidence,
                    explanation=deviation.explanation,
                )
            raise TripFailure("invalid_transition")

        deviation.user_response = payload.response
        deviation.user_response_at = payload.occurred_at

        if payload.response == "CONFIRM_ROUTE_CHANGE":
            deviation.status = "ALTERNATE_PATH_EVALUATING"
            self.internal_event(
                db,
                trip,
                "USER_CONFIRMED_ROUTE_CHANGE",
                payload.occurred_at,
                {"confirmed": True},
                resp_key,
            )
            self.internal_event(
                db,
                trip,
                "ALTERNATE_PATH_EVALUATING",
                payload.occurred_at,
                {"status": "evaluating"},
                f"evaluating:{payload.idempotency_key}",
            )
            # Construct alternate path and evaluate through SafetyContextEngine
            self._evaluate_alternate_path(db, trip, deviation, payload)

        elif payload.response == "REJECT_ROUTE_CHANGE":
            deviation.status = "USER_REJECTED_CHANGE"
            self.internal_event(
                db,
                trip,
                "USER_REJECTED_ROUTE_CHANGE",
                payload.occurred_at,
                {"intentional": False, "action": "return_to_planned_route"},
                resp_key,
            )

            # Trusted contact escalation alert
            contacts = list(
                db.scalars(
                    select(TrustedContact).where(
                        TrustedContact.owner_session_id == trip.owner_session_id,
                    )
                ).all()
            )
            grants = list(
                db.scalars(
                    select(SharingGrant)
                    .join(TrustedContact)
                    .where(
                        SharingGrant.trip_id == trip.id,
                        SharingGrant.status == "ACTIVE",
                    )
                ).all()
            )
            for g in grants:
                if g.contact not in contacts:
                    contacts.append(g.contact)

            # Record internal event
            self.internal_event(
                db,
                trip,
                "TRUSTED_CONTACT_ALERT_DISPATCHED",
                payload.occurred_at,
                {
                    "alert_reason": "UNINTENDED_DEVIATION",
                    "contact_count": len(contacts),
                    "action_required": "CHECK_IN_OR_CALL",
                },
                f"alert:{deviation.public_reference}:{payload.idempotency_key}",
            )

            # Queue dispatches for contacts
            for contact in contacts:
                dispatch_key = f"alert_dev:{deviation.id}:{contact.id}"
                if not db.scalar(
                    select(NotificationDispatch).where(NotificationDispatch.idempotency_key == dispatch_key)
                ):
                    dispatch = NotificationDispatch(
                        public_reference=f"notif_{secrets.token_urlsafe(16)}",
                        trip_id=trip.id,
                        contact_id=contact.id,
                        recipient_reference=contact.contact_reference,
                        event_type="UNINTENDED_DEVIATION_ALERT",
                        channel="SMS" if contact.contact_reference.startswith("+") else "IN_APP",
                        status="QUEUED",
                        idempotency_key=dispatch_key,
                        payload={
                            "message": f"EMERGENCY ALERT: Route deviation detected for trip {trip.public_reference}. Traveler confirmed deviation was NOT intentional.",
                            "trip_id": trip.public_reference,
                            "deviation_id": deviation.public_reference,
                        },
                    )
                    db.add(dispatch)
                    db.flush()

            # Output clearly in the terminal during development
            if get_settings().app_env.lower() not in {"production", "release"}:
                contact_names = (
                    ", ".join(f"{c.display_name} ({c.contact_reference})" for c in contacts)
                    if contacts
                    else "All designated emergency contacts"
                )
                print(
                    f"\n[DEV ALERT] 🚨 TRUSTED CONTACT ALERT DISPATCHED\n"
                    f"  Trip ID: {trip.public_reference}\n"
                    f"  Event: Route deviation confirmed UNINTENDED by traveller\n"
                    f"  Alerted Contacts: {contact_names}\n"
                    f"  Action: Escalation to emergency contacts & safety circle initiated\n",
                    f"[DEV ALERT] Trusted contact alert dispatched: "
                    f"trip={trip.public_reference} deviation={deviation.public_reference} "
                    f"contacts={contact_names}",
                    flush=True,
                )

        elif payload.response == "UNSURE":
            deviation.status = "USER_UNCERTAIN"
            self.internal_event(
                db,
                trip,
                "USER_UNCERTAIN",
                payload.occurred_at,
                {"user_sure": False},
                resp_key,
            )

        return DeviationResponseResult(
            trip_id=trip.public_reference,
            deviation_id=deviation.public_reference,
            status=deviation.status,
            user_response=deviation.user_response,
            alternate_route_id=str(deviation.alternate_route_id) if deviation.alternate_route_id else None,
            context_band=deviation.context_band,
            confidence=deviation.confidence,
            explanation=deviation.explanation,
        )

    def _evaluate_alternate_path(
        self,
        db: Session,
        trip: TripSession,
        deviation: TripDeviation,
        payload: DeviationResponseRequest,
    ) -> None:
        """Construct alternate route from current location/corridor and evaluate with SafetyContextEngine."""
        orig_route = db.get(Route, deviation.original_route_id)
        if not orig_route:
            deviation.status = "ALTERNATE_PATH_EVALUATION_FAILED"
            return

        endpoint = db.execute(
            select(func.ST_X(func.ST_EndPoint(Route.geometry)), func.ST_Y(func.ST_EndPoint(Route.geometry)))
            .where(Route.id == orig_route.id)
        ).first()
        startpoint = db.execute(
            select(func.ST_X(func.ST_StartPoint(Route.geometry)), func.ST_Y(func.ST_StartPoint(Route.geometry)))
            .where(Route.id == orig_route.id)
        ).first()
        if not endpoint or endpoint[0] is None or endpoint[1] is None or not startpoint or startpoint[0] is None or startpoint[1] is None:
            deviation.status = "ALTERNATE_PATH_EVALUATION_FAILED"
            return
        origin_pt = (
            (payload.alternate_location.longitude, payload.alternate_location.latitude)
            if payload.alternate_location
            else (float(startpoint[0]), float(startpoint[1]))
        )
        destination_pt = (float(endpoint[0]), float(endpoint[1]))
        try:
            provider = RouteComparisonService().provider
            provider_route = provider.routes(ProviderRouteRequest(origin_pt, destination_pt, "walking"))[0]
        except (RoutingProviderError, IndexError):
            deviation.status = "ALTERNATE_PATH_EVALUATION_FAILED"
            return
        normalized_coords = _coordinates(provider_route.coordinates)

        # Persist the provider-derived route geometry; never create map fixtures.
        alt_route = Route(
            route_request_id=orig_route.route_request_id,
            provider=provider.name,
            provider_route_ref=provider_route.reference,
            sequence=orig_route.sequence + 10,
            duration_seconds=provider_route.duration_seconds,
            distance_meters=provider_route.distance_meters,
            geometry=func.ST_GeomFromText(
                "LINESTRING(" + ",".join(f"{lon} {lat}" for lon, lat in normalized_coords) + ")",
                4326,
            ),
            provider_metadata={**provider_route.metadata, "type": "smart_active_deviation_alternate"},
            normalized_state="normalized",
        )
        db.add(alt_route)
        db.flush()

        for segment in provider_route.segments:
            segment_coords = _coordinates(segment.coordinates)
            db.add(RouteSegment(route_id=alt_route.id, canonical_id=canonical_segment_id(segment_coords), sequence=segment.sequence, geometry=func.ST_GeomFromText("LINESTRING(" + ",".join(f"{lon} {lat}" for lon, lat in segment_coords) + ")", 4326), length_meters=segment.length_meters, travel_seconds=segment.travel_seconds))
        db.flush()

        # Re-evaluate through the SafetyContextEngine
        try:
            ctx_resp = self.context_service.evaluate(db, str(alt_route.id))
            deviation.alternate_route_id = alt_route.id
            trip.route_id = alt_route.id
            deviation.context_version_id = uuid.UUID(ctx_resp.context_version)
            deviation.context_band = ctx_resp.route_context_band
            deviation.confidence = ctx_resp.route_confidence
            deviation.explanation = ctx_resp.explanation
            deviation.status = "ALTERNATE_PATH_EVALUATED"

            # Emit events
            self.internal_event(
                db,
                trip,
                "ALTERNATE_PATH_EVALUATED",
                payload.occurred_at,
                {
                    "alternate_route_id": str(alt_route.id),
                    "context_band": ctx_resp.route_context_band,
                    "confidence": ctx_resp.route_confidence,
                },
                f"alt_eval:{deviation.public_reference}",
            )
            self.internal_event(
                db,
                trip,
                "ALTERNATE_ROUTE_CONTEXT_UPDATED",
                payload.occurred_at,
                {
                    "context_band": ctx_resp.route_context_band,
                    "confidence": ctx_resp.route_confidence,
                    "summary": ctx_resp.explanation.get("strongest_support", []),
                },
                f"ctx_upd:{deviation.public_reference}",
            )
            # Also transition trip back to ACTIVE on the evaluated route
            self.transition(db, trip, "ACTIVE", payload.occurred_at)
        except Exception:
            deviation.status = "ALTERNATE_PATH_EVALUATION_FAILED"
            self.internal_event(
                db,
                trip,
                "ALTERNATE_PATH_EVALUATION_FAILED",
                payload.occurred_at,
                {"error": "context_evaluation_failed"},
                f"alt_fail:{deviation.public_reference}",
            )

    # ------------------------------------------------------------------
    # Trusted Contacts Operations
    # ------------------------------------------------------------------

    def create_contact(
        self, db: Session, payload: TrustedContactCreateRequest
    ) -> TrustedContactResponse:
        existing = db.scalar(
            select(TrustedContact).where(
                TrustedContact.owner_session_id == payload.session_id,
                TrustedContact.contact_reference == payload.contact_reference,
            )
        )
        if existing:
            if existing.verification_status != "REVOKED":
                return self._contact_response(existing)
            # Re-activate revoked contact with new token
            token = self.trusted_contact_provider.generate()
            existing.verification_status = "PENDING"
            existing.verification_token_hash = hash_token(token)
            existing.verification_expires_at = datetime.now(UTC) + timedelta(
                minutes=get_settings().trusted_contact_verification_timeout_minutes
            )
            existing.display_name = payload.display_name
            existing.relationship_label = payload.relationship_label
            existing.revoked_at = None
            db.flush()
            self.trusted_contact_provider.send(existing.contact_reference, token)
            return self._contact_response(existing)

        token = self.trusted_contact_provider.generate()
        now = datetime.now(UTC)
        contact = TrustedContact(
            public_reference=f"tc_{secrets.token_urlsafe(16)}",
            owner_session_id=payload.session_id,
            contact_reference=payload.contact_reference,
            display_name=payload.display_name,
            relationship_label=payload.relationship_label,
            verification_status="PENDING",
            verification_token_hash=hash_token(token),
            verification_expires_at=now + timedelta(
                minutes=get_settings().trusted_contact_verification_timeout_minutes
            ),
            created_at=now,
        )
        db.add(contact)
        try:
            db.flush()
        except IntegrityError:
            raise TripFailure("contact_conflict") from None

        self.trusted_contact_provider.send(contact.contact_reference, token)
        return self._contact_response(contact)

    def verify_contact(
        self, db: Session, contact_id: str, payload: TrustedContactVerifyRequest
    ) -> TrustedContactResponse:
        contact = db.scalar(
            select(TrustedContact).where(TrustedContact.public_reference == contact_id)
        )
        if not contact:
            raise TripFailure("contact_not_found")
        if not secrets.compare_digest(contact.owner_session_id, payload.session_id):
            raise TripFailure("access_denied")

        now = datetime.now(UTC)
        if contact.verification_status == "REVOKED":
            raise TripFailure("contact_revoked")
        if contact.verification_status == "VERIFIED":
            return self._contact_response(contact)

        if (
            contact.verification_expires_at
            and now > contact.verification_expires_at
        ):
            contact.verification_status = "EXPIRED"
            raise TripFailure("verification_expired")

        token_hash = hash_token(payload.verification_token)
        if (
            not contact.verification_token_hash
            or not secrets.compare_digest(contact.verification_token_hash, token_hash)
        ):
            raise TripFailure("invalid_verification")

        contact.verification_status = "VERIFIED"
        contact.verified_at = now
        contact.verification_token_hash = None
        contact.verification_expires_at = None
        db.flush()
        return self._contact_response(contact)

    def list_contacts(self, db: Session, session_id: str) -> list[TrustedContactResponse]:
        contacts = list(
            db.scalars(
                select(TrustedContact)
                .where(
                    TrustedContact.owner_session_id == session_id,
                    TrustedContact.verification_status != "REVOKED",
                )
                .order_by(TrustedContact.created_at.desc())
            ).all()
        )
        return [self._contact_response(c) for c in contacts]

    def revoke_contact(
        self, db: Session, contact_id: str, session_id: str
    ) -> TrustedContactResponse:
        contact = db.scalar(
            select(TrustedContact).where(TrustedContact.public_reference == contact_id)
        )
        if not contact:
            raise TripFailure("contact_not_found")
        if not secrets.compare_digest(contact.owner_session_id, session_id):
            raise TripFailure("access_denied")

        now = datetime.now(UTC)
        contact.verification_status = "REVOKED"
        contact.revoked_at = now

        # Revoke all active sharing grants for this contact
        grants = list(
            db.scalars(
                select(SharingGrant).where(
                    SharingGrant.contact_id == contact.id,
                    SharingGrant.status == "ACTIVE",
                )
            ).all()
        )
        for g in grants:
            g.status = "REVOKED"
            g.revoked_at = now

        db.flush()
        return self._contact_response(contact)

    # ------------------------------------------------------------------
    # Sharing Grants Operations
    # ------------------------------------------------------------------

    def create_grant(
        self, db: Session, payload: SharingGrantCreateRequest
    ) -> SharingGrantResponse:
        trip = self.owned(db, payload.trip_id, payload.session_id)
        contact = db.scalar(
            select(TrustedContact).where(
                TrustedContact.public_reference == payload.contact_id,
                TrustedContact.owner_session_id == payload.session_id,
            )
        )
        if not contact:
            raise TripFailure("contact_not_found")
        if contact.verification_status != "VERIFIED":
            raise TripFailure("contact_not_verified")

        now = datetime.now(UTC)
        ttl = payload.ttl_hours or get_settings().sharing_grant_default_ttl_hours
        max_ttl = get_settings().sharing_grant_max_ttl_hours
        ttl = min(ttl, max_ttl)
        expires_at = now + timedelta(hours=ttl)

        # Check existing grant
        existing = db.scalar(
            select(SharingGrant).where(
                SharingGrant.trip_id == trip.id,
                SharingGrant.contact_id == contact.id,
            )
        )
        if existing and existing.status == "ACTIVE" and existing.expires_at > now:
            return self._grant_response(existing)

        raw_token = secrets.token_urlsafe(32)
        t_hash = hash_token(raw_token)

        if existing:
            existing.status = "ACTIVE"
            existing.scope = payload.scope
            existing.token_hash = t_hash
            existing.issued_at = now
            existing.expires_at = expires_at
            existing.revoked_at = None
            db.flush()
            grant = existing
        else:
            try:
                # Use a savepoint so an IntegrityError from a concurrent INSERT
                # only rolls back to here — not the entire outer transaction.
                with db.begin_nested():
                    grant = SharingGrant(
                        public_reference=f"grant_{secrets.token_urlsafe(16)}",
                        trip_id=trip.id,
                        contact_id=contact.id,
                        scope=payload.scope,
                        token_hash=t_hash,
                        status="ACTIVE",
                        issued_at=now,
                        expires_at=expires_at,
                    )
                    db.add(grant)
                    db.flush()
            except IntegrityError:
                # Another concurrent transaction won the race — re-fetch and return their grant
                existing = db.scalar(
                    select(SharingGrant).where(
                        SharingGrant.trip_id == trip.id,
                        SharingGrant.contact_id == contact.id,
                    )
                )
                if existing:
                    return self._grant_response(existing)
                raise TripFailure("grant_conflict") from None

        # Schedule grant expiry job
        job_key = f"{grant.id}:sharing_grant_expiry"
        if not db.scalar(
            select(JobRun).where(
                JobRun.job_type == "sharing_grant_expiry",
                JobRun.idempotency_key == job_key,
            )
        ):
            db.add(
                JobRun(
                    job_type="sharing_grant_expiry",
                    idempotency_key=job_key,
                    status="pending",
                )
            )

        return self._grant_response(grant, raw_token)

    def revoke_grant(
        self, db: Session, grant_id: str, session_id: str
    ) -> SharingGrantResponse:
        grant = db.scalar(
            select(SharingGrant)
            .join(TripSession)
            .where(SharingGrant.public_reference == grant_id)
        )
        if not grant:
            raise TripFailure("grant_not_found")
        if not secrets.compare_digest(grant.trip.owner_session_id, session_id):
            raise TripFailure("access_denied")

        now = datetime.now(UTC)
        grant.status = "REVOKED"
        grant.revoked_at = now
        db.flush()
        return self._grant_response(grant)

    def validate_grant_access(
        self, db: Session, share_token: str, required_scope: str = "STATUS_ONLY"
    ) -> tuple[SharingGrant, TripSession, TrustedContact]:
        """Validate share token and scope. Returns (grant, trip, contact)."""
        t_hash = hash_token(share_token)
        grant = db.scalar(
            select(SharingGrant).where(SharingGrant.token_hash == t_hash)
        )
        if not grant:
            raise TripFailure("grant_not_found")
        if grant.status == "REVOKED":
            raise TripFailure("grant_revoked")

        now = datetime.now(UTC)
        if grant.expires_at < now or grant.status == "EXPIRED":
            grant.status = "EXPIRED"
            raise TripFailure("grant_expired")

        # Scope check
        if required_scope == "LOCATION" and grant.scope != "LOCATION":
            raise TripFailure("scope_not_permitted")
        if required_scope == "TRIP_CONTEXT" and grant.scope != "TRIP_CONTEXT":
            raise TripFailure("scope_not_permitted")

        trip = grant.trip
        contact = grant.contact
        grant.last_accessed_at = now
        db.flush()
        return grant, trip, contact

    def stream_grant_events(
        self, db: Session, grant: SharingGrant, last_event_id: str | None
    ) -> list[dict]:
        """Filter events according to grant scope and privacy rules."""
        trip = grant.trip
        all_events = list(
            db.scalars(
                select(TripEvent)
                .where(TripEvent.trip_id == trip.id)
                .order_by(TripEvent.created_at.asc())
            ).all()
        )
        if last_event_id:
            ids = [item.event_id for item in all_events]
            if last_event_id in ids:
                all_events = all_events[ids.index(last_event_id) + 1 :]

        filtered = []
        for e in all_events[-get_settings().trip_stream_replay_limit :]:
            payload = dict(e.redacted_payload)
            # STATUS_ONLY: strip exact location
            if grant.scope == "STATUS_ONLY":
                payload.pop("location", None)
                payload.pop("coordinates", None)
            # If not TRIP_CONTEXT: strip detailed context
            if grant.scope != "TRIP_CONTEXT" and e.event_type == "ALTERNATE_ROUTE_CONTEXT_UPDATED":
                payload = {"context_updated": True}
            filtered.append(
                {
                    "id": e.event_id,
                    "event": e.event_type,
                    "occurred_at": e.occurred_at.isoformat(),
                    "payload": payload,
                }
            )
        return filtered

    # ------------------------------------------------------------------
    # Helper formatters
    # ------------------------------------------------------------------

    @staticmethod
    def _contact_response(
        contact: TrustedContact, raw_token: str | None = None
    ) -> TrustedContactResponse:
        return TrustedContactResponse(
            contact_id=contact.public_reference,
            contact_reference=contact.contact_reference,
            display_name=contact.display_name,
            relationship_label=contact.relationship_label,
            verification_status=contact.verification_status,
            verified_at=contact.verified_at,
            created_at=contact.created_at,
            verification_token=raw_token,
        )

    @staticmethod
    def _grant_response(
        grant: SharingGrant, raw_token: str | None = None
    ) -> SharingGrantResponse:
        return SharingGrantResponse(
            grant_id=grant.public_reference,
            trip_id=grant.trip.public_reference,
            contact_id=grant.contact.public_reference,
            scope=grant.scope,
            status=grant.status,
            issued_at=grant.issued_at,
            expires_at=grant.expires_at,
            revoked_at=grant.revoked_at,
            share_token=raw_token,
        )

    @staticmethod
    def response(trip: TripSession) -> TripResponse:
        return TripResponse(
            trip_id=trip.public_reference,
            status=trip.status,
            selected_route_id=str(trip.route_id),
            planned_arrival=trip.planned_arrival,
            travel_mode=trip.travel_mode,
            sharing_scope=trip.sharing_scope,
            consent_version=trip.consent_version,
            last_update_at=trip.last_update_at,
            retention_until=trip.retention_until,
        )

    @staticmethod
    def _fingerprint(payload: object) -> str:
        if hasattr(payload, "model_dump"):
            value = payload.model_dump(mode="json")
        else:
            value = str(payload)
        return hashlib.sha256(
            json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
        ).hexdigest()

    @staticmethod
    def _uuid(value: str) -> uuid.UUID:
        try:
            return uuid.UUID(value)
        except ValueError as exc:
            raise TripFailure("route_not_found") from exc
