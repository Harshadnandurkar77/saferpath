import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text

from app.db.session import SessionLocal
from app.models.trips import (
    NotificationDispatch,
    TrustedContact,
)
from app.modules.trips.schemas import (
    SharingGrantCreateRequest,
)
from app.modules.trips.service import DevelopmentTrustedContactVerificationProvider, TripService


def _terminal_otp(capsys) -> str:
    output = capsys.readouterr().out
    match = re.search(r"\[DEV TRUSTED CONTACT OTP\] (\d{6})", output)
    assert match is not None, f"Expected trusted-contact OTP in terminal output, got: {output}"
    assert "@example.com" not in output
    assert "hash" not in output.lower()
    assert "token" not in output.lower()
    return match.group(1)


def _route(client, owner="trip-owner"):
    key = f"be08-route-{uuid.uuid4()}"
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


def _trip(client, owner="trip-owner", scope="LOCATION"):
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
        session.execute(text("DELETE FROM trusted_contacts WHERE owner_session_id LIKE 'test-%' OR owner_session_id LIKE 'user-%' OR owner_session_id = 'trip-owner'"))


# ===========================================================================
# 1. TRUSTED CONTACT TESTS
# ===========================================================================


def test_trusted_contact_lifecycle(client, capsys):
    owner = "user-alice"
    # Create contact
    payload = {
        "session_id": owner,
        "contact_reference": "bob@example.com",
        "display_name": "Bob Friend",
        "relationship_label": "friend",
    }
    res = client.post("/v1/trusted-contacts", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["verification_status"] == "PENDING"
    assert data["contact_reference"] == "bob@example.com"
    token = _terminal_otp(capsys)
    assert data["verification_token"] is None
    contact_id = data["contact_id"]

    # Listing contacts returns pending contact without token
    listed = client.get(f"/v1/trusted-contacts?session_id={owner}").json()
    assert len(listed) >= 1
    assert any(c["contact_id"] == contact_id for c in listed)
    assert listed[0]["verification_token"] is None

    # Invalid token fails verification
    bad_verify = client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": owner, "verification_token": "wrong-token-12345"},
    )
    assert bad_verify.status_code == 400

    # Unauthorized verify attempt fails
    other_verify = client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": "user-mallory", "verification_token": token},
    )
    assert other_verify.status_code == 403

    # Valid verification succeeds
    good_verify = client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": owner, "verification_token": token},
    )
    assert good_verify.status_code == 200
    assert good_verify.json()["verification_status"] == "VERIFIED"
    assert good_verify.json()["verified_at"] is not None

    # Repeated verify is idempotent
    repeat_verify = client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": owner, "verification_token": token},
    )
    assert repeat_verify.status_code == 200
    assert repeat_verify.json()["verification_status"] == "VERIFIED"

    # Revocation
    rev = client.post(f"/v1/trusted-contacts/{contact_id}/revoke?session_id={owner}")
    assert rev.status_code == 200
    assert rev.json()["verification_status"] == "REVOKED"

    # Revoked contact no longer listed
    active_listed = client.get(f"/v1/trusted-contacts?session_id={owner}").json()
    assert not any(c["contact_id"] == contact_id for c in active_listed)


def test_trusted_contact_otp_is_dynamic_and_expires(client, capsys):
    first = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": "test-otp-owner",
            "contact_reference": "first-otp@example.com",
            "display_name": "First",
            "relationship_label": "friend",
        },
    )
    first_code = _terminal_otp(capsys)
    second = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": "test-otp-owner",
            "contact_reference": "second-otp@example.com",
            "display_name": "Second",
            "relationship_label": "friend",
        },
    )
    second_code = _terminal_otp(capsys)
    assert first_code != second_code
    assert first.json()["verification_token"] is None
    assert second.json()["verification_token"] is None

    with SessionLocal.begin() as db:
        contact = db.scalar(
            select(TrustedContact).where(
                TrustedContact.public_reference == first.json()["contact_id"]
            )
        )
        contact.verification_expires_at = datetime.now(UTC) - timedelta(seconds=1)

    expired = client.post(
        f"/v1/trusted-contacts/{first.json()['contact_id']}/verify",
        json={"session_id": "test-otp-owner", "verification_token": first_code},
    )
    assert expired.status_code == 410


