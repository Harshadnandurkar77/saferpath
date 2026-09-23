"""Tests for the geocoding proxy endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from starlette.testclient import TestClient


def test_geocoding_validation(client: TestClient):
    # Query too short (< 2 chars)
    resp = client.get("/v1/geocode/search?q=a")
    assert resp.status_code == 422

    # Query missing
    resp = client.get("/v1/geocode/search")
    assert resp.status_code == 422


def test_geocoding_success_mocked(client: TestClient):
    mock_nominatim_data = [
        {
            "display_name": "Shivaji Park, Dadar West, Mumbai, Maharashtra, 400028, India",
            "lat": "19.0269",
            "lon": "72.8373",
            "type": "park",
        },
        {
            "display_name": "Bandra Station, Bandra West, Mumbai, Maharashtra, India",
            "lat": "19.0544",
            "lon": "72.8402",
            "type": "station",
        },
    ]
    mock_maptiler_data = {
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "place_name": "Shivaji Park, Dadar West, Mumbai, Maharashtra, 400028, India",
                    "kind": "park"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [72.8373, 19.0269]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "place_name": "Bandra Station, Bandra West, Mumbai, Maharashtra, India",
                    "kind": "station"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [72.8402, 19.0544]
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_nominatim_data
    mock_resp.json.return_value = mock_maptiler_data
    mock_resp.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        resp = client.get("/v1/geocode/search?q=Shivaji+Park")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) == 2
        assert data["results"][0]["display_name"].startswith("Shivaji Park")
        assert data["results"][0]["latitude"] == 19.0269
        assert data["results"][0]["longitude"] == 72.8373
        assert data["results"][0]["place_type"] == "park"


def test_geocoding_upstream_error_handling(client: TestClient):
    with patch(
        "httpx.AsyncClient.get",
        side_effect=httpx.ConnectError("Connection failed"),
    ):
        resp = client.get("/v1/geocode/search?q=Test+Location")
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []

