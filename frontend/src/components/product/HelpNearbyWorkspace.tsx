import { useState, useEffect } from "react";
import {
  Building2,
  Info,
  LifeBuoy,
  Phone,
  Pill,
  RefreshCw,
  Shield,
  Stethoscope,
  Train,
} from "lucide-react";
import { getNearbyHelpPoints } from "../../api/helpPoints";
import type { HelpPointResponse } from "../../api/types";

const CATEGORY_CHIPS = [
  { id: "ALL", label: "All Assistance" },
  { id: "POLICE", label: "Police" },
  { id: "HOSPITAL", label: "Hospital" },
  { id: "CLINIC", label: "Clinic" },
  { id: "PHARMACY", label: "Pharmacy" },
  { id: "TRANSIT_STAFFED_POINT", label: "Transit Station" },
];

export function HelpNearbyWorkspace() {
  const [helpPoints, setHelpPoints] = useState<HelpPointResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: "Your current location",
        });
      },
      (err) => {
        setError(
          `Location access was not granted (${err.message}). You can explicitly choose the pilot corridor below.`,
        );
      },
    );
  };

  const handleSelectPilotArea = () => {
    setCoords({
      latitude: 19.054,
      longitude: 72.835,
      label: "Mumbai Pilot Corridor (Bandra / Shivaji Park)",
    });
    setError(null);
  };

  const loadPoints = async (lat: number, lon: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getNearbyHelpPoints({
        latitude: lat,
        longitude: lon,
        radius_meters: 3000,
        category: selectedCategory === "ALL" ? undefined : selectedCategory,
        verified_only: verifiedOnly,
      });
      setHelpPoints(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load nearby help points.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (coords) {
      void loadPoints(coords.latitude, coords.longitude);
    }
  }, [coords, selectedCategory, verifiedOnly]);

  const getCategoryIcon = (cat: string) => {
    if (cat.includes("POLICE")) return Shield;
    if (cat.includes("HOSPITAL")) return Building2;
    if (cat.includes("CLINIC")) return Stethoscope;
    if (cat.includes("PHARMACY")) return Pill;
    if (cat.includes("TRANSIT")) return Train;
    return LifeBuoy;
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16756c]">
            Verified Facilities & Assistance
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#14231d]">
            Help Nearby
          </h1>
          <p className="mt-1 text-xs text-[#62706a]">
            Nearby public assistance facilities with verified operating hours
            and source telemetry.
          </p>
        </div>
        <button
          onClick={() =>
            coords && void loadPoints(coords.latitude, coords.longitude)
          }
          disabled={isLoading || !coords}
          className="flex items-center gap-2 border border-[#d8ddd7] bg-[#fffefb] px-4 py-2 text-xs font-semibold text-[#53615a] transition hover:bg-[#f0f2ed] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh list
        </button>
      </div>

      {/* ── Location Preference Bar ── */}
      <div className="mb-6 rounded-xl border border-[#d8ddd7] bg-[#fffefb] p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#14231d]">Location:</span>
            <span className="rounded-md bg-[#f0f2ed] px-2.5 py-1 text-[#53615a]">
              {coords ? coords.label : "None selected (choose below)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="rounded-md border border-[#16756c] bg-[#dcefe9] px-3 py-1.5 font-bold text-[#075b53] hover:bg-[#cbeae0]"
            >
              Use My Location
            </button>
            <button
              type="button"
              onClick={handleSelectPilotArea}
              className="rounded-md border border-[#d8ddd7] bg-white px-3 py-1.5 font-semibold text-[#53615a] hover:bg-[#f0f2ed]"
            >
              View Pilot Corridor
            </button>
          </div>
        </div>
      </div>

      {/* ── Emergency 112 Banner ── */}
      <div className="mb-6 border-l-4 border-[#b6433d] bg-[#fde8e7] p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#b6433d]" />
            <div>
              <p className="font-semibold text-[#b6433d]">
                Immediate Emergency Response
              </p>
              <p className="mt-0.5 text-xs text-[#14231d]">
                If you or someone nearby is in immediate danger, call official
                emergency services directly. SaferPath does not dispatch
                emergency services.
              </p>
            </div>
          </div>
          <a
            href="tel:112"
            className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#b6433d] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
          >
            <Phone className="h-4 w-4" />
            Call 112 (India)
          </a>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedCategory(chip.id)}
              className={`border px-3 py-1.5 text-xs font-medium transition ${
                selectedCategory === chip.id
                  ? "border-[#16756c] bg-[#dcefe9] font-semibold text-[#075b53]"
                  : "border-[#d8ddd7] bg-[#fffefb] text-[#53615a] hover:bg-[#f0f2ed]"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-[#14231d]">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="text-[#16756c]"
          />
          Verified only
        </label>
      </div>

      {/* ── Help Points List ── */}
      {error && (
        <div
          role="alert"
          className="mb-6 border border-[#b6433d] bg-[#fde8e7] p-4 text-xs text-[#b6433d]"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="border border-dashed border-[#d8ddd7] p-8 text-center text-xs text-[#62706a]">
          Loading nearby help points from server...
        </div>
      ) : helpPoints.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {helpPoints.map((point) => {
            const Icon = getCategoryIcon(point.category);
            return (
              <article
                key={point.reference}
                className="border border-[#d8ddd7] bg-[#fffefb] p-5 shadow-sm transition hover:border-[#bdc9c0]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center bg-[#dcefe9] text-[#16756c]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-[#14231d]">
                        {point.category.replace(/_/g, " ")}
                      </h2>
                      <span className="text-[10px] text-[#62706a]">
                        Ref: {point.reference.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`border px-1.5 py-0.5 text-[10px] font-semibold ${
                      point.operating_status === "OPEN"
                        ? "border-[#16756c] bg-[#dcefe9] text-[#075b53]"
                        : "border-[#d8ddd7] bg-[#f0f2ed] text-[#53615a]"
                    }`}
                  >
                    {point.operating_status}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-[#53615a]">
                  <p>
                    <span className="font-semibold text-[#14231d]">
                      Status:
                    </span>{" "}
                    {point.verification_status}
                  </p>
                  {point.accessibility && (
                    <p>
                      <span className="font-semibold text-[#14231d]">
                        Accessibility:
                      </span>{" "}
                      {point.accessibility}
                    </p>
                  )}
                  {point.sponsor_disclosure && (
                    <p className="text-[11px] text-[#62706a]">
                      {point.sponsor_disclosure}
                    </p>
                  )}
                </div>

                {point.contact && (
                  <div className="mt-4 border-t border-[#d8ddd7] pt-3">
                    <a
                      href={`tel:${point.contact}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#075b53] hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      Call {point.contact}
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : !coords ? (
        <div className="border border-dashed border-[#bdc9c0] bg-[#fffefb] p-8 text-center text-sm text-[#53615a]">
          <LifeBuoy className="mx-auto h-8 w-8 text-[#16756c]/70" />
          <p className="mt-3 font-semibold text-[#14231d]">
            Choose a location to discover assistance
          </p>
          <p className="mt-1 text-xs text-[#62706a]">
            Tap "Use My Location" or "View Pilot Corridor" in the bar above to
            explore verified assistance points.
          </p>
        </div>
      ) : (
        <div className="border border-[#d8ddd7] bg-[#fffefb] p-8 text-center text-sm text-[#53615a]">
          <LifeBuoy className="mx-auto h-8 w-8 text-[#62706a]" />
          <p className="mt-3 font-semibold text-[#14231d]">
            No help points matching current filter
          </p>
          <p className="mt-1 text-xs text-[#62706a]">
            Try clearing the verified filter or choosing another category.
          </p>
        </div>
      )}

      {/* ── Source Attribution Note ── */}
      <div className="mt-8 flex items-start gap-2 border border-[#d8ddd7] bg-[#fffefb] p-4 text-xs text-[#53615a]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#16756c]" />
        <p>
          Information is sourced from official registers and verified partner
          databases. Unverified raw crowd data is clearly distinguished from
          SaferPath-verified partners.
        </p>
      </div>
    </div>
  );
}
