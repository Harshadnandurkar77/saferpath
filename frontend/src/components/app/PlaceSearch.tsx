import { useState, useEffect, useRef, useId } from "react";
import { MapPin, Search, Loader2, X, Navigation } from "lucide-react";
import { searchPlaces, type GeocodingResult } from "../../api/geocoding";
import type { Point } from "../../api/types";

interface PlaceSearchProps {
  label?: string;
  placeholder?: string;
  initialValue?: string;
  onSelect: (place: { name: string; point: Point }) => void;
  onQueryChange?: (query: string) => void;
  onClear?: () => void;
  onUseCurrentLocation?: () => void;
  showCurrentLocationOption?: boolean;
  pinColor?: "teal" | "coral" | "muted";
  className?: string;
  disabled?: boolean;
}

export function PlaceSearch({
  label,
  placeholder = "Search a place, landmark, or street...",
  initialValue = "",
  onSelect,
  onQueryChange,
  onClear,
  onUseCurrentLocation,
  showCurrentLocationOption = false,
  pinColor = "teal",
  className = "",
  disabled = false,
}: PlaceSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initialValue changes if parent updates it externally
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  // Handle outside click to close suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerSearch = (text: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(trimmed, 6);
        setResults(data);
        setIsOpen(true);
      } catch {
        setError("Unable to reach geocoding service.");
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onQueryChange?.(val);
    triggerSearch(val);
  };

  const handleSelectResult = (item: GeocodingResult) => {
    // Simplify display name (take first 2 comma segments or full if short)
    const segments = item.display_name.split(",");
    const shortName =
      segments.length > 2
        ? `${segments[0].trim()}, ${segments[1].trim()}`
        : item.display_name;

    setQuery(shortName);
    setIsOpen(false);
    setResults([]);
    onSelect({
      name: shortName,
      point: {
        latitude: item.latitude,
        longitude: item.longitude,
      },
    });
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    if (onClear) onClear();
  };

  const pinColorClass =
    pinColor === "coral"
      ? "text-[var(--coral,#b6433d)]"
      : pinColor === "muted"
        ? "text-[var(--muted,#62706a)]"
        : "text-[var(--teal,#16756c)]";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs mb-1">
          <label
            htmlFor={inputId}
            className="font-semibold text-[var(--muted,#53615a)]"
          >
            {label}
          </label>
          {showCurrentLocationOption && onUseCurrentLocation && (
            <button
              type="button"
              onClick={onUseCurrentLocation}
              disabled={disabled}
              className="inline-flex items-center gap-1 font-medium text-[var(--teal,#16756c)] hover:underline disabled:opacity-50"
            >
              <Navigation className="h-3 w-3" />
              Use current location
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <MapPin
          className={`absolute left-3 top-3 h-4 w-4 shrink-0 ${pinColorClass}`}
        />
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded-md border border-[var(--line,#bdc9c0)] bg-[var(--surface,#ffffff)] py-2.5 pl-9 pr-8 text-xs text-[var(--ink,#14231d)] outline-none transition focus:border-[var(--teal,#16756c)] focus:ring-1 focus:ring-[var(--teal,#16756c)] disabled:bg-gray-100 dark:disabled:bg-gray-800"
        />

        <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--muted,#62706a)]" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-[var(--muted,#62706a)] hover:text-[var(--ink,#14231d)]"
              aria-label="Clear location search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Search className="h-3.5 w-3.5 text-[var(--muted,#62706a)]" />
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[var(--line,#d8ddd7)] bg-[var(--surface,#fffefb)] py-1 shadow-lg text-xs"
        >
          {error && (
            <li className="p-2.5 text-[11px] text-[var(--coral,#b6433d)]">
              {error}
            </li>
          )}

          {results.length === 0 && !loading && (
            <li className="p-3 text-center text-[11px] text-[var(--muted,#62706a)]">
              No matching places found. Try a landmark, station, neighbourhood, or full address.
            </li>
          )}

          {results.map((item, idx) => (
            <li
              key={`${item.latitude}-${item.longitude}-${idx}`}
              onClick={() => handleSelectResult(item)}
              className="flex cursor-pointer items-start gap-2 px-3 py-2 text-[var(--ink,#14231d)] hover:bg-[var(--teal-soft,#dcefe9)] hover:text-[var(--teal,#075b53)] transition"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--teal,#16756c)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-xs">
                  {item.display_name.split(",")[0]}
                </p>
                <p className="truncate text-[10px] text-[var(--muted,#62706a)]">
                  {item.display_name}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
