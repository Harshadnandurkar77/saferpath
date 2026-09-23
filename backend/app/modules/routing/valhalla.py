"""Valhalla pedestrian routing with real route alternatives."""

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


def decode_shape(encoded: str) -> tuple[tuple[float, float], ...]:
    coordinates: list[tuple[float, float]] = []
    index = latitude = longitude = 0
    while index < len(encoded):
        values = []
        for _ in range(2):
            result = shift = 0
            while True:
                if index >= len(encoded):
                    raise RoutingProviderError("invalid_response")
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            values.append(~(result >> 1) if result & 1 else result >> 1)
        latitude += values[0]
        longitude += values[1]
        coordinates.append((longitude / 1_000_000, latitude / 1_000_000))
    return tuple(coordinates)


class ValhallaRoutingProvider(RoutingProvider):
    name = "valhalla"

    def routes(self, request: ProviderRouteRequest) -> tuple[ProviderRoute, ...]:
        settings = get_settings()
        payload = {
            "locations": [
                {"lat": request.origin[1], "lon": request.origin[0]},
                {"lat": request.destination[1], "lon": request.destination[0]},
            ],
            "costing": "pedestrian",
            "alternates": 2,
            "units": "kilometers",
        }
        try:
            response = httpx.post(
                settings.routing_valhalla_url,
                json=payload,
                timeout=settings.request_timeout_seconds,
                headers={"User-Agent": "SaferPath/1.0"},
            )
            response.raise_for_status()
            result = response.json()
        except httpx.TimeoutException as exc:
            raise RoutingProviderError("timeout") from exc
        except httpx.HTTPError as exc:
            raise RoutingProviderError("unavailable") from exc

        trips = [result.get("trip", *())]
        trips.extend(item.get("trip") for item in result.get("alternates", []))
        routes: list[ProviderRoute] = []
        for sequence, trip in enumerate(trips[:3], start=1):
            if not isinstance(trip, dict) or not trip.get("legs"):
                continue
            coordinates: list[tuple[float, float]] = []
            for leg in trip["legs"]:
                shape = decode_shape(leg.get("shape", ""))
                if coordinates and shape and coordinates[-1] == shape[0]:
                    coordinates.extend(shape[1:])
                else:
                    coordinates.extend(shape)
            if len(coordinates) < 2:
                raise RoutingProviderError("invalid_response")
            summary = trip.get("summary", {})
            distance = max(1, round(float(summary.get("length", 0)) * 1000))
            duration = max(1, round(float(summary.get("time", 0))))
            route_coordinates = tuple(coordinates)
            routes.append(
                ProviderRoute(
                    reference=f"valhalla-{sequence}",
                    sequence=sequence,
                    coordinates=route_coordinates,
                    duration_seconds=duration,
                    distance_meters=distance,
                    segments=(ProviderSegment(1, route_coordinates, distance, duration),),
                    metadata={"provider": "Valhalla", "profile": "pedestrian"},
                )
            )
        if not routes:
            raise RoutingProviderError("no_route")
        return tuple(routes)