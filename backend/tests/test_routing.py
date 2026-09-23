import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

from app.db.session import SessionLocal
from app.main import app
from app.models.routing import Route, RouteRequest, RouteSegment
from app.modules.routing.errors import RoutingFailure
from app.modules.routing.fixture import FixtureRoutingProvider
from app.modules.routing.normalization import (
    RouteNormalizationError,
    canonical_segment_id,
    normalize_route,
)
from app.modules.routing.provider import (
    ProviderRoute,
    ProviderRouteRequest,
    ProviderSegment,
    RoutingProviderError,
)
from app.modules.routing.schemas import RouteComparisonRequest
from app.modules.routing.service import RouteComparisonService


def test_fixture_routes_are_deterministic_and_normalized():
    provider = FixtureRoutingProvider()
    request = ProviderRouteRequest((72.8373, 19.0269), (72.8433, 19.0180), "walking")
    first = provider.routes(request)
    second = provider.routes(request)
    assert first == second
    assert len(first) == 3
    normalized = [normalize_route(route) for route in first]
    assert [route.sequence for route in normalized] == [1, 2, 3]
    second_normalized = [normalize_route(route) for route in second]
    assert [[segment.canonical_id for segment in route.segments] for route in normalized] == [
        [segment.canonical_id for segment in route.segments] for route in second_normalized
    ]
    assert len({route.coordinates for route in normalized}) == 3
    assert all(route.metadata == {"dataset": "mumbai-pilot-v1"} for route in normalized)


def test_fixture_provider_rejects_requests_outside_configured_pilot_area():
    provider = FixtureRoutingProvider()
    request = ProviderRouteRequest((73.5, 19.0269), (72.8433, 19.0180), "walking")
    with pytest.raises(RoutingFailure, match="outside_pilot"):
        provider.routes(request)


def test_segment_identity_uses_canonical_geometry():
    assert canonical_segment_id(((72.1, 19.1), (72.2, 19.2))) == canonical_segment_id(
        ((72.1, 19.1), (72.2, 19.2))
    )


def test_segment_identity_does_not_depend_on_provider_route_reference():
    segment = ProviderSegment(1, ((72.1, 19.1), (72.2, 19.2)), 10, 10)
    routes = [
        ProviderRoute(reference, 1, segment.coordinates, 10, 10, (segment,), {})
        for reference in ("temporary-a", "temporary-b")
    ]
    assert normalize_route(routes[0]).segments[0].canonical_id == normalize_route(routes[1]).segments[0].canonical_id


def test_normalization_rejects_bad_segment_order_and_coordinates():
    bad = ProviderRoute(
        "bad",
        1,
        ((72.0, 19.0), (72.1, 19.1)),
        10,
        10,
        (ProviderSegment(2, ((72.0, 19.0), (72.1, 19.1)), 10, 10),),
        {},
    )
    try:
        normalize_route(bad)
    except RouteNormalizationError:
        pass
    else:
        raise AssertionError("invalid ordering accepted")


def test_segment_identity_rejects_geometry_that_collapses_at_canonical_precision():
    with pytest.raises(RouteNormalizationError, match="degenerate geometry"):
        canonical_segment_id(((72.0000001, 19.0), (72.0000002, 19.0)))


def test_request_rejects_bad_timezone_coordinates_and_same_points():
    base = {
        "origin": {"longitude": 72.0, "latitude": 19.0},
        "destination": {"longitude": 72.1, "latitude": 19.1},
        "timezone": "Asia/Kolkata",
        "requested_local_time": "2026-09-19T18:00:00",
        "time_mode": "departure",
        "idempotency_key": "routing-test-key",
    }
    assert RouteComparisonRequest.model_validate(base).travel_mode == "walking"
    for change in (
        {"timezone": "Bad/Timezone"},
        {"origin": {"longitude": 999, "latitude": 19}},
        {"destination": base["origin"]},
    ):
        candidate = base | change
        try:
            RouteComparisonRequest.model_validate(candidate)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid request accepted")


