"""Tests for privacy controls and quantifiable success thresholds."""
import numpy as np
import pytest

from trashtrack.privacy import coarsen_coordinates, coarsen_report, crop_evidence_thumbnail
from trashtrack.schema import Detection, Report, Severity, ReportStatus


# ---------- Privacy: coordinate coarsening ----------

def test_coarsen_3_decimals():
    lat, lon = coarsen_coordinates(12.97165432, 77.59462189, decimals=3)
    assert lat == 12.972
    assert lon == 77.595


def test_coarsen_report_applies_to_report():
    r = Report(detection_id="d1", latitude=37.33467891, longitude=-121.89012345,
               severity=Severity.high)
    r = coarsen_report(r, decimals=3)
    assert r.latitude == 37.335
    assert r.longitude == -121.890


# ---------- Privacy: evidence thumbnail ----------

def test_crop_evidence_returns_jpeg_bytes():
    arr = (np.ones((480, 640, 3)) * 128).astype("uint8")
    det = Detection(image_id="i", class_label="litter", confidence=0.9,
                    bbox_x=100, bbox_y=100, bbox_w=50, bbox_h=50)
    jpg = crop_evidence_thumbnail(arr, det)
    assert isinstance(jpg, bytes)
    assert jpg[:2] == b'\xff\xd8'  # JPEG magic bytes


def test_crop_evidence_respects_max_size():
    arr = (np.ones((2000, 3000, 3)) * 128).astype("uint8")
    det = Detection(image_id="i", class_label="litter", confidence=0.9,
                    bbox_x=500, bbox_y=500, bbox_w=1000, bbox_h=800)
    jpg = crop_evidence_thumbnail(arr, det, max_size=(320, 320))
    from PIL import Image as PILImage
    import io
    thumb = PILImage.open(io.BytesIO(jpg))
    assert thumb.width <= 320 and thumb.height <= 320


# ---------- Quantifiable success thresholds (constants) ----------
# These are the professor-requested thresholds. They live here so the team
# can assert against them in the evaluation scripts (ST-04, ST-05, ST-06).

THRESHOLDS = {
    # Detection performance (ST-04)
    "map50_taco": 0.45,
    "map50_uavvaste": 0.35,
    "map50_rolid11k": 0.30,
    "precision_at_conf50": 0.70,
    "recall_at_conf25": 0.50,

    # System performance (ST-05, ST-06)
    "latency_cpu_seconds": 3.0,
    "latency_gpu_seconds": 0.5,
    "batch_50_cpu_minutes": 3.0,

    # Geotagging
    "exif_extraction_accuracy": 1.0,
    "browser_geo_accuracy_meters": 100,
    "fallback_flagged_rate": 1.0,

    # UAT
    "uat01_task_success_rate": 0.80,
    "uat03_report_rating_min": 3.5,
    "uat04_live_camera_rating_min": 3.0,
    "uat05_usefulness_agree_rate": 0.70,
}


def test_thresholds_are_defined():
    """Sanity check that all thresholds exist and are positive."""
    assert len(THRESHOLDS) == 15
    assert all(v > 0 for v in THRESHOLDS.values())
