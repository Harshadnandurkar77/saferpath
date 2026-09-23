"""OSRM-backed road-network routing provider.

The public OSRM endpoint is suitable for development. Production deployments
should set ROUTING_OSRM_URL to their own managed OSRM instance.
"""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.modules.routing.provider import (
    ProviderRoute,
    ProviderRouteRequest,
    ProviderSegment,
    RoutingProvider,
    RoutingProviderError,
)


class OsrmRoutingProvider(RoutingProvider):
    name = "osrm"

    def routes(self, request: ProviderRouteRequest) -> tuple[ProviderRoute, ...]:
        settings = get_settings()
        coordinates = f"{request.origin[0]},{request.origin[1]};{request.destination[0]},{request.destination[1]}"
        url = f"{settings.routing_osrm_url.rstrip('/')}/route/v1/{settings.routing_osrm_profile}/{coordinates}"
        try:
            response = httpx.get(
                url,
                params={"alternatives": "true", "overview": "full", "geometries": "geojson", "steps": "false"},
                timeout=settings.request_timeout_seconds,
                headers={"User-Agent": "SaferPath/1.0"},
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.TimeoutException as exc:
            raise RoutingProviderError("timeout") from exc
        except httpx.HTTPError as exc:
            raise RoutingProviderError("unavailable") from exc

        if payload.get("code") == "NoRoute":
            raise RoutingProviderError("no_route")
        routes = payload.get("routes")
        if not isinstance(routes, list) or not routes:
            raise RoutingProviderError("invalid_response")

        results: list[ProviderRoute] = []
        for sequence, route in enumerate(routes[:3], start=1):
            geometry = route.get("geometry", {}).get("coordinates", [])
            if not isinstance(geometry, list) or len(geometry) < 2:
                raise RoutingProviderError("invalid_response")
            coordinates_tuple = tuple((float(point[0]), float(point[1])) for point in geometry)
            distance = max(1, round(float(route.get("distance", 0))))
            duration = max(1, round(float(route.get("duration", 0))))
            results.append(
                ProviderRoute(
                    reference=f"osrm-{sequence}",
                    sequence=sequence,
                    coordinates=coordinates_tuple,
                    duration_seconds=duration,
                    distance_meters=distance,
                    segments=(ProviderSegment(1, coordinates_tuple, distance, duration),),
                    metadata={"provider": "OSRM", "profile": settings.routing_osrm_profile},
                )
            )
        return tuple(results)