def test_canonical_compare_api_is_idempotent_and_returns_time_context(client):
    key = f"routing-api-{uuid.uuid4()}"
    payload = {
        "origin": {"longitude": 72.8373, "latitude": 19.0269},
        "destination": {"longitude": 72.8433, "latitude": 19.018},
        "timezone": "Asia/Kolkata",
        "requested_local_time": "2026-09-19T18:00:00",
        "time_mode": "arrival",
        "idempotency_key": key,
    }
    try:
        first = client.post("/v1/routes/compare", json=payload)
        second = client.post("/v1/routes/compare", json=payload)
        assert first.status_code == 201
        assert len(first.json()["routes"]) == 3
        assert first.json()["time_mode"] == "arrival"
        assert first.json()["timezone"] == "Asia/Kolkata"
        assert first.json()["route_preference"] == "balanced"
        assert first.json()["provider_source"] == "fixture"
        assert first.json()["routes"][0]["provider_metadata"] == {"dataset": "mumbai-pilot-v1"}
        assert second.status_code == 201
        assert second.json()["reused"] is True
        assert client.post("/v1/route-requests", json=payload).status_code == 404
    finally:
        with SessionLocal() as session:
            session.execute(
                text("DELETE FROM route_requests WHERE idempotency_key = :key"), {"key": key}
            )
            session.commit()


def test_compare_api_returns_safe_coverage_and_validation_errors(client):
    base = {
        "origin": {"longitude": 72.8373, "latitude": 19.0269},
        "destination": {"longitude": 72.8433, "latitude": 19.018},
        "timezone": "Asia/Kolkata",
        "requested_local_time": "2026-09-19T18:00:00",
        "time_mode": "departure",
        "idempotency_key": f"routing-error-{uuid.uuid4()}",
    }
    outside = client.post("/v1/routes/compare", json=base | {"origin": {"longitude": 73, "latitude": 19}})
    assert outside.status_code == 422
    assert outside.json()["error"]["code"] == "PILOT_AREA_UNSUPPORTED"
    assert outside.json()["error"]["request_id"]
    extra = client.post("/v1/routes/compare", json=base | {"provider_url": "http://169.254.169.254"})
    assert extra.status_code == 422
    assert extra.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "169.254" not in str(extra.json())


def test_idempotency_key_cannot_represent_two_requests(client):
    key = f"routing-conflict-{uuid.uuid4()}"
    base = {
        "origin": {"longitude": 72.8373, "latitude": 19.0269},
        "destination": {"longitude": 72.8433, "latitude": 19.018},
        "timezone": "Asia/Kolkata",
        "requested_local_time": "2026-09-19T18:00:00",
        "time_mode": "departure",
        "idempotency_key": key,
    }
    try:
        assert client.post("/v1/routes/compare", json=base).status_code == 201
        conflict = client.post(
            "/v1/routes/compare", json=base | {"route_preference": "fastest"}
        )
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    finally:
        with SessionLocal() as session:
            session.execute(text("DELETE FROM route_requests WHERE idempotency_key = :key"), {"key": key})
            session.commit()


def test_idempotency_key_does_not_reuse_a_different_session_result(client):
    key = f"routing-session-{uuid.uuid4()}"
    payload = {
        "origin": {"longitude": 72.8373, "latitude": 19.0269},
        "destination": {"longitude": 72.8433, "latitude": 19.018},
        "timezone": "Asia/Kolkata",
        "requested_local_time": "2026-09-19T18:00:00",
        "time_mode": "departure",
        "idempotency_key": key,
        "session_id": "session-a",
    }
    try:
        assert client.post("/v1/routes/compare", json=payload).status_code == 201
        second = client.post("/v1/routes/compare", json=payload | {"session_id": "session-b"})
        assert second.status_code == 409
        assert second.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    finally:
        with SessionLocal() as session:
            session.execute(text("DELETE FROM route_requests WHERE idempotency_key = :key"), {"key": key})
            session.commit()


def test_openapi_describes_canonical_route_comparison_contract(client):
    operation = client.get("/openapi.json").json()["paths"]["/v1/routes/compare"]["post"]
    assert "201" in operation["responses"]
    assert "503" in operation["responses"]
    assert "/v1/route-requests" not in client.get("/openapi.json").json()["paths"]


