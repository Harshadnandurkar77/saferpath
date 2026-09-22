import { useState, useEffect, useMemo } from "react";
import {
  ArrowRight,
  Clock,
  Compass,
  Navigation,
  RefreshCw,
  Shield,
  Lightbulb,
  Store,
  Users,
} from "lucide-react";
import { SaferPathMap } from "../map/SaferPathMap";
import { compareRoutes } from "../../api/routes";
import { getRouteContext } from "../../api/context";
import { getNearbyHelpPoints } from "../../api/helpPoints";
import { createTrip } from "../../api/trips";
import { createConsent } from "../../api/privacy";
import { profile as getProfile } from "../../api/identity";
import { useAuth } from "../../context/AuthContext";
import { ActiveTripTracker } from "./ActiveTripTracker";
import { PlaceSearch } from "./PlaceSearch";
import {
  formatContextBand,
  translateSignal,
  formatLocalTimeDisplay,
  formatFreshness,
} from "../../utils/contextTranslator";
import type {
  HelpPointResponse,
  Point,
  Profile,
  RouteComparisonResponse,
  RouteContextResponse,
} from "../../api/types";
import type { ContextKind, MapHelpPoint, MapRoute } from "../map/mapTypes";

function parseCoordinateInput(str: string): Point | null {
  if (!str) return null;
  const parts = str
    .split(/[, ]+/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 2) {
    const [a, b] = parts;
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      return { latitude: a, longitude: b };
    } else if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
      return { latitude: b, longitude: a };
    }
  }
  return null;
}

