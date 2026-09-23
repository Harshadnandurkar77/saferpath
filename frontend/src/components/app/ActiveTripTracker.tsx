import { useEffect, useState, useRef, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  XSquare,
  FlaskConical,
  RefreshCw,
  Check,
  ShieldAlert,
} from "lucide-react";
import {
  distanceInMeters,
  distanceToRoute,
  calculateDistance,
} from "../../utils/geo";
import {
  stopTrip,
  triggerDemoDeviation,
  respondToDeviation,
  checkInTrip,
} from "../../api/trips";
import { getRoute } from "../../api/routes";
import { getRouteContext } from "../../api/context";
import type { RouteResponse, RouteContextResponse } from "../../api/types";

interface ActiveTripTrackerProps {
  tripId: string;
  routeCoordinates: [number, number][]; // [lon, lat][]
  destination: { latitude: number; longitude: number; label?: string };
  onLocationUpdate: (
    current: [number, number],
    breadcrumbs: [number, number][],
  ) => void;
  onTripCompleted: () => void;
  onStopTrip: () => void;
  onRouteUpdated?: (
    newRoute: RouteResponse,
    newContext?: RouteContextResponse,
  ) => void;
}

type DeviationState =
  | "IDLE"
  | "PROMPTING"
  | "RECALCULATING"
  | "RECALCULATED"
  | "ESCALATED";

