export interface Account {
  public_id: string;
  display_name: string | null;
  verified_identifier: boolean;
  account_status: string;
  onboarding_complete: boolean;
  route_planning_available: boolean;
}

export type TravellerType = "STUDENT" | "EMPLOYEE" | "DAILY_USE" | "SKIP";

export interface Profile {
  display_name: string | null;
  traveller_type: TravellerType | null;
  language: string | null;
  accessibility_preferences: Record<string, unknown>;
  profile_data: Record<string, unknown>;
}

export interface ProfileUpdatePayload {
  display_name?: string | null;
  traveller_type?: TravellerType | null;
  language?: string | null;
  accessibility_preferences?: Record<string, unknown> | null;
  profile_data?: Record<string, unknown> | null;
  clear_fields?: (
    | "display_name"
    | "traveller_type"
    | "language"
    | "accessibility_preferences"
    | "profile_data"
  )[];
}

export interface OnboardingStatus {
  authenticated: boolean;
  profile_complete: boolean;
  required_actions_remaining: string[];
  optional_actions_available: string[];
  route_planning_available: boolean;
}

export type ConsentPurpose =
  | "ROUTE_PLANNING_LOCATION"
  | "ACTIVE_TRIP_LOCATION"
  | "TRUSTED_CONTACT_SHARING"
  | "PUBLIC_REPORT_PUBLICATION"
  | "PRIVATE_EVIDENCE_RETENTION"
  | "NOTIFICATIONS"
  | "EMERGENCY_HANDOFF"
  | "PROVIDER_INTEGRATION"
  | "ANALYTICS"
  | "PERSONALISATION";

export interface Consent {
  id: string;
  purpose: ConsentPurpose | string;
  scope: Record<string, unknown>;
  policy_version: string;
  granted: boolean;
  granted_at: string | null;
  withdrawn_at: string | null;
  effective: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Routing Domain Types
// ---------------------------------------------------------------------------

export interface Point {
  longitude: number;
  latitude: number;
}

export interface RouteComparisonRequest {
  origin: Point;
  destination: Point;
  timezone: string;
  requested_local_time: string; // ISO string without timezone offset e.g. "2026-09-21T18:00:00"
  time_mode: "departure" | "arrival";
  travel_mode: "walking";
  route_preference: "fastest" | "contextual" | "balanced" | "accessible";
  idempotency_key: string;
  session_id?: string;
}

export interface SegmentResponse {
  id: string;
  sequence: number;
  geometry: [number, number][]; // [[lon, lat], ...]
  length_meters: number;
  travel_seconds: number;
}

export interface RouteResponse {
  id: string;
  sequence: number;
  provider: string;
  provider_metadata: Record<string, string>;
  duration_seconds: number;
  distance_meters: number;
  geometry: [number, number][]; // [[lon, lat], ...]
  segments: SegmentResponse[];
}

export interface RouteComparisonResponse {
  request_id: string;
  status: string;
  reused: boolean;
  expires_at: string;
  timezone: string;
  requested_local_time: string;
  time_mode: string;
  travel_mode: string;
  route_preference: string;
  provider_source: string;
  routes: RouteResponse[];
}

// ---------------------------------------------------------------------------
// Context Engine Types
// ---------------------------------------------------------------------------

export type ContextBand =
  | "STRONG_CONTEXTUAL_SUPPORT"
  | "GOOD_CONTEXT"
  | "MIXED_CONTEXT"
  | "CAUTION_SEGMENT"
  | "LIMITED_DATA"
  | "UNKNOWN";

export interface SegmentContext {
  segment_id: string;
  sequence: number;
  expected_local_time: string;
  context_band: ContextBand | string;
  confidence: string;
  coverage: string;
  source_classes: string[];
  strongest_support: string[];
  caution: string[];
  unknown: string[];
  stale_groups: string[];
  freshness: Record<string, string>;
}

export interface RouteContextResponse {
  route_id: string;
  context_version: string;
  model_version: string;
  feature_version: string;
  rule_version: string;
  requested_local_time: string;
  timezone: string;
  time_mode: string;
  route_context_band: ContextBand | string;
  route_confidence: string;
  route_coverage: string;
  freshness_summary: Record<string, string>;
  affected_segments: string[];
  explanation: Record<string, unknown>;
  segments: SegmentContext[];
}

// ---------------------------------------------------------------------------
// Reports Domain Types
// ---------------------------------------------------------------------------

export type ReportCategory =
  | "LIGHTING"
  | "ACCESSIBILITY"
  | "PEDESTRIAN_INFRASTRUCTURE"
  | "ACTIVITY_CONTEXT"
  | "TRANSIT_CONTEXT"
  | "SOMETHING_ELSE";

export interface RoutinePreference {
  id: string;
  title: string;
  time: string;
  origin: string;
  destination: string;
  days: string[];
}

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: "home" | "work" | "college" | "transit" | "other";
}

export type PublicationIntent = "PUBLIC_CONTEXT" | "RESTRICTED_EVIDENCE";

export type ModerationStatus =
  | "PENDING"
  | "ACCEPTED_PUBLIC_CONTEXT"
  | "ACCEPTED_RESTRICTED_EVIDENCE"
  | "MERGED"
  | "REJECTED"
  | "CORRECTED"
  | "EXPIRED"
  | "ESCALATED";

