import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, AlertTriangle, PhoneCall, XSquare } from "lucide-react";
import {
  distanceInMeters,
  distanceToRoute,
  calculateDistance,
} from "../../utils/geo";
import { stopTrip } from "../../api/trips";

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
}

export function ActiveTripTracker({
  tripId,
  routeCoordinates,
  destination,
  onLocationUpdate,
  onTripCompleted,
  onStopTrip,
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

  const watchIdRef = useRef<number | null>(null);
  const arrivalCountRef = useRef(0);

  const handleArrival = useCallback(async () => {
    setStatus("ARRIVED");
    try {
      await stopTrip(tripId);
    } catch {
      // Backend status recorded
    }
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

      // Check deviation: distance from planned polyline > 75m
      if (routeCoordinates && routeCoordinates.length > 1) {
        const offDist = distanceToRoute(latitude, longitude, routeCoordinates);
        if (offDist > 75) {
          setIsDeviated(true);
          setDeviationMeters(Math.round(offDist));
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
          {currentCoords
            ? `Live GPS (${currentCoords[1].toFixed(3)}, ${currentCoords[0].toFixed(3)})`
            : "Live GPS"}
        </span>
      </div>

      {/* Geolocation status warning */}
      {geoError && (
        <div className="rounded-md border border-[#b6433d] bg-[#fff0ed] p-3 text-xs text-[#b6433d]">
          {geoError}
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

      {/* Deviation alert if >75m */}
      {isDeviated && (
        <div className="rounded-lg border border-[#d49e24] bg-[#fcf3d9] p-3.5 text-xs text-[#9a6400]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-[#d49e24] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                Corridor Deviation Detected
              </span>
              <p className="mt-0.5">
                You are currently {deviationMeters}m from your chosen route. If
                you have chosen an alternate street, your location continues to
                be tracked safely.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls: End Trip & 112 Handoff */}
      <div className="flex items-center justify-between pt-2">
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
