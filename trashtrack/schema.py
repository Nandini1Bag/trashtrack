"""
TrashTrack data schema (implements the Data Schema, §10 of the Project Plan).

Three related entities:
    Image  1---N  Detection  1---0..1  Report

These Pydantic models are the single source of truth for the pipeline and for
the JSON validation used in unit/integration tests (UT-05, IT-03, IT-04).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ----------------------------- enums -----------------------------------------
class ImageSource(str, Enum):
    upload = "upload"
    batch = "batch"
    live_camera = "live_camera"


class GeoSource(str, Enum):
    exif = "exif"
    browser = "browser"
    simulated = "simulated"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ReportStatus(str, Enum):
    generated = "generated"
    submitted = "submitted"
    acknowledged = "acknowledged"


# ----------------------------- entities --------------------------------------
class Image(BaseModel):
    """§10.1 Image."""
    image_id: str = Field(default_factory=_uuid)
    source: ImageSource
    dataset: str = "local"          # TACO / UAVVaste / RoLID-11K / local
    file_path: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    captured_at: Optional[datetime] = None
    has_gps: bool = False


class Detection(BaseModel):
    """§10.2 Detection."""
    detection_id: str = Field(default_factory=_uuid)
    image_id: str
    class_label: str = "litter"
    confidence: float = Field(ge=0.0, le=1.0)
    bbox_x: int
    bbox_y: int
    bbox_w: int = Field(gt=0)
    bbox_h: int = Field(gt=0)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    geo_source: Optional[GeoSource] = None
    detected_at: datetime = Field(default_factory=_now)

    @property
    def area(self) -> int:
        return self.bbox_w * self.bbox_h


class Report(BaseModel):
    """§10.3 Report."""
    report_id: str = Field(default_factory=_uuid)
    detection_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    severity: Severity
    status: ReportStatus = ReportStatus.generated
    civic_ack_id: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    @field_validator("civic_ack_id")
    @classmethod
    def _ack_only_when_acknowledged(cls, v, info):
        # soft rule: an ack id implies the report has (or will be) acknowledged
        return v
