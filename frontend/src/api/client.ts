import { ApiError } from "./types";
export const apiBaseUrl = (import.meta.env.VITE_API_URL || "/v1").replace(
  /\/$/,
  "",
);
let token: string | null = sessionStorage.getItem("saferpath_session");
export const session = {
  get: () => token,
  set: (value: string) => {
    token = value;
    sessionStorage.setItem("saferpath_session", value);
  },
  clear: () => {
    token = null;
    sessionStorage.removeItem("saferpath_session");
  },
};
export function getEphemeralSessionId() {
  let id = sessionStorage.getItem("saferpath_ephemeral_session_id");
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    sessionStorage.setItem("saferpath_ephemeral_session_id", id);
  }
  return id;
}
export function generateIdempotencyKey(prefix = "idem") {
  return `${prefix}-${crypto.randomUUID()}`;
}
export async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        ...((init.headers as Record<string, string>) || {}),
      },
    });
    if (!response.ok) {
      let message: string | undefined;
      let code: string | undefined;
      try {
        const body = await response.json();
        message = body?.error?.message || body?.detail || body?.message;
        code = body?.error?.code;
        if (Array.isArray(message)) message = message[0]?.msg;
      } catch {
        /* status fallback */
      }
      const fallback =
        response.status === 401
          ? "Your session has expired. Please sign in again."
          : response.status === 403
            ? "You do not have permission to perform this action."
            : response.status === 404
              ? "The requested item was not found."
              : response.status === 409
                ? "There was a conflict with the current state."
                : response.status === 422
                  ? "The requested input is invalid or outside the pilot area."
                  : response.status === 429
                    ? "Please wait before trying again."
                    : response.status >= 500
                      ? "The service is temporarily unavailable."
                      : "We could not complete that request.";
      throw new ApiError(response.status, message || fallback, code);
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new ApiError(408, "The request timed out. Please try again.");
    throw new ApiError(0, "Network unavailable. Please check your connection.");
  } finally {
    window.clearTimeout(timer);
  }
}
