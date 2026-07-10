"""Unit tests — mapped to the Project Plan §6 (UT-01 .. UT-06)."""
import numpy as np
import pytest

from trashtrack.detection import StubDetector, apply_confidence_threshold
from trashtrack.reporting import assign_severity, build_report
from trashtrack.schema import Detection, Image, ImageSource, GeoSource, Severity


def _img():
    return Image(source=ImageSource.upload, file_path="x.jpg", width=100, height=100)


def _det(conf=0.9, label="litter"):
    return Detection(image_id="i", class_label=label, confidence=conf,
                     bbox_x=1, bbox_y=1, bbox_w=10, bbox_h=10)


# UT-01: loader reads a valid image -> array. (see test_integration for file IO)
def test_ut01_stub_detector_returns_array_backed_detection():
    img = _img()
    arr = np.ones((100, 100, 3), dtype=np.uint8)
    dets = StubDetector().detect(img, arr)
    assert len(dets) == 1 and dets[0].image_id == img.image_id


# UT-02: stricter threshold keeps fewer-or-equal detections.
def test_ut02_confidence_threshold_monotonic():
    dets = [_det(0.2), _det(0.6), _det(0.95)]
    assert len(apply_confidence_threshold(dets, 0.5)) == 2
    assert len(apply_confidence_threshold(dets, 0.9)) == 1
    assert len(apply_confidence_threshold(dets, 0.5)) >= len(apply_confidence_threshold(dets, 0.9))


# UT-04: empty image -> no detections (no-litter case)
def test_ut04_no_litter_image_yields_zero_detections():
    img = _img()
    empty = np.zeros((100, 100, 3), dtype=np.uint8)
    assert StubDetector().detect(img, empty) == []


# UT-05: report is schema-valid and carries location + class + confidence.
def test_ut05_report_schema_valid():
    d = _det(0.9)
    d.latitude, d.longitude, d.geo_source = 12.97, 77.59, GeoSource.simulated
    r = build_report(d)
    dumped = r.model_dump(mode="json")
    assert dumped["detection_id"] == d.detection_id
    assert dumped["latitude"] == 12.97 and dumped["severity"] in {"low", "medium", "high"}


# UT-06: severity rule maps confidence/class correctly.
@pytest.mark.parametrize("conf,label,expected", [
    (0.95, "litter", Severity.high),
    (0.65, "litter", Severity.medium),
    (0.30, "litter", Severity.low),
    (0.30, "broken glass", Severity.medium),  # hazardous escalation
])
def test_ut06_severity_rule(conf, label, expected):
    assert assign_severity(_det(conf, label)) == expected
