/**
 * Centralized MapTiler style configuration.
 *
 * The API key is read ONLY from the environment variable VITE_MAPTILER_API_KEY.
 * It is NEVER hardcoded here and NEVER printed in logs or errors.
 *
 * Light style:  streets-v4  (detailed pedestrian street map)
 * Dark  style:  dataviz-dark (high-contrast, good route visibility)
 */

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY as
  | string
  | undefined;

function buildStyleUrl(styleId: string): string {
  if (!MAPTILER_KEY) return "";
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_KEY}`;
}

/** Returns the MapLibre-compatible style URL for the given theme. */
export function getMapStyle(theme: "light" | "dark"): string {
  if (!MAPTILER_KEY) {
    // Clear dev-time indicator — do NOT expose the key placeholder text
    console.warn(
      "[SaferPathMap] VITE_MAPTILER_API_KEY is not set. " +
        "Copy frontend/.env.example → frontend/.env and add your MapTiler API key.",
    );
    // Fallback: public OpenFreeMap (no key needed, OSM data)
    return "https://tiles.openfreemap.org/styles/liberty";
  }
  return theme === "dark"
    ? buildStyleUrl("dataviz-dark")
    : buildStyleUrl("streets-v4");
}

/** Static light style (for components that do not have theme access). */
export const mapStyle = getMapStyle("light");
