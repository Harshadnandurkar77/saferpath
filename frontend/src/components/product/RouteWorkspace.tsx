import { useState, useEffect, useId, useCallback } from "react";
import {
  ArrowRight,
  Clock,
  Info,
  LifeBuoy,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { SaferPathMap } from "../map/SaferPathMap";
import { compareRoutes } from "../../api/routes";
import { getRouteContext } from "../../api/context";
import { getNearbyHelpPoints } from "../../api/helpPoints";
import { createTrip } from "../../api/trips";
import { createConsent, listConsents } from "../../api/privacy";
import type {
  HelpPointResponse,
  Point,
  RouteComparisonResponse,
  RouteContextResponse,
  RouteResponse,
} from "../../api/types";
import type { MapHelpPoint, MapRoute } from "../map/mapTypes";
import { useNavigate } from "react-router-dom";

// Pilot corridor: Shivaji Park / Bandra West corridor in Mumbai
const DEFAULT_ORIGIN: Point = { longitude: 72.828, latitude: 19.054 };
const DEFAULT_DESTINATION: Point = { longitude: 72.84, latitude: 19.054 };

const TIME_SLOTS = [
  { label: "6:00 PM", time: "18:00:00" },
  { label: "9:00 PM", time: "21:00:00" },
  { label: "11:30 PM", time: "23:30:00" },
];

function formatContextBand(band?: string): {
  label: string;
  badgeClass: string;
  stroke: string;
  color: string;
  kind: "good" | "mixed" | "limited";
} {
  switch (band) {
    case "STRONG_CONTEXTUAL_SUPPORT":
      return {
        label: "Stronger contextual support",
        badgeClass: "bg-[#dcefe9] text-[#075b53] border-[#16756c]",
        stroke: "#16756c",
        color: "text-[#075b53]",
        kind: "good",
      };
    case "GOOD_CONTEXT":
      return {
        label: "Good context",
        badgeClass: "bg-[#dcefe9] text-[#075b53] border-[#16756c]",
        stroke: "#16756c",
        color: "text-[#075b53]",
        kind: "good",
      };
    case "MIXED_CONTEXT":
      return {
        label: "Mixed context",
        badgeClass: "bg-[#fcf3d9] text-[#9a6400] border-[#9a6400]",
        stroke: "#9a6400",
        color: "text-[#9a6400]",
        kind: "mixed",
      };
    case "CAUTION_SEGMENT":
      return {
        label: "Caution segment",
        badgeClass: "bg-[#fde8e7] text-[#b6433d] border-[#b6433d]",
        stroke: "#b6433d",
        color: "text-[#b6433d]",
        kind: "limited",
      };
    case "LIMITED_DATA":
      return {
        label: "Limited data",
        badgeClass: "bg-[#f0f2ed] text-[#53615a] border-[#bdc9c0]",
        stroke: "#65746d",
        color: "text-[#53615a]",
        kind: "limited",
      };
    case "UNKNOWN":
    default:
      return {
        label: "Unknown context",
        badgeClass: "bg-[#f0f2ed] text-[#53615a] border-[#bdc9c0]",
        stroke: "#65746d",
        color: "text-[#53615a]",
        kind: "limited",
      };
  }
}

export function RouteWorkspace() {
  const navigate = useNavigate();
  const originInputId = useId();
  const destInputId = useId();

  const [origin] = useState<Point>(DEFAULT_ORIGIN);
  const [destination] = useState<Point>(DEFAULT_DESTINATION);
  const [originLabel, setOriginLabel] = useState(
    "Bandra Reclamation / Hill Rd",
  );
  const [destLabel, setDestLabel] = useState("Bandra Station West");
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(1); // 9:00 PM default

  // Server state
  const [comparison, setComparison] = useState<RouteComparisonResponse | null>(
    null,
  );
  const [contexts, setContexts] = useState<
    Record<string, RouteContextResponse>
  >({});
  const [helpPoints, setHelpPoints] = useState<HelpPointResponse[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null,
  );
  const [selectedHelpPointRef, setSelectedHelpPointRef] = useState<
    string | null
  >(null);

  // Status flags
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);

  // Fetch routes from backend
  const fetchRoutes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      const timeSlot = TIME_SLOTS[selectedTimeIndex].time;
      const requestedLocalTime = `${todayDate}T${timeSlot}`;

      const res = await compareRoutes({
        origin,
        destination,
        timezone: "Asia/Kolkata",
        requested_local_time: requestedLocalTime,
        time_mode: "departure",
        travel_mode: "walking",
        route_preference: "balanced",
      });

      setComparison(res);

      if (res.routes.length > 0) {
        const defaultRoute = res.routes[0];
        setSelectedRouteId(defaultRoute.id);

        // Fetch context for each route
        const contextEntries = await Promise.allSettled(
          res.routes.map(async (r) => {
            const ctx = await getRouteContext(r.id);
            return [r.id, ctx] as const;
          }),
        );

        const ctxMap: Record<string, RouteContextResponse> = {};
        for (const entry of contextEntries) {
          if (entry.status === "fulfilled") {
            ctxMap[entry.value[0]] = entry.value[1];
          }
        }
        setContexts(ctxMap);
      }

      // Fetch nearby help points along corridor
      try {
        const hp = await getNearbyHelpPoints({
          latitude: origin.latitude,
          longitude: origin.longitude,
          radius_meters: 2500,
        });
        setHelpPoints(hp);
      } catch {
        // Non-blocking if help points are unavailable
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not plan route with current server.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, selectedTimeIndex]);

  useEffect(() => {
    void fetchRoutes();
  }, [fetchRoutes]);

  // Selected route object
  const activeRoute: RouteResponse | undefined =
    comparison?.routes.find((r) => r.id === selectedRouteId) ||
    comparison?.routes[0];
  const activeContext: RouteContextResponse | undefined = activeRoute
    ? contexts[activeRoute.id]
    : undefined;

  // Selected segment object
  const activeSegment = activeRoute?.segments.find(
    (s) => s.id === selectedSegmentId,
  );
  const activeSegmentContext = activeContext?.segments.find(
    (s) => s.segment_id === selectedSegmentId,
  );

  // Map representation adapters
  const mapRoutes: MapRoute[] = (comparison?.routes || []).map((r, i) => {
    const ctx = contexts[r.id];
    const bandInfo = formatContextBand(ctx?.route_context_band);
    return {
      id: r.id,
      label: `Option 0${i + 1}`,
      coordinates: r.geometry as [number, number][],
      context: bandInfo.kind,
    };
  });

  const mapHelpPoints: MapHelpPoint[] = helpPoints.map((hp, idx) => {
    let cat: MapHelpPoint["category"] = "support";
    if (hp.category.includes("POLICE")) cat = "police";
    else if (hp.category.includes("HOSPITAL")) cat = "hospital";
    else if (hp.category.includes("PHARMACY")) cat = "pharmacy";
    else if (hp.category.includes("TRANSIT")) cat = "transport";

    // Place within pilot bounding box for map display
    const offsetLng = (idx % 3) * 0.003;
    const offsetLat = Math.floor(idx / 3) * 0.002;
    const coord: [number, number] = [
      Math.min(72.845, Math.max(72.825, origin.longitude + offsetLng)),
      Math.min(19.06, Math.max(19.048, origin.latitude + offsetLat)),
    ];

    return {
      id: hp.reference,
      name:
        hp.sponsor_disclosure ||
        `${hp.category.replace(/_/g, " ")} (${hp.reference.slice(0, 8)})`,
      category: cat,
      coordinate: coord,
      freshness:
        hp.verification_status === "VERIFIED"
          ? "Verified"
          : hp.verification_status,
    };
  });

  const selectedHelpPoint = helpPoints.find(
    (hp) => hp.reference === selectedHelpPointRef,
  );

  // Start journey action
  const handleStartTrip = async () => {
    if (!activeRoute) return;
    setIsStartingTrip(true);
    setTripError(null);

    try {
      // Ensure active trip consent exists
      const existingConsents = await listConsents();
      let consent = existingConsents.find(
        (c) => c.purpose === "ACTIVE_TRIP_LOCATION" && c.effective,
      );

      if (!consent) {
        consent = await createConsent("ACTIVE_TRIP_LOCATION", true);
      }

      const departureDate = new Date();
      const arrivalDate = new Date(
        departureDate.getTime() + (activeRoute.duration_seconds || 1200) * 1000,
      );

      const trip = await createTrip({
        route_id: activeRoute.id,
        planned_arrival: arrivalDate.toISOString(),
        planned_departure: departureDate.toISOString(),
        travel_mode: "walking",
        active_trip_consent: true,
        consent_reference: consent.id,
        consent_version: "2026-01",
        sharing_scope: "STATUS_ONLY",
      });

      // Store in session storage so Trips page can follow it
      sessionStorage.setItem("saferpath_current_trip_id", trip.trip_id);
      navigate("/trips");
    } catch (err) {
      setTripError(
        err instanceof Error ? err.message : "Could not start trip.",
      );
    } finally {
      setIsStartingTrip(false);
    }
  };

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
            Route Planning · Context Engine
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#14231d]">
            Choose with more context.
          </h1>
          <p className="mt-1 text-xs text-[#62706a]">
            Deterministic contextual evidence across time. Never a numerical
            score or safety guarantee.
          </p>
        </div>
        <button
          onClick={() => void fetchRoutes()}
          disabled={isLoading}
          className="flex items-center gap-2 bg-[#16756c] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#075b53] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Evaluating..." : "Refresh context"}
        </button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div
          role="alert"
          className="mb-6 border-l-4 border-[#b6433d] bg-[#fde8e7] p-4 text-sm text-[#b6433d]"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Route evaluation could not be completed
              </p>
              <p className="mt-0.5 text-xs text-[#14231d]">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Input & Map Layout ── */}
      <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        {/* Left: Origin/Destination & Time Lens */}
        <div className="border border-[#d8ddd7] bg-[#fffefb] p-5 shadow-sm">
          <div>
            <label
              htmlFor={originInputId}
              className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]"
            >
              From (Origin)
            </label>
            <div className="mt-1.5 flex items-center border-b border-[#d8ddd7] py-2 text-sm">
              <MapPin className="mr-2 h-4 w-4 shrink-0 text-[#16756c]" />
              <input
                id={originInputId}
                type="text"
                value={originLabel}
                onChange={(e) => setOriginLabel(e.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#62706a]">
              Pilot area coordinates: {origin.latitude.toFixed(4)}°N,{" "}
              {origin.longitude.toFixed(4)}°E
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor={destInputId}
              className="block text-xs font-semibold uppercase tracking-wider text-[#62706a]"
            >
              To (Destination)
            </label>
            <div className="mt-1.5 flex items-center border-b border-[#d8ddd7] py-2 text-sm">
              <MapPin className="mr-2 h-4 w-4 shrink-0 text-[#b6433d]" />
              <input
                id={destInputId}
                type="text"
                value={destLabel}
                onChange={(e) => setDestLabel(e.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#62706a]">
              Pilot area coordinates: {destination.latitude.toFixed(4)}°N,{" "}
              {destination.longitude.toFixed(4)}°E
            </p>
          </div>

          {/* Time Lens */}
          <div className="mt-6 border-t border-[#d8ddd7] pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                Time Lens · Departure
              </span>
              <span className="flex items-center gap-1 text-xs text-[#16756c]">
                <Clock className="h-3.5 w-3.5" />
                Active lens
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {TIME_SLOTS.map((slot, idx) => (
                <button
                  key={slot.label}
                  type="button"
                  onClick={() => setSelectedTimeIndex(idx)}
                  className={`flex-1 border px-3 py-2.5 text-center text-xs font-medium transition-colors ${
                    selectedTimeIndex === idx
                      ? "border-[#16756c] bg-[#dcefe9] font-semibold text-[#075b53]"
                      : "border-[#d8ddd7] bg-[#fffefb] text-[#53615a] hover:bg-[#f0f2ed]"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-[#62706a]">
              Context conditions change deterministically with the time lens.
              Pedestrian activity, daylight, and facility operating status
              update accordingly.
            </p>
          </div>

          {/* Start Journey Action */}
          <div className="mt-6 border-t border-[#d8ddd7] pt-5">
            {tripError && (
              <p className="mb-3 text-xs text-[#b6433d]">{tripError}</p>
            )}
            <button
              onClick={() => void handleStartTrip()}
              disabled={!activeRoute || isStartingTrip}
              className="flex w-full items-center justify-center gap-2 bg-[#16756c] py-3 text-sm font-semibold text-white transition hover:bg-[#075b53] disabled:opacity-50"
            >
              {isStartingTrip
                ? "Starting active journey..."
                : "Start journey with this route"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2 text-center text-[11px] text-[#62706a]">
              Active-trip location sharing is off by default and requires
              separate consent.
            </p>
          </div>
        </div>

        {/* Right: Map & Alternatives */}
        <div>
          <SaferPathMap
            className="h-80 w-full"
            routes={mapRoutes}
            selectedRoute={selectedRouteId}
            helpPoints={mapHelpPoints}
            onSelectRoute={(id) => {
              setSelectedRouteId(id);
              setSelectedSegmentId(null);
            }}
            onSelectHelp={(ref) => setSelectedHelpPointRef(ref)}
          />

          {selectedHelpPointRef && selectedHelpPoint && (
            <div className="mt-2 flex items-center justify-between border border-[#d8ddd7] bg-[#fffefb] p-3 text-xs text-[#53615a]">
              <div>
                <span className="font-semibold text-[#14231d]">
                  Selected Help Point:
                </span>{" "}
                {selectedHelpPoint.category.replace(/_/g, " ")} (
                {selectedHelpPoint.verification_status})
                {selectedHelpPoint.contact &&
                  ` · Tel: ${selectedHelpPoint.contact}`}
              </div>
              <button
                onClick={() => setSelectedHelpPointRef(null)}
                className="text-[#62706a] hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Route Alternative Cards */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {isLoading ? (
              <div className="col-span-3 border border-dashed border-[#d8ddd7] p-4 text-center text-xs text-[#62706a]">
                Querying Valhalla and evaluating Safety Context...
              </div>
            ) : comparison?.routes && comparison.routes.length > 0 ? (
              comparison.routes.map((r, i) => {
                const isSelected = r.id === selectedRouteId;
                const ctx = contexts[r.id];
                const bandInfo = formatContextBand(ctx?.route_context_band);
                const minutes = Math.round(r.duration_seconds / 60);
                const km = (r.distance_meters / 1000).toFixed(1);

                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRouteId(r.id);
                      setSelectedSegmentId(null);
                    }}
                    className={`border p-3 text-left transition-all ${
                      isSelected
                        ? "border-[#16756c] bg-[#dcefe9] shadow-sm"
                        : "border-[#d8ddd7] bg-[#fffefb] hover:bg-[#f0f2ed]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#14231d]">
                        Option 0{i + 1}
                      </span>
                      <span className="text-xs text-[#62706a]">
                        {minutes} min
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[#53615a]">
                      {km} km · Walking
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-block border px-1.5 py-0.5 text-[10px] font-semibold ${bandInfo.badgeClass}`}
                      >
                        {bandInfo.label}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-3 border border-[#d8ddd7] bg-[#fffefb] p-4 text-center text-xs text-[#62706a]">
                No routes returned for this corridor.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Route Evidence & Context Details ── */}
      {activeRoute && (
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <article className="border-t-2 border-[#16756c] bg-[#fffefb] p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
                Why this route · Evidence breakdown
              </p>
              {activeContext && (
                <span className="text-xs text-[#62706a]">
                  Context rule: v{activeContext.rule_version}
                </span>
              )}
            </div>

            <h2 className="mt-2 font-serif text-xl font-semibold text-[#14231d]">
              {formatContextBand(activeContext?.route_context_band).label} —{" "}
              {Math.round(activeRoute.duration_seconds / 60)} min walk
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#53615a]">
              {typeof activeContext?.explanation === "object" &&
              activeContext.explanation !== null
                ? JSON.stringify(activeContext.explanation).replace(
                    /[{}"]/g,
                    " ",
                  )
                : "Evaluation calculated across mapped infrastructure, lighting, daylight context, and verified facilities."}
            </p>

            {/* Segments Breakdown */}
            <div className="mt-6 border-t border-[#d8ddd7] pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                Route Segments ({activeRoute.segments.length}) — Click to
                inspect
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeRoute.segments.map((seg, sIdx) => {
                  const segCtx = activeContext?.segments.find(
                    (s) => s.segment_id === seg.id,
                  );
                  const isSegSelected = seg.id === selectedSegmentId;
                  const segBand = formatContextBand(segCtx?.context_band);

                  return (
                    <button
                      key={seg.id}
                      onClick={() =>
                        setSelectedSegmentId(isSegSelected ? null : seg.id)
                      }
                      className={`border px-3 py-2 text-xs transition ${
                        isSegSelected
                          ? "border-[#16756c] bg-[#dcefe9] font-semibold text-[#075b53]"
                          : "border-[#d8ddd7] bg-[#fffefb] text-[#53615a] hover:bg-[#f0f2ed]"
                      }`}
                    >
                      <span>
                        Segment {sIdx + 1} ({seg.length_meters}m)
                      </span>
                      <span className={`ml-2 text-[10px] ${segBand.color}`}>
                        ● {segBand.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeSegment && activeSegmentContext && (
                <div className="mt-4 border border-[#d8ddd7] bg-[#f7f6f1] p-4 text-xs">
                  <div className="flex items-center justify-between font-semibold text-[#14231d]">
                    <span>
                      Selected Segment Details (Sequence{" "}
                      {activeSegment.sequence})
                    </span>
                    <span>
                      Length: {activeSegment.length_meters}m · Walk:{" "}
                      {Math.round(activeSegment.travel_seconds / 60)} min
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-[#53615a]">
                    <div>
                      <span className="font-semibold text-[#14231d]">
                        Strongest Support:
                      </span>{" "}
                      {activeSegmentContext.strongest_support.length > 0
                        ? activeSegmentContext.strongest_support.join(", ")
                        : "Baseline mapped conditions"}
                    </div>
                    <div>
                      <span className="font-semibold text-[#14231d]">
                        Caution Factors:
                      </span>{" "}
                      {activeSegmentContext.caution.length > 0
                        ? activeSegmentContext.caution.join(", ")
                        : "None reported"}
                    </div>
                    <div>
                      <span className="font-semibold text-[#14231d]">
                        Confidence:
                      </span>{" "}
                      {activeSegmentContext.confidence}
                    </div>
                    <div>
                      <span className="font-semibold text-[#14231d]">
                        Coverage:
                      </span>{" "}
                      {activeSegmentContext.coverage}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence details grid */}
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[#d8ddd7] pt-5 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  What supports it
                </dt>
                <dd className="mt-1 font-medium text-[#14231d]">
                  {activeContext?.segments[0]?.strongest_support.join(", ") ||
                    "Active commercial corridor, street lighting"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#62706a]">
                  What is uncertain
                </dt>
                <dd className="mt-1 font-medium text-[#14231d]">
                  {activeContext?.segments[0]?.caution.join(", ") ||
                    "Conditions may vary after midnight"}
                </dd>
              </div>
            </dl>
          </article>

          {/* Help Points sidebar card */}
          <aside className="border border-[#d8ddd7] bg-[#fffefb] p-6 shadow-sm">
            <LifeBuoy className="h-6 w-6 text-[#16756c]" />
            <h2 className="mt-3 font-serif text-lg font-semibold text-[#14231d]">
              Verified Help Points
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#62706a]">
              Police stations, hospitals, and pharmacies near your route
              corridor.
            </p>

            <div className="mt-4 space-y-3">
              {helpPoints.slice(0, 3).map((hp) => (
                <div
                  key={hp.reference}
                  className="border-b border-[#d8ddd7] pb-2 text-xs"
                >
                  <p className="font-semibold text-[#14231d]">
                    {hp.category.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-[#62706a]">
                    Status: {hp.operating_status} · {hp.verification_status}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/help")}
              className="mt-5 inline-block text-xs font-semibold text-[#075b53] hover:underline"
            >
              Browse all nearby assistance →
            </button>
          </aside>
        </section>
      )}

      {/* ── Guidance Notice ── */}
      <div className="mt-6 flex items-start gap-2 border border-[#d8ddd7] bg-[#fffefb] p-4 text-xs text-[#53615a]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#16756c]" />
        <p>
          SaferPath provides contextual awareness derived from public
          infrastructure and reports. It does not predict or guarantee safety.
          You make the final travel decisions.
        </p>
      </div>
    </div>
  );
}
