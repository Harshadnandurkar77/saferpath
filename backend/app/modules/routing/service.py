import hashlib
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.routing import Route, RouteRequest, RouteSegment
from app.modules.routing.errors import RoutingFailure
from app.modules.routing.fixture import FixtureRoutingProvider
from app.modules.routing.normalization import RouteNormalizationError, normalize_route
from app.modules.routing.osrm import OsrmRoutingProvider
from app.modules.routing.provider import ProviderRouteRequest, RoutingProvider, RoutingProviderError
from app.modules.routing.schemas import (
    RouteComparisonRequest,
    RouteComparisonResponse,
    RouteResponse,
    SegmentResponse,
)
from app.modules.routing.valhalla import ValhallaRoutingProvider


def _wkt(coordinates: tuple[tuple[float, float], ...]) -> str:
    return "LINESTRING(" + ",".join(f"{lon} {lat}" for lon, lat in coordinates) + ")"


def _point_wkt(longitude: float, latitude: float) -> str:
    return f"POINT({longitude} {latitude})"


class RouteComparisonService:
    def __init__(self, provider: RoutingProvider | None = None) -> None:
        if provider is not None:
            self.provider = provider
        elif get_settings().routing_provider.lower() == "fixture":
            self.provider = FixtureRoutingProvider()
        elif get_settings().routing_provider.lower() == "valhalla":
            self.provider = ValhallaRoutingProvider()
        else:
            self.provider = OsrmRoutingProvider()

    def create(self, db: Session, payload: RouteComparisonRequest) -> RouteComparisonResponse:
        existing = db.scalar(
            select(RouteRequest)
            .where(RouteRequest.idempotency_key == payload.idempotency_key)
            .options(selectinload(RouteRequest.routes).selectinload(Route.segments))
        )
        if existing:
            if (
                existing.session_id != payload.session_id
                or existing.request_fingerprint != self._fingerprint(payload)
            ):
                raise RoutingFailure("idempotency_conflict")
            return self._response(db, existing, True)
        try:
            raw_routes = self.provider.routes(
                ProviderRouteRequest(
                    (payload.origin.longitude, payload.origin.latitude),
                    (payload.destination.longitude, payload.destination.latitude),
                    payload.travel_mode,
                )
            )
            normalized_routes = tuple(normalize_route(route) for route in raw_routes)
        except RoutingFailure:
            raise
        except RoutingProviderError as exc:
            categories = {
                "timeout": "timeout",
                "unavailable": "unavailable",
                "no_route": "no_route",
            }
            raise RoutingFailure(categories.get(exc.category, "malformed_response")) from exc
        except RouteNormalizationError as exc:
            raise RoutingFailure("malformed_response") from exc
        if not 1 <= len(normalized_routes) <= 3:
            raise RoutingFailure("malformed_response")
        settings = get_settings()
        request = RouteRequest(
            session_id=payload.session_id,
            origin=func.ST_GeomFromText(
                _point_wkt(payload.origin.longitude, payload.origin.latitude), 4326
            ),
            destination=func.ST_GeomFromText(
                _point_wkt(payload.destination.longitude, payload.destination.latitude), 4326
            ),
            timezone=payload.timezone,
            requested_local_time=payload.requested_local_time,
            time_mode=payload.time_mode,
            travel_mode=payload.travel_mode,
            route_preference=payload.route_preference,
            idempotency_key=payload.idempotency_key,
            request_fingerprint=self._fingerprint(payload),
            expires_at=datetime.now(UTC) + timedelta(days=settings.routing_retention_days),
        )
        db.add(request)
        try:
            db.flush()
            for normalized in normalized_routes:
                route = Route(
                    route_request_id=request.id,
                    provider=self.provider.name,
                    provider_route_ref=normalized.reference,
                    sequence=normalized.sequence,
                    duration_seconds=normalized.duration_seconds,
                    distance_meters=normalized.distance_meters,
                    geometry=func.ST_GeomFromText(_wkt(normalized.coordinates), 4326),
                    provider_metadata=normalized.metadata,
                )
                db.add(route)
                db.flush()
                for segment in normalized.segments:
                    db.add(
                        RouteSegment(
                            route_id=route.id,
                            canonical_id=segment.canonical_id,
                            sequence=segment.sequence,
                            geometry=func.ST_GeomFromText(_wkt(segment.coordinates), 4326),
                            length_meters=segment.length_meters,
                            travel_seconds=segment.travel_seconds,
                        )
                    )
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.scalar(
                select(RouteRequest)
                .where(RouteRequest.idempotency_key == payload.idempotency_key)
                .options(selectinload(RouteRequest.routes).selectinload(Route.segments))
            )
            if existing:
                if (
                    existing.session_id != payload.session_id
                    or existing.request_fingerprint != self._fingerprint(payload)
                ):
                    raise RoutingFailure("idempotency_conflict") from None
                return self._response(db, existing, True)
            raise RoutingFailure("persistence") from None
        except Exception as exc:
            db.rollback()
            raise RoutingFailure("persistence") from exc
        db.refresh(request, ["routes"])
        for route in request.routes:
            db.refresh(route, ["segments"])
        return self._response(db, request, False)

    @staticmethod
    def _fingerprint(payload: RouteComparisonRequest) -> str:
        values = {
            "origin": [round(payload.origin.longitude, 6), round(payload.origin.latitude, 6)],
            "destination": [
                round(payload.destination.longitude, 6),
                round(payload.destination.latitude, 6),
            ],
            "timezone": payload.timezone,
            "requested_local_time": payload.requested_local_time.isoformat(),
            "time_mode": payload.time_mode,
            "travel_mode": payload.travel_mode,
            "route_preference": payload.route_preference,
            "session_id": payload.session_id,
        }
        return hashlib.sha256(
            json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    def _response(
        self, db: Session, request: RouteRequest, reused: bool
    ) -> RouteComparisonResponse:
        # Query textual GeoJSON at the persistence boundary.  This keeps models provider-neutral.
        routes = []
        for route in sorted(request.routes, key=lambda item: item.sequence):
            route_coords = self._read_geometry(db, Route.geometry, route.id)
            segments = [
                SegmentResponse(
                    id=segment.canonical_id,
                    sequence=segment.sequence,
                    geometry=self._read_geometry(db, RouteSegment.geometry, segment.id),
                    length_meters=segment.length_meters,
                    travel_seconds=segment.travel_seconds,
                )
                for segment in sorted(route.segments, key=lambda item: item.sequence)
            ]
            routes.append(
                RouteResponse(
                    id=str(route.id),
                    sequence=route.sequence,
                    provider=route.provider,
                    provider_metadata=route.provider_metadata,
                    duration_seconds=route.duration_seconds,
                    distance_meters=route.distance_meters,
                    geometry=route_coords,
                    segments=segments,
                )
            )
        return RouteComparisonResponse(
            request_id=str(request.id),
            reused=reused,
            expires_at=request.expires_at,
            timezone=request.timezone,
            requested_local_time=request.requested_local_time,
            time_mode=request.time_mode,
            travel_mode=request.travel_mode,
            route_preference=request.route_preference,
            provider_source=self.provider.name,
            routes=routes,
        )

    def get_route(self, db: Session, route_id: str) -> RouteResponse:
        import uuid

        try:
            r_uuid = uuid.UUID(route_id)
        except ValueError:
            raise RoutingFailure("route_not_found") from None
        route = db.get(Route, r_uuid)
        if not route:
            raise RoutingFailure("route_not_found")
        route_coords = self._read_geometry(db, Route.geometry, route.id)
        segments = [
            SegmentResponse(
                id=segment.canonical_id,
                sequence=segment.sequence,
                geometry=self._read_geometry(db, RouteSegment.geometry, segment.id),
                length_meters=segment.length_meters,
                travel_seconds=segment.travel_seconds,
            )
            for segment in sorted(route.segments, key=lambda item: item.sequence)
        ]
        return RouteResponse(
            id=str(route.id),
            sequence=route.sequence,
            provider=route.provider,
            provider_metadata=route.provider_metadata,
            duration_seconds=route.duration_seconds,
            distance_meters=route.distance_meters,
            geometry=route_coords,
            segments=segments,
        )

    @staticmethod
    def _read_geometry(db: Session, column: object, identity: object) -> list[list[float]]:
        model = Route if column is Route.geometry else RouteSegment
        value = db.scalar(select(func.ST_AsGeoJSON(column)).where(model.id == identity))
        return json.loads(value)["coordinates"]
