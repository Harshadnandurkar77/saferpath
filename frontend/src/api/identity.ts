import { api, session } from "./client";
import type {
  Account,
  Consent,
  ConsentPurpose,
  OnboardingStatus,
  Profile,
  ProfileUpdatePayload,
} from "./types";

export async function requestCode(
  email: string,
): Promise<{ accepted: boolean }> {
  return api<{ accepted: boolean }>(
    "/auth/codes",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    false,
  );
}

export async function verifyCode(
  email: string,
  code: string,
): Promise<{
  session_token: string;
  account: Account;
  onboarding_required: boolean;
}> {
  const result = await api<{
    session_token: string;
    account: Account;
    onboarding_required: boolean;
  }>(
    "/auth/verify",
    {
      method: "POST",
      body: JSON.stringify({ email, code }),
    },
    false,
  );
  session.set(result.session_token);
  return result;
}

export async function currentAccount(): Promise<Account> {
  return api<Account>("/auth/me");
}

export async function revoke(): Promise<void> {
  return api<void>("/auth/revoke", { method: "POST" });
}

export async function onboardingStatus(): Promise<OnboardingStatus> {
  return api<OnboardingStatus>("/onboarding/status");
}

export async function profile(): Promise<Profile> {
  return api<Profile>("/profile");
}

export async function updateProfile(
  value: ProfileUpdatePayload,
): Promise<Profile> {
  return api<Profile>("/profile", {
    method: "PATCH",
    body: JSON.stringify(value),
  });
}

export async function consents(): Promise<Consent[]> {
  return api<Consent[]>("/consents");
}

export async function createConsent(
  purpose: ConsentPurpose | string,
  granted = true,
): Promise<Consent> {
  return api<Consent>("/consents", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      purpose,
      granted,
      scope: {},
      policy_version: "2026-01",
    }),
  });
}

export async function withdrawConsent(id: string): Promise<Consent> {
  return api<Consent>(`/consents/${encodeURIComponent(id)}/withdraw`, {
    method: "POST",
  });
}
