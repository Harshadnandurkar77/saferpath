"""Geocoding proxy endpoint.

Proxies search requests to MapTiler Geocoding API so the frontend
doesn't need to make cross-origin requests directly and the API key
remains server-side (development), or the browser key can be used
(configured via VITE_MAPTILER_API_KEY in frontend/.env for local dev).

Backend proxy path: GET /v1/geocode/search?q=<query>&limit=<n>
"""

from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.config import get_settings

log = structlog.get_logger(__name__)
router = APIRouter(tags=["geocoding"])

# MapTiler geocoding endpoint
MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding/{query}.json"

# Nominatim fallback when MapTiler key is not configured
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "SaferPath/1.0 (civic-tech mobility research)"


class GeocodingResult(BaseModel):
    display_name: str
    latitude: float
    longitude: float
    place_type: str


class GeocodingResponse(BaseModel):
    results: list[GeocodingResult]
    provider: str = "nominatim"


async def _search_maptiler(
    q: str, limit: int, api_key: str
) -> list[GeocodingResult]:
    """Search via MapTiler Geocoding API (forward geocoding)."""
    import urllib.parse

    encoded_query = urllib.parse.quote(q, safe="")
    url = MAPTILER_GEOCODING_URL.format(query=encoded_query)

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(
            url,
            params={
                "key": api_key,
                "limit": limit,
                "language": "en",
                "types": "place,address,poi,locality,neighbourhood,municipality",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    results: list[GeocodingResult] = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates", [None, None])
        if coords[0] is None or coords[1] is None:
            continue

        # Build display name from place_name or text + context
        display_name = props.get("place_name", props.get("name", ""))
        if not display_name:
            continue

        results.append(
            GeocodingResult(
                display_name=display_name,
                latitude=float(coords[1]),
                longitude=float(coords[0]),
                place_type=props.get("kind", feature.get("type", "unknown")),
            )
        )
        if len(results) >= limit:
            break

    return results


async def _search_nominatim(q: str, limit: int) -> list[GeocodingResult]:
    """Fallback: Nominatim/OpenStreetMap geocoding (no API key needed)."""
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(
            NOMINATIM_URL,
            params={
                "q": q,
                "format": "jsonv2",
                "limit": limit,
                "addressdetails": 1,
            },
            headers={"User-Agent": NOMINATIM_USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()

    results: list[GeocodingResult] = []
    for item in data:
        results.append(
            GeocodingResult(
                display_name=item.get("display_name", ""),
                latitude=float(item.get("lat", 0)),
                longitude=float(item.get("lon", 0)),
                place_type=item.get("type", "unknown"),
            )
        )
    return results


@router.get("/geocode/search", response_model=GeocodingResponse)
async def geocode_search(
    q: str = Query(..., min_length=2, max_length=200, description="Place search query"),
    limit: int = Query(5, ge=1, le=10),
) -> GeocodingResponse:
    """Search for places by name via MapTiler geocoding (or Nominatim fallback).

    Returns a list of candidate places with display names and coordinates.
    The API key is NEVER logged or returned in the response body.
    """
    settings = get_settings()
    api_key = settings.maptiler_api_key

    try:
        if api_key:
            results = await _search_maptiler(q, limit, api_key)
            return GeocodingResponse(results=results, provider="maptiler")
        else:
            # Fallback to Nominatim when no MapTiler key is configured server-side
            log.debug("geocoding_fallback_nominatim", reason="no_maptiler_key")
            results = await _search_nominatim(q, limit)
            return GeocodingResponse(results=results, provider="nominatim")
    except httpx.HTTPError as exc:
        log.warning("geocoding_proxy_error", provider="maptiler" if api_key else "nominatim", error=str(exc))
        # Try Nominatim fallback if MapTiler fails
        if api_key:
            try:
                results = await _search_nominatim(q, limit)
                return GeocodingResponse(results=results, provider="nominatim_fallback")
            except Exception:
                pass
        return GeocodingResponse(results=[], provider="error")
    except Exception as exc:
        log.warning("geocoding_unexpected_error", error=str(exc))
        return GeocodingResponse(results=[], provider="error")
