"""Integration tests — mapped to the Project Plan §7 (IT-01 .. IT-07)."""
from pathlib import Path

import numpy as np
import pytest
from PIL import Image as PILImage

from trashtrack.detection import StubDetector
from trashtrack.geolocation import geolocate
from trashtrack.ingestion import load_image_file
from trashtrack.pipeline import TrashTrackPipeline
from trashtrack.reporting import InProcessCivicRouter, build_report
from trashtrack.schema import ImageSource, ReportStatus


@pytest.fixture
def sample_image(tmp_path) -> Path:
    p = tmp_path / "street.jpg"
    PILImage.fromarray((np.ones((120, 160, 3)) * 128).astype("uint8")).save(p)
    return p


# IT-01: Ingestion -> Detection. Ingested image feeds the detector.
def test_it01_ingestion_to_detection(sample_image):
    image, array = load_image_file(sample_image)
    assert array.shape == (120, 160, 3)
    dets = StubDetector().detect(image, array)
    assert dets and dets[0].image_id == image.image_id


# IT-02: Detection -> Geolocation. Each detection carries bbox + (lat, lon).
def test_it02_detection_to_geolocation(sample_image):
    image, array = load_image_file(sample_image)
    dets = geolocate(StubDetector().detect(image, array), sample_image)
    assert all(d.latitude is not None and d.geo_source is not None for d in dets)


# IT-04: Detection -> Reporting. Schema-valid report with class/conf/time/loc.
def test_it04_detection_to_report(sample_image):
    image, array = load_image_file(sample_image)
    dets = geolocate(StubDetector().detect(image, array), sample_image)
    r = build_report(dets[0])
    assert r.detection_id == dets[0].detection_id and r.latitude is not None


# IT-05 + IT-07: Reporting -> civic; status advances generated->submitted->ack.
def test_it05_it07_report_routing_and_status(sample_image):
    image, array = load_image_file(sample_image)
    dets = geolocate(StubDetector().detect(image, array), sample_image)
    router = InProcessCivicRouter()
    r = router.submit(build_report(dets[0]))
    assert r.status == ReportStatus.acknowledged and r.civic_ack_id


# IT-06: full closed loop, traceable by linked ids.
def test_it06_full_closed_loop(sample_image, monkeypatch):
    monkeypatch.setenv("TT_DETECTOR", "stub")
    pipe = TrashTrackPipeline(detector=StubDetector(), route_to_civic=False)
    result = pipe.process_file(str(sample_image), source=ImageSource.upload)
    assert result.detections and result.reports
    # trace: image -> detection -> report
    det = result.detections[0]
    rep = result.reports[0]
    assert det.image_id == result.image.image_id
    assert rep.detection_id == det.detection_id
