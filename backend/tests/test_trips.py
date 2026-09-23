import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.db.session import SessionLocal
from app.models.job_run import JobRun
from app.models.routing import Route
from app.models.trips import TripEvent, TripSession
from app.modules.trips.schemas import TripEventRequest
from app.modules.trips.service import TripJobService, TripService


def _route(client, owner="trip-owner"):
    key = f"trip-route-{uuid.uuid4()}"
    response = client.post(
        "/v1/routes/compare",
        json={
            "origin": {"longitude": 72.8373, "latitude": 19.0269},
            "destination": {"longitude": 72.8433, "latitude": 19.018},
            "timezone": "Asia/Kolkata",
            "requested_local_time": "2026-09-19T18:00:00",
            "time_mode": "departure",
            "travel_mode": "walking",
            "idempotency_key": key,
            "session_id": owner,
        },
    )
    assert response.status_code == 201
    return response.json()["routes"][0]["id"], key


def _trip(client, owner="trip-owner", scope="STATUS_ONLY"):
    route_id, route_key = _route(client, owner)
    response = client.post(
        "/v1/trips",
        json={
            "route_id": route_id,
            "session_id": owner,
            "planned_arrival": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
            "travel_mode": "walking",
            "active_trip_consent": True,
            "consent_reference": "active-trip-policy",
            "consent_version": "2026-09",
            "sharing_scope": scope,
        },
    )
    assert response.status_code == 201, response.text
    return response.json(), route_key


@pytest.fixture(autouse=True)
def cleanup():
    keys = []
    yield keys
    with SessionLocal.begin() as session:
        for route_key in keys:
            session.execute(
                text(
                    "DELETE FROM trip_sessions WHERE route_id IN (SELECT id FROM routes WHERE route_request_id = (SELECT id FROM route_requests WHERE idempotency_key = :key))"
                ),
                {"key": route_key},
            )
            session.execute(
                text("DELETE FROM route_requests WHERE idempotency_key = :key"), {"key": route_key}
            )


def test_trip_requires_owned_route_and_explicit_consent(client, cleanup):
    route_id, route_key = _route(client, "owner-a")
    cleanup.append(route_key)
    base = {
        "route_id": route_id,
        "session_id": "owner-a",
        "planned_arrival": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "travel_mode": "walking",
        "active_trip_consent": True,
        "consent_reference": "policy-a",
        "consent_version": "v1",
    }
    assert client.post("/v1/trips", json=base | {"session_id": "owner-b"}).status_code == 403
    missing = client.post("/v1/trips", json=base | {"active_trip_consent": False})
    assert missing.status_code == 422
    created = client.post("/v1/trips", json=base)
    assert created.status_code == 201
    assert created.json()["status"] == "ACTIVE"
    assert created.json()["sharing_scope"] == "STATUS_ONLY"
    assert created.json()["consent_version"] == "v1"


