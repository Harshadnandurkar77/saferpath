import base64

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_transactional_db
from app.modules.reports.evidence import EvidenceFailure, EvidenceService
from app.modules.reports.schemas import ReportCreateRequest, ReportResponse
from app.modules.reports.service import ReportFailure, ReportService
from app.schemas.errors import ErrorEnvelope

router = APIRouter(tags=["reports"])
service = ReportService()
evidence_service = EvidenceService()

_FAILURES = {
    "invalid_location": (422, "REPORT_LOCATION_INVALID", "Report location is not supported."),
    "idempotency_conflict": (
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key was used for a different request.",
    ),
    "not_found": (404, "REPORT_NOT_FOUND", "Report was not found."),
    "unauthorized": (403, "REPORT_ACCESS_DENIED", "Report access is not permitted."),
}


def _error(request: Request, failure: ReportFailure) -> JSONResponse:
    status_code, code, message = _FAILURES.get(
        failure.category, (500, "REPORT_PERSISTENCE_FAILED", "Report could not be saved.")
    )
    return JSONResponse(
        status_code=status_code,
        content=ErrorEnvelope(
            error={"code": code, "message": message, "request_id": request.state.request_id}
        ).model_dump(exclude_none=True),
    )


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    request: Request,
    payload: ReportCreateRequest,
    db: Session = Depends(get_transactional_db),
) -> ReportResponse | JSONResponse:
    try:
        response = service.create(db, payload)
    except ReportFailure as exc:
        return _error(request, exc)
    return JSONResponse(
        status_code=status.HTTP_200_OK if response.reused else status.HTTP_201_CREATED,
        content=response.model_dump(mode="json"),
    )


@router.get("/reports", response_model=list[ReportResponse])
def list_reports(
    session_id: str,
    db: Session = Depends(get_transactional_db),
) -> list[ReportResponse]:
    return service.list_by_session(db, session_id)


@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    request: Request,
    session_id: str | None = None,
    db: Session = Depends(get_transactional_db),
) -> ReportResponse | JSONResponse:
    try:
        return service.get(db, report_id, session_id)
    except ReportFailure as exc:
        return _error(request, exc)


class EvidenceAuthorizationRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    idempotency_key: str = Field(min_length=8, max_length=255)
    content_type: str = Field(max_length=64)
    size_bytes: int


class EvidenceCompletionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    upload_token: str = Field(min_length=16, max_length=256)
    content_base64: str = Field(max_length=14_000_000)


def _evidence_error(request: Request, exc: EvidenceFailure) -> JSONResponse:
    mapping = {
        "access_denied": (403, "EVIDENCE_ACCESS_DENIED"),
        "not_found": (404, "EVIDENCE_NOT_FOUND"),
        "unsupported_type": (422, "EVIDENCE_TYPE_UNSUPPORTED"),
        "invalid_size": (422, "EVIDENCE_SIZE_INVALID"),
        "invalid_content": (422, "EVIDENCE_CONTENT_INVALID"),
        "invalid_authorization": (403, "UPLOAD_AUTHORIZATION_INVALID"),
        "expired_authorization": (410, "UPLOAD_AUTHORIZATION_EXPIRED"),
        "infected": (422, "EVIDENCE_REJECTED"),
        "scanner_failure": (503, "EVIDENCE_SCANNER_UNAVAILABLE"),
        "invalid_transition": (409, "EVIDENCE_STATE_INVALID"),
        "idempotency_conflict": (409, "IDEMPOTENCY_CONFLICT"),
        "authorization_reuse": (409, "UPLOAD_AUTHORIZATION_REUSED"),
    }
    status_code, code = mapping.get(exc.code, (500, "EVIDENCE_PERSISTENCE_FAILED"))
    return JSONResponse(
        status_code=status_code,
        content=ErrorEnvelope(
            error={
                "code": code,
                "message": "Evidence request could not be completed.",
                "request_id": request.state.request_id,
            }
        ).model_dump(),
    )


@router.post("/reports/{report_id}/evidence/upload-authorizations", status_code=201)
def authorize_evidence(
    report_id: str,
    payload: EvidenceAuthorizationRequest,
    request: Request,
    db: Session = Depends(get_transactional_db),
):
    try:
        evidence, token, _ = evidence_service.authorize(
            db,
            report_id,
            payload.session_id,
            payload.content_type,
            payload.size_bytes,
            payload.idempotency_key,
        )
        return {
            "evidence_id": str(evidence.id),
            "reference": evidence.public_reference,
            "upload_token": token,
            "expires_at": evidence.upload_expires_at,
        }
    except EvidenceFailure as exc:
        return _evidence_error(request, exc)


@router.post("/reports/{report_id}/evidence/{evidence_id}/complete")
def complete_evidence(
    report_id: str,
    evidence_id: str,
    payload: EvidenceCompletionRequest,
    request: Request,
    db: Session = Depends(get_transactional_db),
):
    try:
        content = base64.b64decode(payload.content_base64, validate=True)
        evidence = evidence_service.complete(
            db, report_id, evidence_id, payload.session_id, payload.upload_token, content
        )
        return {
            "evidence_id": str(evidence.id),
            "reference": evidence.public_reference,
            "state": evidence.upload_state,
        }
    except (ValueError, base64.binascii.Error):
        return _evidence_error(request, EvidenceFailure("invalid_content"))
    except EvidenceFailure as exc:
        return _evidence_error(request, exc)


@router.get("/reports/{report_id}/evidence")
def list_evidence(
    report_id: str, session_id: str, request: Request, db: Session = Depends(get_transactional_db)
):
    try:
        return [
            {
                "evidence_id": str(item.id),
                "reference": item.public_reference,
                "content_type": item.content_type,
                "size_bytes": item.size_bytes,
                "state": item.upload_state,
                "retention_until": item.retention_until,
            }
            for item in evidence_service.list_owned(db, report_id, session_id)
        ]
    except EvidenceFailure as exc:
        return _evidence_error(request, exc)


@router.delete("/reports/{report_id}/evidence/{evidence_id}", status_code=204)
def delete_evidence(
    report_id: str,
    evidence_id: str,
    session_id: str,
    request: Request,
    db: Session = Depends(get_transactional_db),
):
    try:
        evidence_service.delete(db, report_id, evidence_id, session_id)
        return JSONResponse(status_code=204, content=None)
    except EvidenceFailure as exc:
        return _evidence_error(request, exc)
