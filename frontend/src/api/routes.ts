import { api, generateIdempotencyKey, getEphemeralSessionId } from "./client";
import type { RouteComparisonRequest, RouteComparisonResponse } from "./types";

export async function compareRoutes(
  params: Omit<RouteComparisonRequest, "idempotency_key" | "session_id"> & {
    idempotency_key?: string;
    session_id?: string;
  },
): Promise<RouteComparisonResponse> {
  const payload: RouteComparisonRequest = {
    ...params,
    idempotency_key: params.idempotency_key || generateIdempotencyKey("route"),
    session_id: params.session_id || getEphemeralSessionId(),
  };

  return api<RouteComparisonResponse>(
    "/routes/compare",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false, // Works unauthenticated or authenticated
  );
}
