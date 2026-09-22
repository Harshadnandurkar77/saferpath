import { api, generateIdempotencyKey, getEphemeralSessionId } from "./client";
import type {
  DeviationResponseRequest,
  DeviationResponseResult,
  TripActionRequest,
  TripCreateRequest,
  TripPollResponse,
  TripResponse,
} from "./types";

export async function createTrip(
  params: Omit<TripCreateRequest, "session_id"> & { session_id?: string },
): Promise<TripResponse> {
  const payload: TripCreateRequest = {
    ...params,
    session_id: params.session_id || getEphemeralSessionId(),
  };

  return api<TripResponse>(
    "/trips",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function getTrip(
  tripId: string,
  sessionId?: string,
): Promise<TripPollResponse> {
  const sid = sessionId || getEphemeralSessionId();
  return api<TripPollResponse>(
    `/trips/${encodeURIComponent(tripId)}?session_id=${encodeURIComponent(sid)}`,
    {
      method: "GET",
    },
    false,
  );
}

export async function checkInTrip(
  tripId: string,
  sessionId?: string,
): Promise<TripResponse> {
  const sid = sessionId || getEphemeralSessionId();
  const payload: TripActionRequest = {
    session_id: sid,
    event_id: `evt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    idempotency_key: generateIdempotencyKey("checkin"),
    occurred_at: new Date().toISOString(),
  };

  return api<TripResponse>(
    `/trips/${encodeURIComponent(tripId)}/check-in`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function stopTrip(
  tripId: string,
  sessionId?: string,
): Promise<TripResponse> {
  const sid = sessionId || getEphemeralSessionId();
  const payload: TripActionRequest = {
    session_id: sid,
    event_id: `evt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    idempotency_key: generateIdempotencyKey("stop"),
    occurred_at: new Date().toISOString(),
  };

  return api<TripResponse>(
    `/trips/${encodeURIComponent(tripId)}/stop`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function respondToDeviation(
  tripId: string,
  response: "CONFIRM_ROUTE_CHANGE" | "REJECT_ROUTE_CHANGE" | "UNSURE",
  sessionId?: string,
): Promise<DeviationResponseResult> {
  const sid = sessionId || getEphemeralSessionId();
  const payload: DeviationResponseRequest = {
    session_id: sid,
    idempotency_key: generateIdempotencyKey("dev"),
    response,
    occurred_at: new Date().toISOString(),
  };

  return api<DeviationResponseResult>(
    `/trips/${encodeURIComponent(tripId)}/deviation-response`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}
