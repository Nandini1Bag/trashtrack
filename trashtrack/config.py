"""Central configuration. Override via environment variables or a .env file."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # detection
    model_weights: str = os.getenv("TT_MODEL_WEIGHTS", "yolov8n.pt")
    confidence_threshold: float = float(os.getenv("TT_CONF_THRESHOLD", "0.25"))
    detector_backend: str = os.getenv("TT_DETECTOR", "yolo")  # "yolo" | "stub"

    # geolocation fallback (used when EXIF GPS is missing) -- Bengaluru default,
    # matching the coordinates in the PDF's sample TACO-derived record.
    fallback_lat: float = float(os.getenv("TT_FALLBACK_LAT", "12.9716"))
    fallback_lon: float = float(os.getenv("TT_FALLBACK_LON", "77.5946"))

    # civic endpoint
    civic_endpoint: str = os.getenv("TT_CIVIC_ENDPOINT", "http://127.0.0.1:8001/reports")
    civic_timeout_s: float = float(os.getenv("TT_CIVIC_TIMEOUT", "5.0"))

    # storage
    storage_dir: str = os.getenv("TT_STORAGE_DIR", "./storage")


settings = Settings()