def test_trusted_contact_provider_is_silent_in_production(capsys, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    DevelopmentTrustedContactVerificationProvider().send("hidden@example.com", "123456")
    assert capsys.readouterr().out == ""


# ===========================================================================
# 2. SHARING GRANTS TESTS
# ===========================================================================


def test_sharing_grants_creation_expiry_and_revocation(client, cleanup, capsys):
    owner = "trip-owner"
    trip, route_key = _trip(client, owner=owner, scope="LOCATION")
    cleanup.append(route_key)
    trip_id = trip["trip_id"]

    # Create & verify contact
    c_res = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": owner,
            "contact_reference": "grant-contact@example.com",
            "display_name": "Grant Contact",
            "relationship_label": "family",
        },
    )
    c_res = c_res.json()
    contact_id = c_res["contact_id"]
    token = _terminal_otp(capsys)
    client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": owner, "verification_token": token},
    )

    # Create sharing grant
    g_res = client.post(
        "/v1/sharing-grants",
        json={
            "session_id": owner,
            "trip_id": trip_id,
            "contact_id": contact_id,
            "scope": "STATUS_ONLY",
            "ttl_hours": 12,
        },
    )
    assert g_res.status_code == 201
    g_data = g_res.json()
    assert g_data["status"] == "ACTIVE"
    assert g_data["scope"] == "STATUS_ONLY"
    share_token = g_data["share_token"]
    assert share_token is not None
    grant_id = g_data["grant_id"]

    # Shared trip polling works via share_token
    shared_poll = client.get(f"/v1/shared-trips/{share_token}")
    assert shared_poll.status_code == 200
    assert shared_poll.json()["trip_id"] == trip_id

    # Shared trip SSE stream works via share_token
    shared_stream = client.get(f"/v1/shared-trips/{share_token}/stream")
    assert shared_stream.status_code == 200
    assert ": heartbeat" in shared_stream.text

    # Unauthorized grant creation on another user's trip fails
    unauth = client.post(
        "/v1/sharing-grants",
        json={
            "session_id": "other-user",
            "trip_id": trip_id,
            "contact_id": contact_id,
            "scope": "STATUS_ONLY",
        },
    )
    assert unauth.status_code == 403

    # Revoke grant
    rev = client.post(f"/v1/sharing-grants/{grant_id}/revoke?session_id={owner}")
    assert rev.status_code == 200
    assert rev.json()["status"] == "REVOKED"

    # Revoked token access rejected immediately
    assert client.get(f"/v1/shared-trips/{share_token}").status_code == 409
    assert client.get(f"/v1/shared-trips/{share_token}/stream").status_code == 409


# ===========================================================================
# 3. SMART ACTIVE DEVIATION & CONTEXT RE-EVALUATION
# ===========================================================================


def test_smart_active_deviation_workflow(client, cleanup, capsys):
    """Full workflow: deviation detected -> confirmation required -> user confirms -> alternate route evaluated."""
    owner = "trip-owner"
    trip, route_key = _trip(client, owner=owner, scope="LOCATION")
    cleanup.append(route_key)
    trip_id = trip["trip_id"]

    # Set up verified contact and sharing grant with TRIP_CONTEXT
    c_res = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": owner,
            "contact_reference": "smart-dev@example.com",
            "display_name": "Smart Dev Contact",
            "relationship_label": "partner",
        },
    )
    c_res = c_res.json()
    contact_id = c_res["contact_id"]
    token = _terminal_otp(capsys)
    client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": owner, "verification_token": token},
    )
    grant = client.post(
        "/v1/sharing-grants",
        json={
            "session_id": owner,
            "trip_id": trip_id,
            "contact_id": contact_id,
            "scope": "TRIP_CONTEXT",
        },
    ).json()
    share_token = grant["share_token"]

    # Trigger deviation via outside location
    now = datetime.now(UTC).isoformat()
    outside_payload = {
        "event_id": "dev-loc-001",
        "idempotency_key": "dev-loc-key-001",
        "event_type": "TRIP_UPDATED",
        "occurred_at": now,
        "location": {"longitude": 72.90, "latitude": 19.10},
    }
    dev_res = client.post(f"/v1/trips/{trip_id}/events?session_id={owner}", json=outside_payload)
    assert dev_res.status_code == 200
    assert dev_res.json()["status"] == "DEVIATED"

    # Polling exposes confirmation required
    poll = client.get(f"/v1/trips/{trip_id}?session_id={owner}").json()
    assert poll["deviation"] is not None
    assert poll["deviation"]["status"] == "DEVIATION_PENDING_CONFIRMATION"
    assert poll["deviation"]["confirmation_required"] is True

    # Check notification dispatch was recorded
    with SessionLocal() as session:
        dispatches = list(session.scalars(select(NotificationDispatch)).all())
        assert len(dispatches) >= 1
        assert dispatches[0].event_type == "DEVIATION_PENDING_CONFIRMATION"
        assert "Traveler verification is pending" in dispatches[0].payload["message"]

    # User confirms route change: "I CHOSE THIS ROUTE"
    resp_payload = {
        "session_id": owner,
        "idempotency_key": "user-resp-001",
        "response": "CONFIRM_ROUTE_CHANGE",
        "occurred_at": datetime.now(UTC).isoformat(),
        "alternate_location": {"longitude": 72.8400, "latitude": 19.0220},
    }
    confirm_res = client.post(f"/v1/trips/{trip_id}/deviation-response", json=resp_payload)
    assert confirm_res.status_code == 200
    c_data = confirm_res.json()
    assert c_data["status"] == "ALTERNATE_PATH_EVALUATED"
    assert c_data["alternate_route_id"] is not None
    assert c_data["context_band"] in {
        "STRONG_CONTEXTUAL_SUPPORT",
        "GOOD_CONTEXT",
        "MIXED_CONTEXT",
        "CAUTION_SEGMENT",
        "LIMITED_DATA",
        "UNKNOWN",
    }
    assert c_data["confidence"] in {"HIGH", "MEDIUM", "LOW", "UNKNOWN"}
    assert c_data["explanation"] is not None

    # Confirm idempotent re-submission
    repeat_res = client.post(f"/v1/trips/{trip_id}/deviation-response", json=resp_payload)
    assert repeat_res.status_code == 200
    assert repeat_res.json()["status"] == "ALTERNATE_PATH_EVALUATED"

    # Contact with TRIP_CONTEXT receives updated contextual events in stream
    c_stream = client.get(f"/v1/shared-trips/{share_token}/stream")
    assert c_stream.status_code == 200
    assert "ALTERNATE_ROUTE_CONTEXT_UPDATED" in c_stream.text