export function HomeView() {
  const { account } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  // Input states — START COMPLETELY BLANK
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originPoint, setOriginPoint] = useState<Point | null>(null);
  const [destPoint, setDestPoint] = useState<Point | null>(null);

  // Time state: dynamic local time by default
  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTime, setCustomTime] = useState("");
  const [nowDisplay, setNowDisplay] = useState(formatLocalTimeDisplay());

  // Update "Leaving now" every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDisplay(formatLocalTimeDisplay());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real profile for routines & display name
  useEffect(() => {
    void getProfile()
      .then(setProfile)
      .catch(() => {});
  }, []);

  // Server state
  const [comparison, setComparison] = useState<RouteComparisonResponse | null>(
    null,
  );
  const [contexts, setContexts] = useState<
    Record<string, RouteContextResponse>
  >({});
  const [helpPoints, setHelpPoints] = useState<HelpPointResponse[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedHelpPointRef, setSelectedHelpPointRef] = useState<
    string | null
  >(null);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Trip State
  const [isTripConsentOpen, setIsTripConsentOpen] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<[number, number] | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);

  // Real user greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = profile?.display_name || account?.display_name || "Traveller";
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  }, [profile, account]);

  // Extract saved routine shortcuts strictly from real profile data
  const routineShortcuts = useMemo(() => {
    const pData = profile?.profile_data as Record<string, any> | undefined;
    const list: { label: string; origin: string; destination: string }[] = [];
    if (
      pData?.routines?.morning?.origin &&
      pData?.routines?.morning?.destination
    ) {
      list.push({
        label: "Morning Commute",
        origin: pData.routines.morning.origin,
        destination: pData.routines.morning.destination,
      });
    }
    if (
      pData?.routines?.evening?.origin &&
      pData?.routines?.evening?.destination
    ) {
      list.push({
        label: "Evening Return",
        origin: pData.routines.evening.origin,
        destination: pData.routines.evening.destination,
      });
    }
    return list;
  }, [profile]);

  // Handle routine selection
  const handleSelectRoutine = (routine: {
    origin: string;
    destination: string;
  }) => {
    setOriginText(routine.origin);
    setDestText(routine.destination);
    const origPt = parseCoordinateInput(routine.origin);
    const dstPt = parseCoordinateInput(routine.destination);
    setOriginPoint(origPt);
    setDestPoint(dstPt);
    setError(null);
  };

  // Handle "Use current location" — requires explicit user action, NO silent fallback
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setOriginText("Acquiring GPS location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: Point = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setOriginPoint(pt);
        setOriginText(
          `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        );
        setError(null);
      },
      (err) => {
        setOriginText("");
        setOriginPoint(null);
        setError(
          `Location access was not granted (${err.message}). Please enter your starting coordinates manually.`,
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Execute Route Planning — rejects if endpoints missing, NO silent pilot fallback
  const handlePlanRoute = async () => {
    const startPt = originPoint || parseCoordinateInput(originText);
    const endPt = destPoint || parseCoordinateInput(destText);

    if (!startPt || !endPt) {
      setError(
        "Please specify both a starting point and destination using place search or enter coordinates.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const todayDate = new Date().toISOString().split("T")[0];
      const timeStr =
        timeMode === "custom" && customTime
          ? customTime
          : new Date().toTimeString().split(" ")[0];
      const requestedLocalTime = `${todayDate}T${timeStr}`;

      const res = await compareRoutes({
        origin: startPt,
        destination: endPt,
        timezone: "Asia/Kolkata",
        requested_local_time: requestedLocalTime,
        time_mode: "departure",
        travel_mode: "walking",
        route_preference: "balanced",
      });

      setComparison(res);

      if (res.routes.length > 0) {
        setSelectedRouteId(res.routes[0].id);

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
          latitude: startPt.latitude,
          longitude: startPt.longitude,
          radius_meters: 2500,
        });
        setHelpPoints(hp);
      } catch {
        // Non-blocking
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Route comparison failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert routes for MapLibre
  const mapRoutes: MapRoute[] = useMemo(() => {
    if (!comparison?.routes) return [];
    return comparison.routes.map((r, idx) => {
      const coordinates: [number, number][] =
        (r.geometry as unknown as [number, number][]) || [];
      const ctxBand = contexts[r.id]?.route_context_band;
      let contextKind: ContextKind = "limited";
      if (
        ctxBand === "STRONG_CONTEXTUAL_SUPPORT" ||
        ctxBand === "GOOD_CONTEXT"
      ) {
        contextKind = "good";
      } else if (ctxBand === "MIXED_CONTEXT") {
        contextKind = "mixed";
      }
      return {
        id: r.id,
        label: idx === 0 ? "Primary Corridor" : `Alternative Path ${idx}`,
        coordinates,
        context: contextKind,
      };
    });
  }, [comparison, contexts]);

  // Convert help points for MapLibre
  const mapHelpPoints: MapHelpPoint[] = useMemo(() => {
    return helpPoints.map((hp) => {
      let cat: MapHelpPoint["category"] = "support";
      if (hp.category.includes("POLICE")) cat = "police";
      else if (hp.category.includes("HOSPITAL")) cat = "hospital";
      else if (hp.category.includes("PHARMACY")) cat = "pharmacy";
      else if (hp.category.includes("TRANSIT")) cat = "transport";

      const centerCoord: [number, number] = originPoint
        ? [originPoint.longitude, originPoint.latitude]
        : [72.835, 19.057];

      return {
        id: hp.reference,
        name: hp.category.replace(/_/g, " "),
        category: cat,
        coordinate: centerCoord,
        freshness: hp.verification_status,
      };
    });
  }, [helpPoints, originPoint]);

  const selectedRoute = useMemo(() => {
    return (
      comparison?.routes.find((r) => r.id === selectedRouteId) ||
      comparison?.routes[0]
    );
  }, [comparison, selectedRouteId]);

  const activeContext = selectedRoute ? contexts[selectedRoute.id] : undefined;
  const contextDisplay = formatContextBand(activeContext?.route_context_band);

  // Aggregate signals from activeContext segments
  const activeSignals = useMemo(() => {
    if (!activeContext?.segments) return [];
    const set = new Set<string>();
    activeContext.segments.forEach((seg) => {
      seg.strongest_support?.forEach((s) => set.add(s));
      seg.caution?.forEach((s) => set.add(s));
    });
    return Array.from(set);
  }, [activeContext]);

  // Start Trip confirmation handler
  const handleStartTripConfirm = async () => {
    if (!selectedRoute || !hasConsented) return;
    setIsStartingTrip(true);
    try {
      const consent = await createConsent("ACTIVE_TRIP_LOCATION", true);

      const arrivalTime = new Date(
        Date.now() + (selectedRoute.duration_seconds || 1800) * 1000,
      ).toISOString();

      const trip = await createTrip({
        route_id: selectedRoute.id,
        planned_arrival: arrivalTime,
        travel_mode: "walking",
        active_trip_consent: true,
        consent_reference: consent.id,
        consent_version: "v1.0",
        sharing_scope: "LOCATION",
      });

      setActiveTripId(trip.trip_id);
      setIsTripConsentOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initiate active trip.",
      );
    } finally {
      setIsStartingTrip(false);
    }
  };

  // Determine destination coordinates for active tracker
  const selectedRouteDestCoord = useMemo(() => {
    if (selectedRoute?.geometry && selectedRoute.geometry.length > 0) {
      const last = selectedRoute.geometry[selectedRoute.geometry.length - 1];
      return { longitude: last[0], latitude: last[1] };
    }
    const parsed = destPoint || parseCoordinateInput(destText);
    return parsed || { longitude: 72.84, latitude: 19.054 };
  }, [selectedRoute, destPoint, destText]);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)] bg-[#f7f6f1]">
      {/* =====================================================
          LEFT PANEL: ROUTE PLANNER & CONTEXT COMPARISON
      ===================================================== */}
      <div className="w-full lg:w-[460px] xl:w-[500px] border-r border-[#d8ddd7] bg-[#fffefb] flex flex-col shrink-0 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
        {/* Header with real user greeting */}
        <div className="border-b border-[#e2e6e1] p-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
            Urban Mobility
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#14231d]">
            {greeting}
          </h2>
          <p className="mt-1 text-xs text-[#53615a]">
            Enter your journey coordinates to evaluate street lighting,
            pedestrian flow, and nearby assistance points.
          </p>
        </div>

        {/* Input Form */}
        <div className="p-5 border-b border-[#e2e6e1] space-y-4">
          {error && (
            <div className="rounded-lg border border-[#b6433d] bg-[#fff0ed] p-3 text-xs text-[#b6433d] flex items-start gap-2">
              <span className="font-bold">Notice:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Starting Location Search */}
          <PlaceSearch
            label="Starting from"
            placeholder="Search place, landmark, street, or enter coords..."
            initialValue={originText}
            pinColor="teal"
            showCurrentLocationOption={true}
            onUseCurrentLocation={handleUseCurrentLocation}
            onSelect={(place) => {
              setOriginText(place.name);
              setOriginPoint(place.point);
              setError(null);
            }}
            onClear={() => {
              setOriginText("");
              setOriginPoint(null);
            }}
          />

          {/* Destination Search */}
          <PlaceSearch
            label="Heading to"
            placeholder="Search destination, landmark, or street..."
            initialValue={destText}
            pinColor="coral"
            onSelect={(place) => {
              setDestText(place.name);
              setDestPoint(place.point);
              setError(null);
            }}
            onClear={() => {
              setDestText("");
              setDestPoint(null);
            }}
          />

          {/* Saved Routine Shortcuts — Only displayed if user has saved routines */}
          {routineShortcuts.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-[#65746d] block mb-1.5">
                Saved routine routes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {routineShortcuts.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => handleSelectRoutine(r)}
                    className="rounded-full border border-[#16756c] bg-[#dcefe9] px-2.5 py-1 text-[11px] font-bold text-[#075b53] hover:bg-[#cbeae0]"
                  >
                    ★ {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Departure Time Row */}
          <div className="flex items-center justify-between border-t border-[#e2e6e1] pt-3 text-xs">
            <div className="flex items-center gap-1.5 text-[#53615a]">
              <Clock className="h-3.5 w-3.5 text-[#16756c]" />
              <span className="font-semibold text-[#14231d]">{nowDisplay}</span>
            </div>
            <button
              type="button"
              onClick={() => setTimeMode(timeMode === "now" ? "custom" : "now")}
              className="text-[11px] text-[#16756c] hover:underline"
            >
              {timeMode === "now" ? "Change departure time" : "Reset to now"}
            </button>
          </div>

          {timeMode === "custom" && (
            <div className="pt-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full rounded-md border border-[#bdc9c0] bg-white p-2 text-xs"
              />
            </div>
          )}

          {/* Plan Route CTA */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handlePlanRoute()}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#16756c] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#075b53] transition disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Analyzing corridor context...
              </>
            ) : (
              <>
                Compare route context
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Active Trip Tracker Panel if running */}
        {activeTripId && selectedRoute && (
          <div className="p-5 border-b border-[#e2e6e1] bg-[#f0f7f5]">
            <ActiveTripTracker
              tripId={activeTripId}
              routeCoordinates={
                (selectedRoute.geometry as unknown as [number, number][]) || []
              }
              destination={{
                latitude: selectedRouteDestCoord.latitude,
                longitude: selectedRouteDestCoord.longitude,
                label: destText || "Destination",
              }}
              onLocationUpdate={(curr, bcrumbs) => {
                setGpsLocation(curr);
                setBreadcrumbs(bcrumbs);
              }}
              onTripCompleted={() => setActiveTripId(null)}
              onStopTrip={() => setActiveTripId(null)}
            />
          </div>
        )}

        {/* Route Comparison Results */}
        <div className="flex-1 p-5 space-y-4">
          {comparison && comparison.routes.length > 0 ? (
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#14231d]">
                  {comparison.routes.length} Route Options Evaluated
                </span>
                <span className="text-[11px] text-[#53615a]">
                  Updated {formatFreshness(activeContext?.context_version)}
                </span>
              </div>

              {/* Route Selection Cards */}
              <div className="space-y-2.5 mt-2">
                {comparison.routes.map((r, idx) => {
                  const isSelected = r.id === selectedRoute?.id;
                  const cBand = formatContextBand(
                    contexts[r.id]?.route_context_band,
                  );
                  const distKm = ((r.distance_meters || 0) / 1000).toFixed(2);
                  const durationMin = Math.round(
                    (r.duration_seconds || 0) / 60,
                  );

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRouteId(r.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-[#16756c] bg-[#fffefb] shadow-sm ring-1 ring-[#16756c]"
                          : "border-[#d8ddd7] bg-[#fbfbf9] hover:bg-[#f5f7f3]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-sm font-bold text-[#14231d]">
                              {idx === 0
                                ? "Primary Corridor"
                                : `Alternative Path ${idx}`}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cBand.badgeClass}`}
                            >
                              {cBand.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#53615a]">
                            {distKm} km · Approx. {durationMin} min walk
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="selected_route"
                          checked={isSelected}
                          onChange={() => setSelectedRouteId(r.id)}
                          className="mt-1 accent-[#16756c]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Route Detailed Context Card */}
              {selectedRoute && (
                <div className="mt-5 rounded-xl border border-[#d8ddd7] bg-white p-5 shadow-xs space-y-4">
                  <div className="border-b border-[#e2e6e1] pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#16756c] uppercase tracking-wider">
                        Context Breakdown
                      </span>
                      <span className="text-[11px] font-semibold text-[#53615a]">
                        {contextDisplay.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#53615a]">
                      {contextDisplay.summary}
                    </p>
                  </div>

                  {/* Context Signals */}
                  <div className="space-y-2.5">
                    {activeSignals.length > 0 ? (
                      activeSignals.map((sig) => {
                        const tr = translateSignal(sig);
                        return (
                          <div
                            key={sig}
                            className="flex items-start gap-2.5 rounded-lg border border-[#e2e6e1] bg-[#fbfbf9] p-3 text-xs"
                          >
                            {tr.icon === "light" && (
                              <Lightbulb className="h-4 w-4 text-[#16756c] shrink-0 mt-0.5" />
                            )}
                            {tr.icon === "store" && (
                              <Store className="h-4 w-4 text-[#16756c] shrink-0 mt-0.5" />
                            )}
                            {tr.icon === "people" && (
                              <Users className="h-4 w-4 text-[#16756c] shrink-0 mt-0.5" />
                            )}
                            {tr.icon !== "light" &&
                              tr.icon !== "store" &&
                              tr.icon !== "people" && (
                                <Compass className="h-4 w-4 text-[#16756c] shrink-0 mt-0.5" />
                              )}
                            <div>
                              <span className="font-semibold text-[#14231d] block">
                                {tr.label}
                              </span>
                              <span className="text-[11px] text-[#53615a] block mt-0.5">
                                {tr.explanation}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-[#53615a]">
                        No specific alerts recorded for this corridor at the
                        requested departure time.
                      </p>
                    )}
                  </div>

                  {/* Active Trip CTA */}
                  {!activeTripId && (
                    <button
                      type="button"
                      onClick={() => setIsTripConsentOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#16756c] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#075b53] transition"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Start Active Trip on this corridor
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#bdc9c0] p-8 text-center text-[#53615a]">
              <Compass className="mx-auto h-8 w-8 text-[#16756c]/70" />
              <h3 className="mt-3 font-serif text-base font-bold text-[#14231d]">
                Enter your journey endpoints
              </h3>
              <p className="mt-1 text-xs text-[#53615a] max-w-xs mx-auto">
                Type starting and destination coordinates (e.g. 19.054, 72.828
                to 19.054, 72.840) or use current location to compare lighting,
                footpaths, and help points.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          RIGHT PANEL: INTERACTIVE MAPLIBRE MAP
      ===================================================== */}
      <div className="flex-1 relative min-h-[350px]">
        <SaferPathMap
          className="h-full w-full"
          routes={mapRoutes}
          selectedRoute={selectedRoute?.id || ""}
          helpPoints={mapHelpPoints}
          originPoint={
            originPoint ? [originPoint.longitude, originPoint.latitude] : null
          }
          destinationPoint={
            destPoint ? [destPoint.longitude, destPoint.latitude] : null
          }
          currentLocation={gpsLocation}
          breadcrumbCoordinates={breadcrumbs}
          onSelectRoute={(id) => setSelectedRouteId(id)}
          onSelectHelp={(id) => setSelectedHelpPointRef(id)}
        />

        {/* Selected Help Point detail popup */}
        {selectedHelpPointRef && (
          <div className="absolute bottom-6 right-6 max-w-xs rounded-xl border border-[#d8ddd7] bg-[#fffefb] p-4 shadow-md text-xs">
            <div className="flex items-center justify-between border-b border-[#e2e6e1] pb-2">
              <span className="font-bold text-[#14231d]">Help Facility</span>
              <button
                type="button"
                onClick={() => setSelectedHelpPointRef(null)}
                className="text-xs text-[#53615a] hover:text-[#14231d]"
              >
                ✕
              </button>
            </div>
            {(() => {
              const hp = helpPoints.find(
                (x) => x.reference === selectedHelpPointRef,
              );
              if (!hp) return null;
              return (
                <div className="mt-2 space-y-1">
                  <p className="font-serif font-bold text-[#14231d]">
                    {hp.category.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-[#53615a]">
                    Status: {hp.verification_status}
                  </p>
                  {hp.contact && (
                    <a
                      href={`tel:${hp.contact}`}
                      className="mt-2 inline-flex items-center gap-1 font-bold text-[#16756c] hover:underline"
                    >
                      Call: {hp.contact}
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* =====================================================
          EXPLICIT CONSENT MODAL FOR ACTIVE TRIP
      ===================================================== */}
      {isTripConsentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#d8ddd7] bg-[#fffefb] p-6 shadow-xl text-xs">
            <div className="flex items-center gap-2 text-[#16756c]">
              <Shield className="h-5 w-5" />
              <span className="font-serif text-lg font-bold text-[#14231d]">
                Start Active Trip Tracking
              </span>
            </div>

            <p className="mt-3 text-xs text-[#53615a] leading-relaxed">
              Active trip tracking uses your browser's real-time GPS to record
              your path, detect corridor deviation, and automatically conclude
              when you arrive within 70m of your destination.
            </p>

            <div className="mt-4 rounded-lg border border-[#bdc9c0] bg-[#fbfbf9] p-3.5 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasConsented}
                  onChange={(e) => setHasConsented(e.target.checked)}
                  className="mt-0.5 accent-[#16756c]"
                />
                <span className="text-[11px] font-medium text-[#14231d]">
                  I agree to share my live location during this trip. Tracking
                  ceases immediately when I arrive or tap "End Trip".
                </span>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e2e6e1] pt-4">
              <button
                type="button"
                onClick={() => setIsTripConsentOpen(false)}
                className="rounded-md border border-[#bdc9c0] bg-white px-4 py-2 text-xs font-semibold text-[#53615a] hover:bg-[#f0f2ed]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hasConsented || isStartingTrip}
                onClick={() => void handleStartTripConfirm()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#16756c] px-5 py-2 text-xs font-bold text-white hover:bg-[#075b53] disabled:opacity-50"
              >
                {isStartingTrip ? "Starting..." : "Begin Trip"}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
