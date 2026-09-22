import { api } from "./client";
import type { Consent, ConsentPurpose } from "./types";

export async function listConsents(): Promise<Consent[]> {
  return api<Consent[]>("/consents", { method: "GET" });
}

export async function createConsent(
  purpose: ConsentPurpose | string,
  granted = true,
  scope: Record<string, unknown> = {},
  policyVersion = "2026-01",
): Promise<Consent> {
  return api<Consent>("/consents", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      purpose,
      granted,
      scope,
      policy_version: policyVersion,
    }),
  });
}

export async function withdrawConsent(consentId: string): Promise<Consent> {
  return api<Consent>(`/consents/${encodeURIComponent(consentId)}/withdraw`, {
    method: "POST",
  });
}