def test_deviation_user_rejection_and_uncertainty(client, cleanup):
    """Test 'NO, THIS WAS NOT INTENTIONAL' and 'I'M NOT SURE' options."""
    owner = "trip-owner"
    trip, route_key = _trip(client, owner=owner, scope="LOCATION")
    cleanup.append(route_key)
    trip_id = trip["trip_id"]

    # Trigger deviation
    client.post(
        f"/v1/trips/{trip_id}/events?session_id={owner}",
        json={
            "event_id": "dev-rej-001",
            "idempotency_key": "dev-rej-key-001",
            "event_type": "TRIP_UPDATED",
            "occurred_at": datetime.now(UTC).isoformat(),
            "location": {"longitude": 72.90, "latitude": 19.10},
        },
    )

    # User uncertain
    unsure_res = client.post(
        f"/v1/trips/{trip_id}/deviation-response",
        json={
            "session_id": owner,
            "idempotency_key": "unsure-resp-001",
            "response": "UNSURE",
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert unsure_res.status_code == 200
    assert unsure_res.json()["status"] == "USER_UNCERTAIN"

    # User later rejects
    reject_res = client.post(
        f"/v1/trips/{trip_id}/deviation-response",
        json={
            "session_id": owner,
            "idempotency_key": "reject-resp-001",
            "response": "REJECT_ROUTE_CHANGE",
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "USER_REJECTED_CHANGE"


# ===========================================================================
# 4. SECURITY & PRIVACY TESTS
# ===========================================================================


def test_cross_user_isolation(client, cleanup, capsys):
    """User A cannot access or manipulate User B's contacts, grants, trips, or deviations."""
    user_a = "user-alice"
    user_b = "user-bob"

    trip_a, route_key = _trip(client, owner=user_a)
    cleanup.append(route_key)

    # User A creates a contact
    c_a = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": user_a,
            "contact_reference": "alice-friend@example.com",
            "display_name": "Alice Friend",
            "relationship_label": "friend",
        },
    ).json()
    token_a = _terminal_otp(capsys)

    # User B cannot see User A's contact in their list
    b_contacts = client.get(f"/v1/trusted-contacts?session_id={user_b}").json()
    assert not any(c["contact_id"] == c_a["contact_id"] for c in b_contacts)

    # User B cannot verify User A's contact
    assert (
        client.post(
            f"/v1/trusted-contacts/{c_a['contact_id']}/verify",
            json={"session_id": user_b, "verification_token": token_a},
        ).status_code
        == 403
    )

    # User B cannot create grants on User A's trip
    assert (
        client.post(
            "/v1/sharing-grants",
            json={
                "session_id": user_b,
                "trip_id": trip_a["trip_id"],
                "contact_id": c_a["contact_id"],
                "scope": "STATUS_ONLY",
            },
        ).status_code
        == 403
    )

    # User B cannot respond to User A's deviation
    assert (
        client.post(
            f"/v1/trips/{trip_a['trip_id']}/deviation-response",
            json={
                "session_id": user_b,
                "idempotency_key": "unauth-dev-resp",
                "response": "CONFIRM_ROUTE_CHANGE",
                "occurred_at": datetime.now(UTC).isoformat(),
            },
        ).status_code
        == 403
    )


# ===========================================================================
# 5. CONCURRENCY TESTS (REAL POSTGRESQL)
# ===========================================================================


def test_concurrent_grant_creation_creates_single_active_grant(client, cleanup, capsys):
    run_id = uuid.uuid4().hex[:8]
    owner = f"concurrent-owner-{run_id}"
    trip, route_key = _trip(client, owner=owner)
    cleanup.append(route_key)

    c_res = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": owner,
            "contact_reference": f"concurrent-contact-{run_id}@example.com",
            "display_name": "Concurrent Contact",
            "relationship_label": "friend",
        },
    )
    c_res = c_res.json()
    contact_id = c_res["contact_id"]
    token = _terminal_otp(capsys)
    verify_resp = client.post(
        f"/v1/trusted-contacts/{contact_id}/verify",
        json={"session_id": owner, "verification_token": token},
    )
    assert verify_resp.status_code == 200, f"verify failed: {verify_resp.json()}"

    payload = SharingGrantCreateRequest(
        session_id=owner,
        trip_id=trip["trip_id"],
        contact_id=contact_id,
        scope="STATUS_ONLY",
    )

    def submit():
        with SessionLocal.begin() as session:
            return TripService().create_grant(session, payload).grant_id

    with ThreadPoolExecutor(max_workers=2) as executor:
        ids = list(executor.map(lambda _: submit(), range(2)))
    assert ids[0] == ids[1]


