import pytest
from fastapi.testclient import TestClient

from app.api.v1.routing import service as routing_service
from app.core.config import get_settings
from app.main import app
from app.modules.routing.fixture import FixtureRoutingProvider


@pytest.fixture(autouse=True)
def deterministic_routing_provider():
    """Keep API tests isolated from the development OSRM network provider."""
    original = routing_service.provider
    original_setting = get_settings().routing_provider
    get_settings().routing_provider = "fixture"
    routing_service.provider = FixtureRoutingProvider()
    yield
    routing_service.provider = original
    get_settings().routing_provider = original_setting


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, headers={"Host": "localhost"})