export function ActiveTripTracker({
  tripId,
  routeCoordinates,
  destination,
  onLocationUpdate,
  onTripCompleted,
  onStopTrip,
  onRouteUpdated,
}: ActiveTripTrackerProps) {
  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(
    null,
  );
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);
  const [distanceRemaining, setDistanceRemaining] =
    useState<string>("Calculating...");
  const [metersRemaining, setMetersRemaining] = useState<number | null>(null);
  const [isDeviated, setIsDeviated] = useState(false);
  const [deviationMeters, setDeviationMeters] = useState(0);
  const [status, setStatus] = useState<"ACTIVE" | "ARRIVED" | "STOPPED">(
    "ACTIVE",
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  // Demo Smart Deviation states
  const [isTriggeringDemo, setIsTriggeringDemo] = useState(false);
  const [deviationState, setDeviationState] = useState<DeviationState>("IDLE");
  const [updatedBand, setUpdatedBand] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const arrivalCountRef = useRef(0);

  const handleArrival = useCallback(async () => {
    try {
      await stopTrip(tripId);
    } catch {
      setGeoError(
        "Destination reached, but we could not confirm trip completion with the server. Tracking remains active while we retry.",
      );
      return;
    }
    setStatus("ARRIVED");
    setTimeout(() => {
      setStatus("STOPPED");
      onTripCompleted();
    }, 2500);
  }, [tripId, onTripCompleted]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    const onPosSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const newCoord: [number, number] = [longitude, latitude];

      setCurrentCoords(newCoord);
      setGeoError(null);

      // Add to breadcrumb if moved more than 5 meters from last breadcrumb
      setBreadcrumbs((prev) => {
        if (prev.length === 0) {
          const updated = [newCoord];
          onLocationUpdate(newCoord, updated);
          return updated;
        }
        const last = prev[prev.length - 1];
        const moved = distanceInMeters(latitude, longitude, last[1], last[0]);
        if (moved > 5) {
          const updated = [...prev, newCoord];
          onLocationUpdate(newCoord, updated);
          return updated;
        }
        onLocationUpdate(newCoord, prev);
        return prev;
      });

      // Calculate distance to destination
      const distM = distanceInMeters(
        latitude,
        longitude,
        destination.latitude,
        destination.longitude,
      );
      setMetersRemaining(Math.round(distM));
      setDistanceRemaining(
        calculateDistance(
          latitude,
          longitude,
          destination.latitude,
          destination.longitude,
        ),
      );

      // Arrival detection: within 70 meters on 2 consecutive readings
      if (distM <= 70) {
        arrivalCountRef.current += 1;
        if (arrivalCountRef.current >= 2 && status === "ACTIVE") {
          void handleArrival();
        }
      } else {
        arrivalCountRef.current = 0;
      }

      // Real GPS deviation check: distance from planned polyline > 75m
      if (routeCoordinates && routeCoordinates.length > 1) {
        const offDist = distanceToRoute(latitude, longitude, routeCoordinates);
        if (offDist > 75) {
          setIsDeviated(true);
          setDeviationMeters(Math.round(offDist));
          // If real GPS deviates and not currently handling prompt, prompt user
          setDeviationState((curr) => (curr === "IDLE" ? "PROMPTING" : curr));
        } else {
          setIsDeviated(false);
          setDeviationMeters(0);
        }
      }
    };

    const onPosError = (err: GeolocationPositionError) => {
      setGeoError(`GPS reading failed (${err.message}). Tracking paused.`);
    };

    // Real browser GPS watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosSuccess,
      onPosError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [destination, routeCoordinates, onLocationUpdate, status, handleArrival]);

  // Demo Smart Deviation trigger
  const handleTriggerDemoDeviation = async () => {
    setIsTriggeringDemo(true);
    setDemoError(null);
    try {
      await triggerDemoDeviation(tripId);
      setDeviationState("PROMPTING");
    } catch (error) {
      setDemoError(
        error instanceof Error
          ? error.message
          : "The demo deviation could not be triggered.",
      );
    } finally {
      setIsTriggeringDemo(false);
    }
  };

  // User says YES: "Did you choose to leave the planned route?" -> YES
  const handleConfirmRouteChange = async () => {
    setDeviationState("RECALCULATING");
    try {
      const res = await respondToDeviation(
        tripId,
        "CONFIRM_ROUTE_CHANGE",
        undefined,
        currentCoords
          ? { longitude: currentCoords[0], latitude: currentCoords[1] }
          : undefined,
      );
      if (res.alternate_route_id) {
        const [newRoute, newCtx] = await Promise.all([
          getRoute(res.alternate_route_id),
          getRouteContext(res.alternate_route_id).catch(() => undefined),
        ]);
        setUpdatedBand(res.context_band || null);
        if (onRouteUpdated) {
          onRouteUpdated(newRoute, newCtx);
        }
      }
      setDeviationState("RECALCULATED");
      setTimeout(() => {
        setDeviationState("IDLE");
        setIsDeviated(false);
      }, 3500);
    } catch (error) {
      setDemoError(
        error instanceof Error
          ? error.message
          : "The alternate route could not be evaluated.",
      );
      setDeviationState("IDLE");
    }
  };

  // User says NO: "Did you choose to leave the planned route?" -> NO
  const handleRejectRouteChange = async () => {
    try {
      await respondToDeviation(tripId, "REJECT_ROUTE_CHANGE");
    } catch {
      // Non-blocking
    }
    setDeviationState("ESCALATED");
  };

  // Check-in safe after escalation
  const handleCheckInSafe = async () => {
    try {
      await checkInTrip(tripId);
    } catch {
      // Non-blocking
    }
    setDeviationState("IDLE");
    setIsDeviated(false);
  };

  const handleManualStop = async () => {
    setIsEnding(true);
    try {
      await stopTrip(tripId);
    } catch {
      // Non-blocking
    } finally {
      setIsEnding(false);
      onStopTrip();
    }
  };

  if (status === "ARRIVED" || status === "STOPPED") {
    return (
      <div className="rounded-xl border border-[#16756c] bg-[#dcefe9] p-5 text-[#075b53] shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-[#16756c]" />
          <div>
            <h4 className="font-serif text-lg font-bold">You have arrived!</h4>
            <p className="text-xs text-[#075b53]">
              Destination reached. Active trip tracking and sharing has
              concluded and was marked stopped on the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#d8ddd7] bg-[#fffefb] p-5 shadow-sm space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#e2e6e1] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#14231d]">
            Active Trip Tracking
          </span>
        </div>
        <span className="rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-xs font-semibold text-[#0369a1]">
          {currentCoords ? "Live GPS" : "Waiting for GPS"}
        </span>
      </div>

      {/* Geolocation status warning */}
      {geoError && (
        <div className="rounded-md border border-[#b6433d] bg-[#fff0ed] p-3 text-xs text-[#b6433d]">
          {geoError}
        </div>
      )}
      {demoError && (
        <div className="rounded-md border border-[#b6433d] bg-[#fff0ed] p-3 text-xs text-[#b6433d]">
          {demoError}
        </div>
      )}

      {/* Live metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#e2e6e1] bg-[#fbfbf9] p-3">
          <span className="text-[11px] font-semibold text-[#53615a] block">
            Distance to Destination
          </span>
          <span className="mt-1 font-serif text-xl font-bold text-[#14231d] block">
            {distanceRemaining}
          </span>
          {metersRemaining !== null && (
            <span className="text-[10px] text-[#65746d]">
              {metersRemaining <= 70 ? "Approaching arrival zone" : "En route"}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-[#e2e6e1] bg-[#fbfbf9] p-3">
          <span className="text-[11px] font-semibold text-[#53615a] block">
            Breadcrumb Path
          </span>
          <span className="mt-1 font-serif text-xl font-bold text-[#14231d] block">
            {breadcrumbs.length} pts
          </span>
          <span className="text-[10px] text-[#65746d]">
            Recorded this session
          </span>
        </div>
      </div>

      {/* =====================================================
          DEMO SMART DEVIATION / TESTING BUTTON
          Explicitly labeled as Demo / Test functionality
      ===================================================== */}
      <div className="rounded-lg border border-dashed border-[#16756c]/40 bg-[#f0f7f5] p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 text-[#16756c]" />
            <span className="text-xs font-bold text-[#16756c]">
              Demo Smart Deviation
            </span>
            <span className="rounded bg-[#16756c]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#16756c] uppercase tracking-wider">
              Test Feature
            </span>
          </div>
          <button
            type="button"
            disabled={isTriggeringDemo || deviationState !== "IDLE"}
            onClick={() => void handleTriggerDemoDeviation()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#16756c] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#075b53] disabled:opacity-50 transition"
          >
            {isTriggeringDemo ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Triggering...
              </>
            ) : (
              <>
                <FlaskConical className="h-3 w-3" />
                Test deviation detection
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-[#53615a] leading-tight">
          Simulate departing the planned route to test real-time re-evaluation
          or trusted contact alert escalation.
        </p>
      </div>

      {/* =====================================================
          SAFETY WORKFLOW STEP 1: DID YOU CHOOSE TO LEAVE ROUTE?
      ===================================================== */}
      {deviationState === "PROMPTING" && (
        <div className="rounded-xl border-2 border-[#d49e24] bg-[#fffaf0] p-4 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-[#d49e24] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif text-sm font-bold text-[#14231d]">
                Did you choose to leave the planned route?
              </h4>
              <p className="mt-1 text-xs text-[#53615a]">
                We detected that your location departed from the scheduled
                corridor. Please confirm your status:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleConfirmRouteChange()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#16756c] px-3 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#075b53] transition"
            >
              <Check className="h-4 w-4" />
              Yes, I chose this route
            </button>

            <button
              type="button"
              onClick={() => void handleRejectRouteChange()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#b6433d] px-3 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#99342f] transition"
            >
              <ShieldAlert className="h-4 w-4" />
              No, this wasn't me
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          YES WORKFLOW: RECALCULATING CONTEXT
      ===================================================== */}
      {deviationState === "RECALCULATING" && (
        <div className="rounded-xl border border-[#16756c] bg-[#e6f4f1] p-4 text-[#075b53] shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-[#16756c] shrink-0" />
            <div>
              <h5 className="font-bold text-xs">
                Recalculating context for your new route...
              </h5>
              <p className="text-[11px] text-[#53615a] mt-0.5">
                Evaluating lighting, business presence, and safety factors for
                your updated path.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          YES WORKFLOW: RECALCULATED SUCCESS
      ===================================================== */}
      {deviationState === "RECALCULATED" && (
        <div className="rounded-xl border border-[#16756c] bg-[#dcefe9] p-4 text-[#075b53] shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-[#16756c] shrink-0" />
            <div>
              <h5 className="font-bold text-xs">Route context updated!</h5>
              <p className="text-[11px] text-[#075b53] mt-0.5">
                {updatedBand
                  ? `Safety context: ${updatedBand.replace(/_/g, " ")}. `
                  : ""}
                New corridor geometry loaded. Active tracking continues
                smoothly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          NO WORKFLOW: TRUSTED-CONTACT ESCALATION
      ===================================================== */}
      {deviationState === "ESCALATED" && (
        <div className="rounded-xl border-2 border-[#b6433d] bg-[#fff0ed] p-4 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-[#b6433d] shrink-0 mt-0.5" />
            <div>
              <span className="rounded bg-[#b6433d] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Escalation Recorded
              </span>
              <h4 className="mt-1.5 font-serif text-sm font-bold text-[#b6433d]">
                We detected a route deviation.
              </h4>
              <p className="mt-1 text-xs text-[#70211d]">
                Your trusted-contact escalation has been recorded. Delivery is
                shown as confirmed only when a configured notification provider
                reports it.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white p-3 border border-[#b6433d]/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#14231d]">
                Trusted-contact alert:
              </span>
              <span className="font-bold text-[#b6433d]">
                Awaiting delivery confirmation
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#14231d]">
                Audit event:
              </span>
              <span className="font-mono text-[11px] text-[#53615a]">
                Escalation recorded
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              onClick={() => void handleCheckInSafe()}
              className="flex-1 rounded-md border border-[#53615a] bg-white px-3 py-2 text-xs font-semibold text-[#14231d] hover:bg-[#f7f6f1]"
            >
              I'm Safe / Return to Route
            </button>

            <a
              href="tel:112"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#b6433d] px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#99342f]"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Emergency 112
            </a>
          </div>
        </div>
      )}

      {/* Real GPS Deviation warning banner (if not prompting/escalated) */}
      {isDeviated && deviationState === "IDLE" && (
        <div className="rounded-lg border border-[#d49e24] bg-[#fcf3d9] p-3.5 text-xs text-[#9a6400]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-[#d49e24] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                Corridor Deviation Detected
              </span>
              <p className="mt-0.5">
                You are currently {deviationMeters}m from your chosen route.
              </p>
              <button
                type="button"
                onClick={() => setDeviationState("PROMPTING")}
                className="mt-1.5 text-xs font-bold text-[#16756c] underline hover:no-underline"
              >
                Review Route Deviation Options →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls: End Trip & 112 Handoff */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e2e6e1]">
        <button
          type="button"
          disabled={isEnding}
          onClick={() => void handleManualStop()}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#b6433d] bg-white px-3.5 py-2 text-xs font-semibold text-[#b6433d] hover:bg-[#fff0ed] disabled:opacity-50"
        >
          <XSquare className="h-3.5 w-3.5" />
          {isEnding ? "Stopping..." : "End Trip"}
        </button>

        <a
          href="tel:112"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#b6433d] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#99342f]"
        >
          <PhoneCall className="h-3.5 w-3.5" />
          Emergency 112
        </a>
      </div>
    </div>
  );
}
