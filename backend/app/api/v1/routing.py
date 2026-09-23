from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_transactional_db
from app.modules.routing.errors import FAILURE_RESPONSES, RoutingFailure
from app.modules.routing.schemas import (
    RouteComparisonRequest,
    RouteComparisonResponse,
    RouteResponse,
)
from app.modules.routing.service import RouteComparisonService
from app.schemas.errors import ErrorEnvelope

router = APIRouter(tags=["routing"])
service = RouteComparisonService()


@router.post(
    "/routes/compare",
    response_model=RouteComparisonResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "Idempotency key conflict"},
        422: {"description": "Invalid request or outside pilot area"},
        502: {"description": "Malformed routing provider response"},
        503: {"description": "Routing provider unavailable"},
        504: {"description": "Routing provider timeout"},
    },
)
def create_route_request(
    request: Request, payload: RouteComparisonRequest, db: Session = Depends(get_transactional_db)
) -> RouteComparisonResponse | JSONResponse:
    try:
        return service.create(db, payload)
    except RoutingFailure as exc:
        status_code, code, message = FAILURE_RESPONSES.get(
            exc.category, (500, "ROUTING_INTERNAL_ERROR", "Routing could not be completed.")
        )
        body = ErrorEnvelope(
            error={"code": code, "message": message, "request_id": request.state.request_id}
        ).model_dump(exclude_none=True)
        return JSONResponse(status_code=status_code, content=body)


@router.get(
    "/routes/{route_id}",
    response_model=RouteResponse,
    responses={
        404: {"description": "Route was not found"},
    },
)
def get_route(
    route_id: str, request: Request, db: Session = Depends(get_transactional_db)
) -> RouteResponse | JSONResponse:
    try:
        return service.get_route(db, route_id)
    except RoutingFailure as exc:
        status_code, code, message = FAILURE_RESPONSES.get(
            exc.category, (404, "ROUTE_NOT_FOUND", "Route was not found.")
        )
        body = ErrorEnvelope(
            error={"code": code, "message": message, "request_id": request.state.request_id}
        ).model_dump(exclude_none=True)
        return JSONResponse(status_code=status_code, content=body)

