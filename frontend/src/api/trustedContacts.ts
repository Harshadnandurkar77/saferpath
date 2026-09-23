import { api, getEphemeralSessionId } from "./client";
import type {
  SharingGrantCreateRequest,
  SharingGrantResponse,
  TrustedContactCreateRequest,
  TrustedContactResponse,
  TrustedContactVerifyRequest,
} from "./types";

export async function createTrustedContact(
  params: Omit<TrustedContactCreateRequest, "session_id"> & {
    session_id?: string;
  },
): Promise<TrustedContactResponse> {
  const sid = params.session_id || getEphemeralSessionId();
  const payload: TrustedContactCreateRequest = {
    ...params,
    session_id: sid,
  };

  return api<TrustedContactResponse>(
    "/trusted-contacts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function listTrustedContacts(
  sessionId?: string,
): Promise<TrustedContactResponse[]> {
  const sid = sessionId || getEphemeralSessionId();
  return api<TrustedContactResponse[]>(
    `/trusted-contacts?session_id=${encodeURIComponent(sid)}`,
    {
      method: "GET",
    },
    false,
  );
}

export async function verifyTrustedContact(
  contactId: string,
  verificationToken: string,
  sessionId?: string,
): Promise<TrustedContactResponse> {
  const sid = sessionId || getEphemeralSessionId();
  const payload: TrustedContactVerifyRequest = {
    session_id: sid,
    verification_token: verificationToken,
  };

  return api<TrustedContactResponse>(
    `/trusted-contacts/${encodeURIComponent(contactId)}/verify`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function generateTrustedContactVerificationCode(
  contactId: string,
  sessionId?: string,
): Promise<TrustedContactResponse> {
  const sid = sessionId || getEphemeralSessionId();
  return api<TrustedContactResponse>(
    `/trusted-contacts/${encodeURIComponent(contactId)}/verification-code`,
    {
      method: "POST",
      body: JSON.stringify({ session_id: sid }),
    },
    false,
  );
}

export async function revokeTrustedContact(
  contactId: string,
  sessionId?: string,
): Promise<TrustedContactResponse> {
  const sid = sessionId || getEphemeralSessionId();
  return api<TrustedContactResponse>(
    `/trusted-contacts/${encodeURIComponent(contactId)}/revoke?session_id=${encodeURIComponent(sid)}`,
    {
      method: "POST",
    },
    false,
  );
}

export async function createSharingGrant(
  params: Omit<SharingGrantCreateRequest, "session_id"> & {
    session_id?: string;
  },
): Promise<SharingGrantResponse> {
  const sid = params.session_id || getEphemeralSessionId();
  const payload: SharingGrantCreateRequest = {
    ...params,
    session_id: sid,
  };

  return api<SharingGrantResponse>(
    "/sharing-grants",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function revokeSharingGrant(
  grantId: string,
  sessionId?: string,
): Promise<SharingGrantResponse> {
  const sid = sessionId || getEphemeralSessionId();
  return api<SharingGrantResponse>(
    `/sharing-grants/${encodeURIComponent(grantId)}/revoke?session_id=${encodeURIComponent(sid)}`,
    {
      method: "POST",
    },
    false,
  );
}
