"""Geocoding proxy endpoint.

Proxies search requests to Nominatim (OpenStreetMap) so the frontend
doesn't need to make cross-origin requests directly.
"""

from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter, Query
from pydantic import BaseModel

log = structlog.get_logger(__name__)
router = APIRouter(tags=["geocoding"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "SaferPath/1.0 (civic-tech mobility research)"


class GeocodingResult(BaseModel):
    display_name: str
    latitude: float
    longitude: float
    place_type: str


class GeocodingResponse(BaseModel):
    results: list[GeocodingResult]


@router.get("/geocode/search", response_model=GeocodingResponse)
async def geocode_search(
    q: str = Query(..., min_length=2, max_length=200, description="Place search query"),
    limit: int = Query(5, ge=1, le=10),
) -> GeocodingResponse:
    """Search for places by name via Nominatim geocoding.

    Returns a list of candidate places with display names and coordinates.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={
                    "q": q,
                    "format": "jsonv2",
                    "limit": limit,
                    "addressdetails": 1,
                },
                headers={"User-Agent": USER_AGENT},
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

        return GeocodingResponse(results=results)
    except httpx.HTTPError as exc:
        log.warning("geocoding_proxy_error", error=str(exc))
        return GeocodingResponse(results=[])
    except Exception as exc:
        log.warning("geocoding_unexpected_error", error=str(exc))
        return GeocodingResponse(results=[])

