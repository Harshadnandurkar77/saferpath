import { api, generateIdempotencyKey, getEphemeralSessionId } from "./client";
import type {
  EvidenceItem,
  ReportCategory,
  ReportCreateRequest,
  ReportResponse,
} from "./types";

export async function createReport(
  params: Omit<ReportCreateRequest, "session_id" | "idempotency_key"> & {
    session_id?: string;
    idempotency_key?: string;
  },
): Promise<ReportResponse> {
  const payload: ReportCreateRequest = {
    ...params,
    session_id: params.session_id || getEphemeralSessionId(),
    idempotency_key: params.idempotency_key || generateIdempotencyKey("rep"),
  };

  return api<ReportResponse>(
    "/reports",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false,
  );
}

export async function getReport(
  reportId: string,
  sessionId?: string,
): Promise<ReportResponse> {
  const sid = sessionId || getEphemeralSessionId();
  const query = sid ? `?session_id=${encodeURIComponent(sid)}` : "";
  return api<ReportResponse>(
    `/reports/${encodeURIComponent(reportId)}${query}`,
    {
      method: "GET",
    },
    false,
  );
}

export async function listReports(sessionId?: string): Promise<ReportResponse[]> {
  const sid = sessionId || getEphemeralSessionId();
  return api<ReportResponse[]>(
    `/reports?session_id=${encodeURIComponent(sid)}`,
    {
      method: "GET",
    },
    false,
  );
}

export async function listReportEvidence(
  reportId: string,
  sessionId?: string,
): Promise<EvidenceItem[]> {
  const sid = sessionId || getEphemeralSessionId();
  return api<EvidenceItem[]>(
    `/reports/${encodeURIComponent(reportId)}/evidence?session_id=${encodeURIComponent(sid)}`,
    {
      method: "GET",
    },
    false,
  );
}

export async function authorizeEvidenceUpload(
  reportId: string,
  contentType: string,
  sizeBytes: number,
  sessionId?: string,
): Promise<{
  evidence_id: string;
  reference: string;
  upload_token: string;
  expires_at: string;
}> {
  const sid = sessionId || getEphemeralSessionId();
  return api<{
    evidence_id: string;
    reference: string;
    upload_token: string;
    expires_at: string;
  }>(
    `/reports/${encodeURIComponent(reportId)}/evidence/upload-authorizations`,
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sid,
        idempotency_key: generateIdempotencyKey("ev-auth"),
        content_type: contentType,
        size_bytes: sizeBytes,
      }),
    },
    false,
  );
}

export async function completeEvidenceUpload(
  reportId: string,
  evidenceId: string,
  uploadToken: string,
  contentBase64: string,
  sessionId?: string,
): Promise<{ evidence_id: string; reference: string; state: string }> {
  const sid = sessionId || getEphemeralSessionId();
  return api<{ evidence_id: string; reference: string; state: string }>(
    `/reports/${encodeURIComponent(reportId)}/evidence/${encodeURIComponent(evidenceId)}/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sid,
        upload_token: uploadToken,
        content_base64: contentBase64,
      }),
    },
    false,
  );
}

export async function deleteReportEvidence(
  reportId: string,
  evidenceId: string,
  sessionId?: string,
): Promise<void> {
  const sid = sessionId || getEphemeralSessionId();
  return api<void>(
    `/reports/${encodeURIComponent(reportId)}/evidence/${encodeURIComponent(evidenceId)}?session_id=${encodeURIComponent(sid)}`,
    {
      method: "DELETE",
    },
    false,
  );
}

export const REPORT_CATEGORIES: {
  id: ReportCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "LIGHTING",
    label: "Poor lighting",
    description: "Streetlights broken, dim, or missing",
  },
  {
    id: "ACCESSIBILITY",
    label: "Accessibility issue",
    description: "Blocked ramps, broken curbs, or inaccessible walkways",
  },
  {
    id: "PEDESTRIAN_INFRASTRUCTURE",
    label: "Pedestrian infrastructure",
    description: "Damaged sidewalks, open potholes, or missing footpaths",
  },
  {
    id: "ACTIVITY_CONTEXT",
    label: "Activity context",
    description:
      "Deserted stretch, low street presence, or closed commercial frontage",
  },
  {
    id: "TRANSIT_CONTEXT",
    label: "Transit context",
    description: "Bus stop or station platform condition",
  },
  {
    id: "SOMETHING_ELSE",
    label: "Something else",
    description: "Observation not covered by predefined categories",
  },
];