@pytest.mark.parametrize(
    ("category", "status_code", "code"),
    [
        ("unavailable", 503, "ROUTING_UNAVAILABLE"),
        ("timeout", 504, "ROUTING_TIMEOUT"),
        ("malformed_response", 502, "ROUTING_RESPONSE_INVALID"),
        ("no_route", 422, "NO_ROUTE_AVAILABLE"),
    ],
)
def test_provider_failures_are_safe_api_errors(client, monkeypatch, category, status_code, code):
    from app.api.v1 import routing as routing_api

    class FailingProvider:
        name = "test"

        def routes(self, request):
            if category == "malformed_response":
                return (ProviderRoute("bad", 1, (), 1, 1, (), {}), ProviderRoute("bad2", 2, (), 1, 1, (), {}))
            raise RoutingProviderError(category)

    monkeypatch.setattr(routing_api.service, "provider", FailingProvider())
    response = client.post(
        "/v1/routes/compare",
        json={
            "origin": {"longitude": 72.8373, "latitude": 19.0269},
            "destination": {"longitude": 72.8433, "latitude": 19.018},
            "timezone": "Asia/Kolkata",
            "requested_local_time": "2026-09-19T18:00:00",
            "time_mode": "departure",
            "idempotency_key": f"routing-failure-{uuid.uuid4()}",
        },
    )
    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code
    assert "ProviderRoute" not in str(response.json())


def test_validation_rejects_nonfinite_bounds_times_and_ssrf_fields():
    base = {"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": "routing-validation-key"}
    invalid = [
        {"origin": {"longitude": -181, "latitude": 19}}, {"origin": {"longitude": 181, "latitude": 19}},
        {"origin": {"longitude": 72, "latitude": -91}}, {"origin": {"longitude": 72, "latitude": 91}},
        {"origin": {"longitude": float("nan"), "latitude": 19}}, {"origin": {"longitude": float("inf"), "latitude": 19}},
        {"timezone": "Unknown/Timezone"}, {"requested_local_time": "2026-02-30T18:00:00"},
        {"travel_mode": "driving"}, {"route_preference": "safest"},
        {"callback_url": "https://example.invalid"}, {"webhook_url": "https://example.invalid"},
    ]
    for change in invalid:
        with pytest.raises(ValueError):
            RouteComparisonRequest.model_validate(base | change)


def test_normalization_rejects_geometry_size_and_invalid_coordinates():
    for geometry in (((72.0, 19.0),), tuple((72.0 + i / 10000, 19.0) for i in range(1001)), ((72.0, 19.0), (200.0, 19.0))):
        with pytest.raises(RouteNormalizationError):
            canonical_segment_id(geometry)


def test_idempotency_is_race_safe_and_does_not_duplicate_database_state():
    key = f"routing-race-{uuid.uuid4()}"
    payload = RouteComparisonRequest.model_validate({"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": key, "session_id": "race-session"})
    def create():
        with SessionLocal() as session:
            return RouteComparisonService(FixtureRoutingProvider()).create(session, payload).reused
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            assert sorted(executor.map(lambda _: create(), range(2))) == [False, True]
        with SessionLocal() as session:
            request = session.scalar(select(RouteRequest).where(RouteRequest.idempotency_key == key))
            assert request is not None
            assert session.scalar(select(func.count()).select_from(Route).where(Route.route_request_id == request.id)) == 3
            assert session.scalar(select(func.count()).select_from(RouteSegment).join(Route).where(Route.route_request_id == request.id)) == 6
    finally:
        with SessionLocal() as session:
            session.execute(text("DELETE FROM route_requests WHERE idempotency_key = :key"), {"key": key})
            session.commit()


