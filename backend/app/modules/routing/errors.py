class RoutingFailure(Exception):
    """A categorized failure safe to map at the API boundary."""

    def __init__(self, category: str) -> None:
        self.category = category
        super().__init__(category)


FAILURE_RESPONSES = {
    "invalid_request": (422, "ROUTE_REQUEST_INVALID", "Route request is invalid."),
    "unsupported_mode": (422, "TRAVEL_MODE_UNSUPPORTED", "Travel mode is not supported."),
    "outside_pilot": (422, "PILOT_AREA_UNSUPPORTED", "This journey is outside the pilot area."),
    "unavailable": (503, "ROUTING_UNAVAILABLE", "Routing is temporarily unavailable."),
    "timeout": (504, "ROUTING_TIMEOUT", "Routing timed out. Please try again."),
    "malformed_response": (
        502,
        "ROUTING_RESPONSE_INVALID",
        "Routing returned an invalid response.",
    ),
    "no_route": (422, "NO_ROUTE_AVAILABLE", "No route is available for this journey."),
    "idempotency_conflict": (
        409,
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key was used for a different request.",
    ),
    "route_not_found": (404, "ROUTE_NOT_FOUND", "Route was not found."),
    "persistence": (500, "ROUTING_PERSISTENCE_FAILED", "Route request could not be saved."),
}
