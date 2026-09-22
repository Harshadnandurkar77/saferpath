from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReportCategory(StrEnum):
    LIGHTING = "LIGHTING"
    ACCESSIBILITY = "ACCESSIBILITY"
    PEDESTRIAN_INFRASTRUCTURE = "PEDESTRIAN_INFRASTRUCTURE"
    ACTIVITY_CONTEXT = "ACTIVITY_CONTEXT"
    TRANSIT_CONTEXT = "TRANSIT_CONTEXT"
    SOMETHING_ELSE = "SOMETHING_ELSE"


class PublicationIntent(StrEnum):
    PUBLIC_CONTEXT = "PUBLIC_CONTEXT"
    RESTRICTED_EVIDENCE = "RESTRICTED_EVIDENCE"


class ModerationStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED_PUBLIC_CONTEXT = "ACCEPTED_PUBLIC_CONTEXT"
    ACCEPTED_RESTRICTED_EVIDENCE = "ACCEPTED_RESTRICTED_EVIDENCE"
    MERGED = "MERGED"
    REJECTED = "REJECTED"
    CORRECTED = "CORRECTED"
    EXPIRED = "EXPIRED"
    ESCALATED = "ESCALATED"


class ReportCreateRequest(BaseModel):
    """No free text or coordinates: BE-05A stores structured, coarse evidence only."""

    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=128)
    idempotency_key: str = Field(min_length=8, max_length=255)
    category: ReportCategory
    observed_at: datetime
    route_segment_id: str | None = None
    coarse_area: str | None = Field(
        default=None, pattern="^(MUMBAI_(SOUTH|CENTRAL|NORTH|EAST|WEST))$"
    )
    publication_intent: PublicationIntent = PublicationIntent.RESTRICTED_EVIDENCE

    @model_validator(mode="after")
    def valid_location_and_time(self) -> "ReportCreateRequest":
        if (self.route_segment_id is None) == (self.coarse_area is None):
            raise ValueError("provide exactly one coarse location association")
        if self.observed_at.tzinfo is None:
            raise ValueError("observed_at must include a timezone")
        return self


class ReportResponse(BaseModel):
    report_id: str
    reference: str
    category: ReportCategory
    observed_at: datetime
    submitted_at: datetime
    publication_intent: PublicationIntent
    moderation_status: ModerationStatus
    expires_at: datetime
    coarse_area: str | None
    reused: bool = False
