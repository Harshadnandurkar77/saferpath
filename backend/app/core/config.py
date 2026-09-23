from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SaferPath API"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/v1"
    database_url: str
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    trusted_hosts: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1"]
    )
    log_level: str = "INFO"
    request_timeout_seconds: int = 30
    rate_limit_default: str = "100/minute"
    demo_mode: bool = False
    max_request_body_bytes: int = 1_048_576
    routing_geometry_max_points: int = 1_000
    routing_retention_days: int = 7
    routing_provider: str = "fixture"
    routing_osrm_url: str = "https://router.project-osrm.org"
    routing_osrm_profile: str = "driving"
    report_retention_days: int = 30
    report_stale_hours: int = 24
    report_cluster_minutes: int = 30
    report_spatial_association_meters: int = 150
    evidence_max_bytes: int = 10_485_760
    evidence_upload_authorization_minutes: int = 10
    evidence_retention_days: int = 30
    help_point_nearby_max_radius_meters: int = 5_000
    help_point_association_meters: int = 150
    help_point_stale_days: int = 30
    trip_retention_days: int = 7
    trip_deviation_meters: int = 75
    trip_checkin_prompt_minutes_before_arrival: int = 10
    trip_checkin_grace_minutes: int = 10
    trip_stream_replay_limit: int = 50
    trip_stale_minutes: int = 15
    fixture_pilot_min_longitude: float = 72.75
    fixture_pilot_max_longitude: float = 72.95
    fixture_pilot_min_latitude: float = 18.9
    fixture_pilot_max_latitude: float = 19.15
    osm_import_enabled: bool = True
    osm_overpass_url: str = "https://overpass-api.de/api/interpreter"
    osm_pilot_bbox: str = "18.85,72.75,19.35,73.15"
    osm_import_timeout_seconds: int = 60
    osm_import_max_features: int = 50_000
    weather_provider: str = "fixture"
    open_meteo_base_url: str = "https://api.open-meteo.com"
    spatial_distance_street_lamp_meters: int = 30
    spatial_distance_activity_meters: int = 75
    spatial_distance_transit_meters: int = 150
    spatial_distance_default_meters: int = 30
    trusted_contact_verification_timeout_minutes: int = 60
    sharing_grant_default_ttl_hours: int = 24
    sharing_grant_max_ttl_hours: int = 168
    deviation_confirmation_timeout_minutes: int = 15
    deviation_notification_retry_limit: int = 3
    alternate_route_evaluation_timeout_seconds: int = 30
    emergency_handoff_ttl_minutes: int = 60
    emergency_handoff_retention_days: int = 30
    analytics_retention_days: int = 30
    analytics_subject_secret: str = "development-only-change-me"
    analytics_admin_token: str = ""
    analytics_minimum_count: int = 3
    auth_secret: str = "development-only-auth-secret-change-me"
    auth_code_ttl_minutes: int = 10
    auth_code_max_attempts: int = 5
    auth_code_resend_cooldown_seconds: int = 60
    session_ttl_hours: int = 24
    rate_limit_backend: str = "local"
    rate_limit_redis_url: str = ""
    multi_instance: bool = False
    production_secret_min_length: int = 32

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if isinstance(value, str) and value.lower() in {"release", "production"}:
            return False
        return value

    @field_validator("cors_origins", "trusted_hosts", mode="before")
    @classmethod
    def split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def production_safety_gate(self) -> "Settings":
        """Prevent fixtures, debug configuration, and placeholder secrets in production."""
        if self.app_env.lower() not in {"production", "release"}:
            return self
        if self.debug or self.demo_mode:
            raise ValueError("production cannot enable debug or demo mode")
        if self.weather_provider == "fixture":
            raise ValueError("production cannot use fixture weather")
        if not self.cors_origins or any(not item.startswith("https://") for item in self.cors_origins):
            raise ValueError("production requires explicit HTTPS CORS origins")
        if any(host in {"*", "localhost", "127.0.0.1"} for host in self.trusted_hosts):
            raise ValueError("production requires non-local explicit trusted hosts")
        if len(self.analytics_subject_secret) < self.production_secret_min_length or self.analytics_subject_secret == "development-only-change-me":
            raise ValueError("production requires a high-entropy analytics subject secret")
        if len(self.analytics_admin_token) < self.production_secret_min_length:
            raise ValueError("production requires a high-entropy analytics admin token")
        if len(self.auth_secret) < self.production_secret_min_length or self.auth_secret == "development-only-auth-secret-change-me":
            raise ValueError("production requires a high-entropy auth secret")
        if self.multi_instance and (self.rate_limit_backend != "redis" or not self.rate_limit_redis_url):
            raise ValueError("multi-instance production requires Redis rate limiting")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