def test_demo_smart_deviation_and_get_route(client, cleanup, capsys):
    owner = f"demo-owner-{uuid.uuid4().hex[:8]}"
    trip, route_key = _trip(client, owner=owner)
    cleanup.append(route_key)
    trip_id = trip["trip_id"]

    # 1. Trigger demo deviation via POST /v1/trips/{trip_id}/demo-deviation
    demo_res = client.post(f"/v1/trips/{trip_id}/demo-deviation?session_id={owner}")
    assert demo_res.status_code == 200
    demo_data = demo_res.json()
    assert demo_data["status"] == "DEVIATED"
    assert demo_data["deviation"] is not None
    assert demo_data["deviation"]["status"] == "DEVIATION_PENDING_CONFIRMATION"
    assert demo_data["deviation"]["confirmation_required"] is True

    # 2. Confirm route change (YES path)
    confirm_res = client.post(
        f"/v1/trips/{trip_id}/deviation-response",
        json={
            "session_id": owner,
            "idempotency_key": f"idemp-{uuid.uuid4().hex}",
            "response": "CONFIRM_ROUTE_CHANGE",
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] == "ALTERNATE_PATH_EVALUATED"
    alt_route_id = confirm_data["alternate_route_id"]
    assert alt_route_id is not None

    # 3. Fetch alternate route via GET /v1/routes/{route_id}
    route_res = client.get(f"/v1/routes/{alt_route_id}")
    assert route_res.status_code == 200
    route_data = route_res.json()
    assert route_data["id"] == alt_route_id
    assert len(route_data["geometry"]) >= 2
    assert len(route_data["segments"]) >= 1

    # 4. Test REJECT path (NO path) on a fresh trip
    trip2, route_key2 = _trip(client, owner=owner)
    cleanup.append(route_key2)
    trip2_id = trip2["trip_id"]

    c_res = client.post(
        "/v1/trusted-contacts",
        json={
            "session_id": owner,
            "contact_reference": "+919876543210",
            "display_name": "Mom",
            "relationship_label": "family",
        },
    )
    c_res = c_res.json()
    token = _terminal_otp(capsys)
    client.post(
        f"/v1/trusted-contacts/{c_res['contact_id']}/verify",
        json={"session_id": owner, "verification_token": token},
    )

    client.post(f"/v1/trips/{trip2_id}/demo-deviation?session_id={owner}")
    reject_res = client.post(
        f"/v1/trips/{trip2_id}/deviation-response",
        json={
            "session_id": owner,
            "idempotency_key": f"idemp-reject-{uuid.uuid4().hex}",
            "response": "REJECT_ROUTE_CHANGE",
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "USER_REJECTED_CHANGE"