export type CoarseArea =
  | "MUMBAI_SOUTH"
  | "MUMBAI_CENTRAL"
  | "MUMBAI_NORTH"
  | "MUMBAI_EAST"
  | "MUMBAI_WEST";

export interface ReportCreateRequest {
  session_id: string;
  idempotency_key: string;
  category: ReportCategory;
  observed_at: string; // ISO string with timezone offset e.g. "2026-09-21T18:00:00+05:30"
  route_segment_id?: string | null;
  coarse_area?: CoarseArea | null;
  publication_intent: PublicationIntent;
}

export interface ReportResponse {
  report_id: string;
  reference: string;
  category: ReportCategory;
  observed_at: string;
  submitted_at: string;
  publication_intent: PublicationIntent;
  moderation_status: ModerationStatus;
  expires_at: string;
  coarse_area: string | null;
  reused: boolean;
}

export interface EvidenceItem {
  evidence_id: string;
  reference: string;
  content_type: string;
  size_bytes: number;
  state: string;
  retention_until: string;
}

// ---------------------------------------------------------------------------
// Help Points Domain Types
// ---------------------------------------------------------------------------

export interface NearbyHelpPointsParams {
  latitude: number;
  longitude: number;
  radius_meters: number;
  category?: string;
  accessibility?: string;
  verified_only?: boolean;
}

export interface HelpPointResponse {
  reference: string;
  category: string;
  contact: string | null;
  accessibility: string | null;
  verification_status:
    | "VERIFIED"
    | "UNVERIFIED"
    | "STALE"
    | "EXPIRED"
    | "SUSPENDED"
    | string;
  operating_status: "OPEN" | "CLOSED" | "UNKNOWN" | string;
  sponsor_disclosure: string | null;
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Active Trips Domain Types
// ---------------------------------------------------------------------------

export interface TripCreateRequest {
  route_id: string;
  session_id: string;
  planned_arrival: string; // ISO with tz e.g. "2026-09-21T19:00:00+05:30"
  planned_departure?: string | null; // ISO with tz
  travel_mode: "walking";
  active_trip_consent: boolean;
  consent_reference: string;
  consent_version: string;
  sharing_scope: "STATUS_ONLY" | "LOCATION";
}

export interface TripResponse {
  trip_id: string;
  status: string;
  selected_route_id: string;
  planned_arrival: string;
  travel_mode: string;
  sharing_scope: string;
  consent_version: string;
  last_update_at: string;
  retention_until: string;
}

export interface DeviationSummary {
  deviation_id: string;
  status: string;
  detected_at: string;
  confirmation_required: boolean;
  user_response: string | null;
  alternate_route_id: string | null;
  context_band: string | null;
  confidence: string | null;
  explanation: Record<string, unknown> | null;
}

export interface TripPollResponse extends TripResponse {
  latest_event_id: string | null;
  stale: boolean;
  deviation: DeviationSummary | null;
  emergency_handoff: Record<string, unknown> | null;
}

export interface TripActionRequest {
  session_id: string;
  event_id: string;
  idempotency_key: string;
  occurred_at: string; // ISO with tz
}

export interface DeviationResponseRequest {
  session_id: string;
  idempotency_key: string;
  response: "CONFIRM_ROUTE_CHANGE" | "REJECT_ROUTE_CHANGE" | "UNSURE";
  occurred_at: string;
  alternate_location?: Point | null;
}

export interface DeviationResponseResult {
  trip_id: string;
  deviation_id: string;
  status: string;
  user_response: string;
  alternate_route_id: string | null;
  context_band: string | null;
  confidence: string | null;
  explanation: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Trusted Contacts & Sharing Grants Types
// ---------------------------------------------------------------------------

export interface TrustedContactCreateRequest {
  session_id: string;
  contact_reference: string;
  display_name: string;
  relationship_label: string;
}

export interface TrustedContactResponse {
  contact_id: string;
  contact_reference: string;
  display_name: string;
  relationship_label: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  verification_token?: string | null;
}

export interface TrustedContactVerifyRequest {
  session_id: string;
  verification_token: string;
}

export interface SharingGrantCreateRequest {
  session_id: string;
  trip_id: string;
  contact_id: string;
  scope: "STATUS_ONLY" | "LOCATION" | "TRIP_CONTEXT";
  ttl_hours?: number | null;
}

export interface SharingGrantResponse {
  grant_id: string;
  trip_id: string;
  contact_id: string;
  scope: string;
  status: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  share_token?: string | null;
}

// ---------------------------------------------------------------------------
// Emergency Handoff Types
// ---------------------------------------------------------------------------

export interface EmergencyHandoffCreateRequest {
  session_id: string;
  trip_id: string;
  method: "OFFICIAL_CALL" | "OFFICIAL_DEEP_LINK" | "APPROVED_INTEGRATION";
  idempotency_key: string;
  explicit_user_action: boolean;
  consent_version: string;
  consent_source: string;
}

export interface EmergencyHandoffSummary {
  handoff_id: string;
  method: string;
  status: string;
  requested_at: string;
  next_action: string;
  provider_reference: string | null;
}

export interface EmergencyHandoffActionRequest {
  session_id: string;
  idempotency_key: string;
  action: "CALL_INITIATED" | "CALL_OPENED" | "CANCEL";
}
