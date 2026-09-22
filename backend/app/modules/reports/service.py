import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.reports import (
    IncidentReport,
    ReportModerationAction,
    ReportRelationship,
    ReportSegmentAssociation,
)
from app.models.routing import RouteSegment
from app.modules.reports.schemas import ModerationStatus, ReportCreateRequest, ReportResponse


class ReportFailure(Exception):
    def __init__(self, category: str) -> None:
        self.category = category
        super().__init__(category)


class ReportService:
    _TRANSITIONS = {
        "PENDING": {
            "ACCEPTED_PUBLIC_CONTEXT",
            "ACCEPTED_RESTRICTED_EVIDENCE",
            "REJECTED",
            "ESCALATED",
            "EXPIRED",
        },
        "ACCEPTED_PUBLIC_CONTEXT": {"CORRECTED", "MERGED", "EXPIRED", "ESCALATED"},
        "ACCEPTED_RESTRICTED_EVIDENCE": {"CORRECTED", "MERGED", "EXPIRED", "ESCALATED"},
        "CORRECTED": {
            "ACCEPTED_PUBLIC_CONTEXT",
            "ACCEPTED_RESTRICTED_EVIDENCE",
            "REJECTED",
            "EXPIRED",
        },
        "ESCALATED": {
            "ACCEPTED_PUBLIC_CONTEXT",
            "ACCEPTED_RESTRICTED_EVIDENCE",
            "REJECTED",
            "EXPIRED",
        },
        "MERGED": set(),
        "REJECTED": set(),
        "EXPIRED": set(),
    }

    def transition(
        self, db: Session, report_id: str, new_status: ModerationStatus, reason_code: str
    ) -> None:
        try:
            report = db.get(IncidentReport, uuid.UUID(report_id))
        except ValueError as exc:
            raise ReportFailure("not_found") from exc
        if report is None:
            raise ReportFailure("not_found")
        if new_status.value not in self._TRANSITIONS.get(report.moderation_status, set()):
            raise ReportFailure("invalid_transition")
        db.add(
            ReportModerationAction(
                report_id=report.id,
                previous_status=report.moderation_status,
                new_status=new_status.value,
                reason_code=reason_code,
            )
        )
        report.moderation_status = new_status.value
        db.flush()

    def classify_relationship(
        self, first: IncidentReport, second: IncidentReport
    ) -> tuple[str, str]:
        """Canonical, identity-free rules: same segment/category/time window is duplicate;
        nearby temporal evidence is related; same place/time with incompatible categories conflicts."""
        window = timedelta(minutes=get_settings().report_cluster_minutes)
        delta = abs(first.observed_at - second.observed_at)
        same_place = (
            first.route_segment_id is not None and first.route_segment_id == second.route_segment_id
        )
        if same_place and delta <= window and first.category == second.category:
            return "DUPLICATE", "SAME_SEGMENT_CATEGORY_WINDOW"
        if same_place and delta <= window and first.category != second.category:
            return "CONFLICTING", "SAME_SEGMENT_WINDOW_DIFFERENT_CATEGORY"
        if same_place and delta <= window * 2:
            return "RELATED", "SAME_SEGMENT_NEAR_WINDOW"
        return "DISTINCT", "SEPARATE_SEGMENT_OR_TIME"

    def relate(self, db: Session, first_id: uuid.UUID, second_id: uuid.UUID) -> ReportRelationship:
        if first_id == second_id:
            raise ReportFailure("invalid_relationship")
        first, second = db.get(IncidentReport, first_id), db.get(IncidentReport, second_id)
        if first is None or second is None:
            raise ReportFailure("not_found")
        left, right = sorted((first, second), key=lambda report: str(report.id))
        existing = db.scalar(
            select(ReportRelationship).where(
                ReportRelationship.report_a_id == left.id,
                ReportRelationship.report_b_id == right.id,
            )
        )
        if existing:
            return existing
        relationship_type, reason_code = self.classify_relationship(left, right)
        relationship = ReportRelationship(
            report_a_id=left.id,
            report_b_id=right.id,
            relationship_type=relationship_type,
            reason_code=reason_code,
        )
        db.add(relationship)
        db.flush()
        return relationship

    def associate_segments(
        self, db: Session, report: IncidentReport
    ) -> list[ReportSegmentAssociation]:
        if report.coarse_geometry is None:
            return []
        from app.models.routing import RouteSegment

        distance = get_settings().report_spatial_association_meters
        segment_ids = db.scalars(
            select(RouteSegment.id)
            .select_from(RouteSegment)
            .join(IncidentReport, IncidentReport.id == report.id)
            .where(
                func.ST_DWithin(
                    func.geography(IncidentReport.coarse_geometry),
                    func.geography(RouteSegment.geometry),
                    distance,
                )
            )
            .order_by(RouteSegment.id)
        ).all()
        results = []
        for segment_id in segment_ids:
            row = db.scalar(
                select(ReportSegmentAssociation).where(
                    ReportSegmentAssociation.report_id == report.id,
                    ReportSegmentAssociation.route_segment_id == segment_id,
                )
            )
            if row is None:
                row = ReportSegmentAssociation(
                    report_id=report.id,
                    route_segment_id=segment_id,
                    relationship="PROXIMITY",
                    strength="COARSE_PROXIMITY",
                )
                db.add(row)
                db.flush()
            results.append(row)
        return results

    def create(self, db: Session, payload: ReportCreateRequest) -> ReportResponse:
        fingerprint = self._fingerprint(payload)
        existing = db.scalar(
            select(IncidentReport).where(IncidentReport.idempotency_key == payload.idempotency_key)
        )
        if existing:
            if (
                existing.reporter_session_id != payload.session_id
                or existing.request_fingerprint != fingerprint
            ):
                raise ReportFailure("idempotency_conflict")
            return self._response(existing, True)
        segment_id = self._segment_id(db, payload.route_segment_id)
        now = datetime.now(UTC)
        report = IncidentReport(
            public_reference=f"rpt_{secrets.token_urlsafe(16)}",
            reporter_session_id=payload.session_id,
            route_segment_id=segment_id,
            coarse_area=payload.coarse_area,
            category=payload.category.value,
            observed_at=payload.observed_at,
            submitted_at=now,
            publication_intent=payload.publication_intent.value,
            moderation_status=ModerationStatus.PENDING.value,
            idempotency_key=payload.idempotency_key,
            request_fingerprint=fingerprint,
            expires_at=now + timedelta(days=get_settings().report_retention_days),
        )
        try:
            # Start the savepoint before adding the pending row: begin_nested
            # otherwise autoflushes it before the savepoint exists.
            with db.begin_nested():
                db.add(report)
                db.flush()
        except IntegrityError:
            existing = db.scalar(
                select(IncidentReport).where(
                    IncidentReport.idempotency_key == payload.idempotency_key
                )
            )
            if (
                existing
                and existing.reporter_session_id == payload.session_id
                and existing.request_fingerprint == fingerprint
            ):
                return self._response(existing, True)
            raise ReportFailure("idempotency_conflict") from None
        return self._response(report, False)

    def get(self, db: Session, report_id: str, session_id: str | None) -> ReportResponse:
        try:
            report = db.get(IncidentReport, uuid.UUID(report_id))
        except ValueError as exc:
            raise ReportFailure("not_found") from exc
        if report is None:
            raise ReportFailure("not_found")
        if not session_id or not secrets.compare_digest(report.reporter_session_id, session_id):
            raise ReportFailure("unauthorized")
        return self._response(report, False)

    def list_by_session(self, db: Session, session_id: str) -> list[ReportResponse]:
        if not session_id:
            return []
        reports = db.scalars(
            select(IncidentReport)
            .where(IncidentReport.reporter_session_id == session_id)
            .order_by(IncidentReport.submitted_at.desc())
        ).all()
        return [self._response(r, False) for r in reports]

    @staticmethod
    def _segment_id(db: Session, value: str | None) -> uuid.UUID | None:
        if value is None:
            return None
        try:
            segment_id = uuid.UUID(value)
        except ValueError as exc:
            raise ReportFailure("invalid_location") from exc
        if db.get(RouteSegment, segment_id) is None:
            raise ReportFailure("invalid_location")
        return segment_id

    @staticmethod
    def _fingerprint(payload: ReportCreateRequest) -> str:
        values = payload.model_dump(mode="json", exclude={"idempotency_key"})
        return hashlib.sha256(
            json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    @staticmethod
    def _response(report: IncidentReport, reused: bool) -> ReportResponse:
        return ReportResponse(
            report_id=str(report.id),
            reference=report.public_reference,
            category=report.category,
            observed_at=report.observed_at,
            submitted_at=report.submitted_at,
            publication_intent=report.publication_intent,
            moderation_status=report.moderation_status,
            expires_at=report.expires_at,
            coarse_area=report.coarse_area,
            reused=reused,
        )
