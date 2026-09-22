import re
import time
import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.context import router as context_router
from app.api.v1.diagnostics import router as diagnostics_router
from app.api.v1.geocoding import router as geocoding_router
from app.api.v1.health import router as health_router
from app.api.v1.help_points import router as help_points_router
from app.api.v1.reports import router as reports_router
from app.api.v1.routing import router as routing_router
from app.api.v1.trips import router as trips_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.metrics import metrics
from app.schemas.errors import ErrorEnvelope

settings = get_settings()
configure_logging(settings.log_level)
logger = structlog.get_logger(__name__)
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])
request_id_pattern = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")


def request_id_from(request: Request) -> str:
    candidate = request.headers.get("X-Request-ID", "")
    return candidate if request_id_pattern.fullmatch(candidate) else str(uuid.uuid4())


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request_id_from(request)
        request.state.request_id = request_id
        started = time.perf_counter()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response = await call_next(request)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            route = request.scope.get("route")
            route_template = getattr(route, "path", "unmatched")
            status_code = getattr(locals().get("response"), "status_code", 500)
            logger.info(
                "request_complete",
                method=request.method,
                route=route_template,
                status=status_code,
                duration_ms=duration_ms,
            )
            metrics.increment(
                "http_requests_total",
                {
                    "method": request.method,
                    "route": route_template,
                    "status_class": f"{status_code // 100}xx",
                },
            )
            structlog.contextvars.clear_contextvars()
        response.headers["X-Request-ID"] = request_id
        return response


class RequestSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > settings.max_request_body_bytes):
            return JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "PAYLOAD_TOO_LARGE",
                        "message": "Request body is too large.",
                        "request_id": request.state.request_id,
                    }
                },
            )
        return await call_next(request)


def error_response(
    request: Request, status_code: int, code: str, message: str, details=None
) -> JSONResponse:
    body = ErrorEnvelope(
        error={
            "code": code,
            "message": message,
            "request_id": request.state.request_id,
            "details": details,
        }
    ).model_dump(exclude_none=True)
    return JSONResponse(status_code=status_code, content=body)


app = FastAPI(title=settings.app_name, version="0.1.0", debug=False)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Request-ID", "X-Analytics-Admin", "X-Subject-Reference"],
)
app.add_middleware(RequestSizeMiddleware)
app.add_middleware(RequestContextMiddleware)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = [
        {"field": ".".join(str(item) for item in error["loc"]), "message": error["msg"]}
        for error in exc.errors()
    ]
    return error_response(request, 422, "VALIDATION_ERROR", "Request validation failed.", details)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Request could not be completed."
    code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
    return error_response(request, exc.status_code, code, message)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_exception", exception_type=type(exc).__name__)
    return error_response(request, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.")


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "ok"}


app.include_router(health_router, prefix=settings.api_v1_prefix)
app.include_router(help_points_router, prefix=settings.api_v1_prefix)
app.include_router(diagnostics_router, prefix=settings.api_v1_prefix)
app.include_router(context_router, prefix=settings.api_v1_prefix)
app.include_router(routing_router, prefix=settings.api_v1_prefix)
app.include_router(reports_router, prefix=settings.api_v1_prefix)
app.include_router(trips_router, prefix=settings.api_v1_prefix)
app.include_router(analytics_router, prefix=settings.api_v1_prefix)
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(geocoding_router, prefix=settings.api_v1_prefix)
