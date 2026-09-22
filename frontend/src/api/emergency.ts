import { api, generateIdempotencyKey, getEphemeralSessionId } from "./client";
import type {
  EmergencyHandoffActionRequest,
  EmergencyHandoffCreateRequest,
  EmergencyHandoffSummary,
} from "./types";

export async function createEmergencyHandoff(
  params: Omit<
    EmergencyHandoffCreateRequest,
    "session_id" | "idempotency_key"
  > & {
    session_id?: string;
    idempotency_key?: string;
  },
): Promise<EmergencyHandoffSummary> {
  const sid = params.session_id || getEphemeralSessionId();
  const payload: EmergencyHandoffCreateRequest = {
    ...params,
    session_id: sid,
    idempotency_key:
      params.idempotency_key || generateIdempotencyKey("em-hand"),
  };

  return api<EmergencyHandoffSummary>(
    "/emergency/handoff",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function submitEmergencyHandoffAction(
  handoffId: string,
  action: "CALL_INITIATED" | "CALL_OPENED" | "CANCEL",
  sessionId?: string,
): Promise<EmergencyHandoffSummary> {
  const sid = sessionId || getEphemeralSessionId();
  const payload: EmergencyHandoffActionRequest = {
    session_id: sid,
    idempotency_key: generateIdempotencyKey("em-act"),
    action,
  };

  return api<EmergencyHandoffSummary>(
    `/emergency/handoff/${encodeURIComponent(handoffId)}/action`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}
