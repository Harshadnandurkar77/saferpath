from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.routing.schemas import Point


class TripCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    route_id: str
    session_id: str = Field(min_length=1, max_length=128)
    planned_arrival: datetime
    planned_departure: datetime | None = None
    travel_mode: str = Field(pattern="^walking$")
    active_trip_consent: bool
    consent_reference: str = Field(min_length=1, max_length=128)
    consent_version: str = Field(min_length=1, max_length=64)
    sharing_scope: str = Field(default="STATUS_ONLY", pattern="^(STATUS_ONLY|LOCATION)$")

    @field_validator("planned_arrival", "planned_departure")
    @classmethod
    def aware_time(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("must include a timezone offset")
        return value

    @model_validator(mode="after")
    def timing(self) -> TripCreateRequest:
        if self.planned_departure and self.planned_departure >= self.planned_arrival:
            raise ValueError("planned_departure must be before planned_arrival")
        if not self.active_trip_consent:
            raise ValueError("active-trip consent is required")
        return self


class TripEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str = Field(min_length=8, max_length=64)
    idempotency_key: str = Field(min_length=8, max_length=255)
    event_type: str = Field(pattern="^(TRIP_UPDATED|USER_CONFIRMED_OK|SHARING_GRANT_REVOKED)$")
    actor: str = Field(default="USER", pattern="^USER$")
    occurred_at: datetime
    location: Point | None = None

    @field_validator("occurred_at")
    @classmethod
    def aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("must include a timezone offset")
        return value

    @model_validator(mode="after")
    def valid_shape(self) -> TripEventRequest:
        if self.event_type != "TRIP_UPDATED" and self.location is not None:
            raise ValueError("location is only allowed for TRIP_UPDATED")
        return self


class TripActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    event_id: str = Field(min_length=8, max_length=64)
    idempotency_key: str = Field(min_length=8, max_length=255)
    occurred_at: datetime

    @field_validator("occurred_at")
    @classmethod
    def aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("must include a timezone offset")
        return value


class TripResponse(BaseModel):
    trip_id: str
    status: str
    selected_route_id: str
    planned_arrival: datetime
    travel_mode: str
    sharing_scope: str
    consent_version: str
    last_update_at: datetime
    retention_until: datetime


class DeviationSummary(BaseModel):
    deviation_id: str
    status: str
    detected_at: datetime
    confirmation_required: bool
    user_response: str | None = None
    alternate_route_id: str | None = None
    context_band: str | None = None
    confidence: str | None = None
    explanation: dict | None = None


class TripPollResponse(TripResponse):
    latest_event_id: str | None = None
    stale: bool
    deviation: DeviationSummary | None = None
    emergency_handoff: dict | None = None


class EmergencyHandoffCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    trip_id: str = Field(min_length=1, max_length=64)
    method: str = Field(pattern="^(OFFICIAL_CALL|OFFICIAL_DEEP_LINK|APPROVED_INTEGRATION)$")
    idempotency_key: str = Field(min_length=8, max_length=255)
    explicit_user_action: bool
    consent_version: str = Field(min_length=1, max_length=64)
    consent_source: str = Field(min_length=1, max_length=64)


class EmergencyHandoffSummary(BaseModel):
    handoff_id: str
    method: str
    status: str
    requested_at: datetime
    next_action: str
    provider_reference: str | None = None


class EmergencyHandoffActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    idempotency_key: str = Field(min_length=8, max_length=255)
    action: str = Field(pattern="^(CALL_INITIATED|CALL_OPENED|CANCEL)$")


# --- Trusted Contacts Schemas ---


class TrustedContactCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    contact_reference: str = Field(min_length=3, max_length=128)
    display_name: str = Field(min_length=1, max_length=128)
    relationship_label: str = Field(min_length=1, max_length=64)


class TrustedContactVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    verification_token: str = Field(min_length=6, max_length=128)


class TrustedContactResponse(BaseModel):
    contact_id: str
    contact_reference: str
    display_name: str
    relationship_label: str
    verification_status: str
    verified_at: datetime | None = None
    created_at: datetime
    verification_token: str | None = None


# --- Sharing Grant Schemas ---


class SharingGrantCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    trip_id: str = Field(min_length=1, max_length=64)
    contact_id: str = Field(min_length=1, max_length=64)
    scope: str = Field(default="STATUS_ONLY", pattern="^(STATUS_ONLY|LOCATION|TRIP_CONTEXT)$")
    ttl_hours: int | None = Field(default=None, ge=1, le=168)


class SharingGrantResponse(BaseModel):
    grant_id: str
    trip_id: str
    contact_id: str
    scope: str
    status: str
    issued_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None
    share_token: str | None = None  # only exposed once upon creation


# --- Smart Active Deviation Schemas ---


class DeviationResponseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    idempotency_key: str = Field(min_length=8, max_length=255)
    response: str = Field(pattern="^(CONFIRM_ROUTE_CHANGE|REJECT_ROUTE_CHANGE|UNSURE)$")
    occurred_at: datetime
    alternate_location: Point | None = None

    @field_validator("occurred_at")
    @classmethod
    def aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("must include a timezone offset")
        return value


class DeviationResponseResult(BaseModel):
    trip_id: str
    deviation_id: str
    status: str
    user_response: str
    alternate_route_id: str | None = None
    context_band: str | None = None
    confidence: str | None = None
    explanation: dict | None = None
