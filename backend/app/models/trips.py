import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TripSession(Base):
    __tablename__ = "trip_sessions"
    __table_args__ = (
        Index("ix_trip_sessions_owner_status", "owner_session_id", "status"),
        Index("ix_trip_sessions_retention", "retention_until"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    owner_session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    route_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("routes.id", ondelete="RESTRICT"), nullable=False
    )
    planned_departure: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_arrival: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    travel_mode: Mapped[str] = mapped_column(String(24), nullable=False)
    consent_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(64), nullable=False)
    consent_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sharing_scope: Mapped[str] = mapped_column(String(16), nullable=False, default="STATUS_ONLY")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="PLANNED")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_update_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    events: Mapped[list["TripEvent"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    sharing_grants: Mapped[list["SharingGrant"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    deviations: Mapped[list["TripDeviation"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    emergency_handoffs: Mapped[list["EmergencyHandoff"]] = relationship(back_populates="trip", cascade="all, delete-orphan")


class EmergencyHandoff(Base):
    __tablename__ = "emergency_handoffs"
    __table_args__ = (UniqueConstraint("trip_id", "idempotency_key", name="uq_emergency_handoffs_trip_key"), Index("ix_emergency_handoffs_trip_status", "trip_id", "status"), Index("ix_emergency_handoffs_retention", "retention_until"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip_sessions.id", ondelete="CASCADE"), nullable=False)
    initiated_by: Mapped[str] = mapped_column(String(128), nullable=False)
    handoff_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(64), nullable=False)
    consent_source: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(128))
    failure_code: Mapped[str | None] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    trip: Mapped[TripSession] = relationship(back_populates="emergency_handoffs")


class TripEvent(Base):
    __tablename__ = "trip_events"
    __table_args__ = (
        UniqueConstraint("trip_id", "event_id", name="uq_trip_events_trip_event_id"),
        UniqueConstraint("trip_id", "idempotency_key", name="uq_trip_events_trip_key"),
        Index("ix_trip_events_trip_created", "trip_id", "created_at"),
        Index("ix_trip_events_retention", "retention_until"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trip_sessions.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    actor: Mapped[str] = mapped_column(String(32), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confidence: Mapped[str | None] = mapped_column(String(16))
    consent_reference: Mapped[str | None] = mapped_column(String(128))
    consent_version: Mapped[str | None] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    redacted_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    trip: Mapped[TripSession] = relationship(back_populates="events")


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"
    __table_args__ = (
        UniqueConstraint("owner_session_id", "contact_reference", name="uq_trusted_contacts_owner_ref"),
        Index("ix_trusted_contacts_owner_status", "owner_session_id", "verification_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    owner_session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    contact_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(32))
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    relationship_label: Mapped[str] = mapped_column(String(64), nullable=False)
    verification_status: Mapped[str] = mapped_column(String(24), nullable=False, default="PENDING")
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    sharing_grants: Mapped[list["SharingGrant"]] = relationship(
        back_populates="contact", cascade="all, delete-orphan"
    )


class SharingGrant(Base):
    __tablename__ = "sharing_grants"
    __table_args__ = (
        UniqueConstraint("trip_id", "contact_id", name="uq_sharing_grants_trip_contact"),
        Index("ix_sharing_grants_status_expires", "status", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trip_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trusted_contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope: Mapped[str] = mapped_column(String(24), nullable=False, default="STATUS_ONLY")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACTIVE")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    trip: Mapped[TripSession] = relationship(back_populates="sharing_grants")
    contact: Mapped[TrustedContact] = relationship(back_populates="sharing_grants")


class TripDeviation(Base):
    __tablename__ = "trip_deviations"
    __table_args__ = (
        Index("ix_trip_deviations_trip_status", "trip_id", "status"),
        Index("ix_trip_deviations_retention", "retention_until"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trip_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    original_route_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("routes.id", ondelete="RESTRICT"), nullable=False
    )
    alternate_route_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("routes.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(40), nullable=False, default="DEVIATION_PENDING_CONFIRMATION"
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    user_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_response: Mapped[str | None] = mapped_column(String(32))
    deviation_event_id: Mapped[str | None] = mapped_column(String(64))
    context_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("context_versions.id", ondelete="SET NULL"), nullable=True
    )
    context_band: Mapped[str | None] = mapped_column(String(40))
    confidence: Mapped[str | None] = mapped_column(String(16))
    explanation: Mapped[dict | None] = mapped_column(JSON)
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    trip: Mapped[TripSession] = relationship(back_populates="deviations")


class NotificationDispatch(Base):
    __tablename__ = "notification_dispatches"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_notification_dispatches_key"),
        Index("ix_notification_dispatches_trip_status", "trip_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trip_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trusted_contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="IN_APP")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="QUEUED")
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    attempts: Mapped[int] = mapped_column(nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(String(255))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
