import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import func, select, text

from app.db.session import SessionLocal
from app.models.reports import IncidentReport
from app.modules.reports.schemas import ReportCreateRequest
from app.modules.reports.service import ReportService


def _payload(key: str | None = None) -> dict:
    return {
        "session_id": "reporter-session",
        "idempotency_key": key or f"report-{uuid.uuid4()}",
        "category": "LIGHTING",
        "observed_at": "2026-09-19T18:00:00+05:30",
        "coarse_area": "MUMBAI_CENTRAL",
        "publication_intent": "RESTRICTED_EVIDENCE",
    }


def _cleanup(report_id: str | None) -> None:
    if report_id:
        with SessionLocal() as session:
            session.execute(text("DELETE FROM incident_reports WHERE id = :id"), {"id": uuid.UUID(report_id)})
            session.commit()


def test_report_create_get_idempotency_and_privacy(client):
    payload = _payload()
    report_id = None
    try:
        created = client.post("/v1/reports", json=payload)
        assert created.status_code == 201
        body = created.json()
        report_id = body["report_id"]
        assert body["moderation_status"] == "PENDING"
        assert body["category"] == "LIGHTING"
        assert "reporter_session_id" not in body
        assert "route_segment_id" not in body
        assert "longitude" not in str(body)
        reused = client.post("/v1/reports", json=payload)
        assert reused.status_code == 200
        assert reused.json()["report_id"] == report_id
        fetched = client.get(f"/v1/reports/{report_id}?session_id=reporter-session")
        assert fetched.status_code == 200
        assert fetched.json()["report_id"] == report_id
        assert client.get(f"/v1/reports/{report_id}?session_id=other").status_code == 403
    finally:
        _cleanup(report_id)


def test_report_validation_and_idempotency_conflict(client):
    key = f"report-{uuid.uuid4()}"
    report_id = None
    try:
        invalid = client.post("/v1/reports", json=_payload() | {"category": "ARBITRARY"})
        assert invalid.status_code == 422
        assert "ARBITRARY" not in str(invalid.json())
        assert client.post("/v1/reports", json=_payload() | {"observed_at": "2026-09-19T18:00:00"}).status_code == 422
        assert client.post("/v1/reports", json=_payload() | {"coarse_area": "NOT_A_PLACE"}).status_code == 422
        created = client.post("/v1/reports", json=_payload(key))
        report_id = created.json()["report_id"]
        conflict = client.post("/v1/reports", json=_payload(key) | {"category": "TRANSIT_CONTEXT"})
        assert conflict.status_code == 409
        assert client.get("/v1/reports/00000000-0000-0000-0000-000000000000?session_id=reporter-session").status_code == 404
    finally:
        _cleanup(report_id)


def test_report_idempotency_is_race_safe_and_creates_one_durable_report():
    """Independent PostgreSQL sessions must converge on one idempotent report."""
    key = f"report-race-{uuid.uuid4()}"
    payload = ReportCreateRequest.model_validate(_payload(key))

    def create() -> tuple[str, bool]:
        with SessionLocal.begin() as session:
            response = ReportService().create(session, payload)
            return response.report_id, response.reused

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: create(), range(2)))

        report_ids = {response[0] for response in responses}
        assert len(report_ids) == 1
        assert sorted(response[1] for response in responses) == [False, True]
        with SessionLocal() as session:
            assert session.scalar(
                select(func.count())
                .select_from(IncidentReport)
                .where(IncidentReport.idempotency_key == key)
            ) == 1
    finally:
        with SessionLocal() as session:
            session.execute(
                text("DELETE FROM incident_reports WHERE idempotency_key = :key"), {"key": key}
            )
            session.commit()


def test_report_list_by_session_and_something_else_category(client):
    sid = f"user-reports-{uuid.uuid4()}"
    p1 = _payload() | {"session_id": sid, "idempotency_key": f"r1-{uuid.uuid4()}", "category": "SOMETHING_ELSE"}
    p2 = _payload() | {"session_id": sid, "idempotency_key": f"r2-{uuid.uuid4()}", "category": "LIGHTING"}

    res1 = client.post("/v1/reports", json=p1)
    assert res1.status_code == 201
    assert res1.json()["category"] == "SOMETHING_ELSE"

    res2 = client.post("/v1/reports", json=p2)
    assert res2.status_code == 201

    list_res = client.get(f"/v1/reports?session_id={sid}")
    assert list_res.status_code == 200
    reports = list_res.json()
    assert len(reports) == 2
    assert {r["category"] for r in reports} == {"SOMETHING_ELSE", "LIGHTING"}

    # Cleanup
    with SessionLocal() as session:
        session.execute(text("DELETE FROM incident_reports WHERE reporter_session_id = :sid"), {"sid": sid})
        session.commit()

