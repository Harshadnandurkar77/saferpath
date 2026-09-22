import { api } from "./client";

export interface GeocodingResult {
  display_name: string;
  latitude: number;
  longitude: number;
  place_type: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
}

/**
 * Search for places by name via the backend geocoding proxy.
 */
export async function searchPlaces(
  query: string,
  limit: number = 5,
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  const data = await api<GeocodingResponse>(
    `/geocode/search?${params.toString()}`,
    {},
    false,
  );
  return data.results;
}