def test_persistence_failure_rolls_back_all_route_records(monkeypatch):
    key = f"routing-rollback-{uuid.uuid4()}"
    payload = RouteComparisonRequest.model_validate({"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": key})
    with SessionLocal() as session:
        original_flush, flushes = session.flush, 0
        def fail_after_routes(*args, **kwargs):
            nonlocal flushes
            flushes += 1
            if flushes >= 3:
                raise RuntimeError("SQL database hostname must not escape")
            return original_flush(*args, **kwargs)
        monkeypatch.setattr(session, "flush", fail_after_routes)
        with pytest.raises(RoutingFailure, match="persistence"):
            RouteComparisonService(FixtureRoutingProvider()).create(session, payload)
        monkeypatch.setattr(session, "flush", original_flush)
        assert session.scalar(select(func.count()).select_from(RouteRequest).where(RouteRequest.idempotency_key == key)) == 0


def test_route_timing_data_supports_forward_departure_and_backward_arrival(client):
    key = f"routing-time-{uuid.uuid4()}"
    base = {"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": key}
    try:
        departure = client.post("/v1/routes/compare", json=base).json()
        route, start = departure["routes"][0], datetime.fromisoformat(departure["requested_local_time"])
        assert start + timedelta(seconds=sum(s["travel_seconds"] for s in route["segments"])) == start + timedelta(seconds=route["duration_seconds"])
        arrival_key = f"routing-arrival-{uuid.uuid4()}"
        arrival = client.post("/v1/routes/compare", json=base | {"time_mode": "arrival", "idempotency_key": arrival_key}).json()
        end = datetime.fromisoformat(arrival["requested_local_time"])
        assert end - timedelta(seconds=sum(s["travel_seconds"] for s in arrival["routes"][0]["segments"])) < end
    finally:
        with SessionLocal() as session:
            session.execute(text("DELETE FROM route_requests WHERE idempotency_key = :key OR idempotency_key LIKE 'routing-arrival-%'"), {"key": key})
            session.commit()


def test_request_size_and_error_envelopes_do_not_leak_sensitive_request_data(client):
    oversized = client.post("/v1/routes/compare", content="x" * 1_048_577, headers={"Content-Type": "application/json"})
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    payload = {"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": "private-idempotency-key", "provider_url": "https://secret.example.invalid/path"}
    response = client.post("/v1/routes/compare", json=payload)
    rendered = str(response.json())
    for sensitive in ("72.8373", "19.0269", "private-idempotency-key", "secret.example", "traceback", "sqlalchemy"):
        assert sensitive not in rendered


def test_request_logs_do_not_contain_route_coordinates_or_idempotency_key(client, caplog):
    key = f"private-key-{uuid.uuid4()}"
    payload = {"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": key}
    try:
        assert client.post("/v1/routes/compare", json=payload).status_code == 201
        for sensitive in ("72.8373", "19.0269", key, "POINT", "LINESTRING"):
            assert sensitive not in caplog.text
    finally:
        with SessionLocal() as session:
            session.execute(text("DELETE FROM route_requests WHERE idempotency_key = :key"), {"key": key})
            session.commit()


def test_persistence_and_unexpected_errors_are_safe(client, monkeypatch):
    from app.api.v1 import routing as routing_api

    payload = {"origin": {"longitude": 72.8373, "latitude": 19.0269}, "destination": {"longitude": 72.8433, "latitude": 19.018}, "timezone": "Asia/Kolkata", "requested_local_time": "2026-09-19T18:00:00", "time_mode": "departure", "idempotency_key": f"routing-safe-error-{uuid.uuid4()}"}
    monkeypatch.setattr(routing_api.service, "create", lambda db, body: (_ for _ in ()).throw(RoutingFailure("persistence")))
    persistence = client.post("/v1/routes/compare", json=payload)
    assert persistence.status_code == 500
    assert persistence.json()["error"]["code"] == "ROUTING_PERSISTENCE_FAILED"
    monkeypatch.setattr(routing_api.service, "create", lambda db, body: (_ for _ in ()).throw(RuntimeError("postgresql://secret-host/traceback")))
    unexpected = TestClient(app, headers={"Host": "localhost"}, raise_server_exceptions=False).post("/v1/routes/compare", json=payload)
    assert unexpected.status_code == 500
    assert "secret-host" not in str(unexpected.json())
    assert unexpected.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