def test_trip_accepts_a_normalized_route_from_a_non_fixture_provider(client, cleanup):
    """Trip creation must accept a persisted, normalized provider route.

    The test route uses deterministic fixture geometry, then is labelled as an
    OSRM result to cover the provider-agnostic contract used in development.
    """
    route_id, route_key = _route(client, "osrm-trip-owner")
    cleanup.append(route_key)
    with SessionLocal.begin() as session:
        route = session.get(Route, uuid.UUID(route_id))
        assert route is not None
        route.provider = "osrm"

    response = client.post(
        "/v1/trips",
        json={
            "route_id": route_id,
            "session_id": "osrm-trip-owner",
            "planned_arrival": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
            "travel_mode": "walking",
            "active_trip_consent": True,
            "consent_reference": "active-trip-policy",
            "consent_version": "v1",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["status"] == "ACTIVE"


def test_events_checkin_stop_and_ownership_idempotency(client, cleanup):
    trip, route_key = _trip(client)
    cleanup.append(route_key)
    trip_id = trip["trip_id"]
    now = datetime.now(UTC).isoformat()
    event = {
        "event_id": "event-update-0001",
        "idempotency_key": "event-key-0001",
        "event_type": "TRIP_UPDATED",
        "occurred_at": now,
    }
    assert (
        client.post(f"/v1/trips/{trip_id}/events?session_id=other", json=event).status_code == 403
    )
    first = client.post(f"/v1/trips/{trip_id}/events?session_id=trip-owner", json=event)
    assert first.status_code == 200
    assert (
        client.post(f"/v1/trips/{trip_id}/events?session_id=trip-owner", json=event).status_code
        == 200
    )
    conflict = client.post(
        f"/v1/trips/{trip_id}/events?session_id=trip-owner",
        json=event | {"event_type": "USER_CONFIRMED_OK"},
    )
    assert conflict.status_code == 409
    checkin = {
        "session_id": "trip-owner",
        "event_id": "checkin-0001",
        "idempotency_key": "checkin-key-0001",
        "occurred_at": now,
    }
    assert client.post(f"/v1/trips/{trip_id}/check-in", json=checkin).status_code == 200
    assert client.post(f"/v1/trips/{trip_id}/check-in", json=checkin).status_code == 200
    stop = {
        "session_id": "trip-owner",
        "event_id": "stop-event-0001",
        "idempotency_key": "stop-key-0001",
        "occurred_at": now,
    }
    assert client.post(f"/v1/trips/{trip_id}/stop", json=stop).json()["status"] == "STOPPED"
    assert client.post(f"/v1/trips/{trip_id}/stop", json=stop).status_code == 200
    assert client.get(f"/v1/trips/{trip_id}/stream?session_id=trip-owner").status_code == 410
    assert (
        client.post(
            f"/v1/trips/{trip_id}/check-in",
            json=checkin | {"event_id": "checkin-0002", "idempotency_key": "checkin-key-0002"},
        ).status_code
        == 409
    )


def test_location_is_transient_consent_scoped_and_detects_deviation(client, cleanup):
    status_trip, route_key = _trip(client)
    cleanup.append(route_key)
    status_event = {
        "event_id": "update-status-000001",
        "idempotency_key": "update-status-key",
        "event_type": "TRIP_UPDATED",
        "occurred_at": datetime.now(UTC).isoformat(),
        "location": {"longitude": 72.8373, "latitude": 19.0269},
    }
    assert (
        client.post(
            f"/v1/trips/{status_trip['trip_id']}/events?session_id=trip-owner", json=status_event
        ).status_code
        == 403
    )
    trip, route_key = _trip(client, scope="LOCATION")
    cleanup.append(route_key)
    payload = status_event | {
        "event_id": "update-on-route-0001",
        "idempotency_key": "update-on-route-key",
    }
    on_route = client.post(
        f"/v1/trips/{trip['trip_id']}/events?session_id=trip-owner", json=payload
    )
    assert on_route.status_code == 200
    outside = client.post(
        f"/v1/trips/{trip['trip_id']}/events?session_id=trip-owner",
        json=payload
        | {
            "event_id": "update-outside-0001",
            "idempotency_key": "update-outside-key",
            "location": {"longitude": 72.90, "latitude": 19.10},
        },
    )
    assert outside.json()["status"] == "DEVIATED"
    polled = client.get(f"/v1/trips/{trip['trip_id']}?session_id=trip-owner")
    assert polled.status_code == 200
    assert "72.90" not in polled.text and "19.10" not in polled.text
    assert (
        client.post(
            f"/v1/trips/{trip['trip_id']}/events?session_id=trip-owner",
            json=payload
            | {"event_id": "update-return-0001", "idempotency_key": "update-return-key"},
        ).json()["status"]
        == "ACTIVE"
    )


def test_jobs_stream_replay_and_expiry(client, cleanup):
    trip, route_key = _trip(client, scope="LOCATION")
    cleanup.append(route_key)
    trip_id = trip["trip_id"]
    now = datetime.now(UTC)
    with SessionLocal.begin() as session:
        entity = session.scalar(select(TripSession).where(TripSession.public_reference == trip_id))
        entity.planned_arrival = now - timedelta(minutes=11)
        prompt = session.scalar(
            select(JobRun).where(
                JobRun.job_type == "trip_checkin_prompt",
                JobRun.idempotency_key == f"{entity.id}:trip_checkin_prompt",
            )
        )
        TripJobService().run(session, prompt, now)
        missed = session.scalar(
            select(JobRun).where(
                JobRun.job_type == "trip_missed_checkin",
                JobRun.idempotency_key == f"{entity.id}:trip_missed_checkin",
            )
        )
        TripJobService().run(session, missed, now)
        assert entity.status == "MISSED_CHECKIN"
        assert prompt.status == missed.status == "completed"
        TripJobService().run(session, missed, now)
        session.flush()
        assert (
            session.scalar(
                select(func.count())
                .select_from(TripEvent)
                .where(TripEvent.trip_id == entity.id, TripEvent.event_type == "CHECKIN_MISSED")
            )
            == 1
        )
    stream = client.get(f"/v1/trips/{trip_id}/stream?session_id=trip-owner")
    assert stream.status_code == 200
    assert "event: CHECKIN_MISSED" in stream.text and ": heartbeat" in stream.text
    assert client.get(f"/v1/trips/{trip_id}/stream?session_id=other").status_code == 403
    with SessionLocal.begin() as session:
        entity = session.scalar(select(TripSession).where(TripSession.public_reference == trip_id))
        entity.retention_until = now - timedelta(seconds=1)
        expiry = session.scalar(
            select(JobRun).where(
                JobRun.job_type == "trip_expiry",
                JobRun.idempotency_key == f"{entity.id}:trip_expiry",
            )
        )
        TripJobService().run(session, expiry, now)
        assert entity.status == "EXPIRED"
    assert client.get(f"/v1/trips/{trip_id}?session_id=trip-owner").status_code == 410


def test_concurrent_duplicate_event_creates_one_durable_event(client, cleanup):
    trip, route_key = _trip(client)
    cleanup.append(route_key)
    payload = TripEventRequest(
        event_id="concurrent-event-001",
        idempotency_key="concurrent-event-key-001",
        event_type="TRIP_UPDATED",
        occurred_at=datetime.now(UTC),
    )

    def submit() -> str:
        with SessionLocal.begin() as session:
            return TripService().event(session, trip["trip_id"], "trip-owner", payload).trip_id

    with ThreadPoolExecutor(max_workers=2) as executor:
        ids = list(executor.map(lambda _: submit(), range(2)))
    assert ids == [trip["trip_id"], trip["trip_id"]]
    with SessionLocal() as session:
        entity = session.scalar(select(TripSession).where(TripSession.public_reference == trip["trip_id"]))
        assert session.scalar(select(func.count()).select_from(TripEvent).where(TripEvent.trip_id == entity.id, TripEvent.idempotency_key == payload.idempotency_key)) == 1
