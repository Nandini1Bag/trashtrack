"""
Closed-loop orchestrator: Image -> detection -> geolocation -> report -> civic.

Ties C1..C5 into one traceable loop (IT-06, ST-01). Every record is linked by
id (image_id -> detection_id -> report_id) so a result can be traced end to end.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from .detection import Detector, apply_confidence_threshold, get_detector
from .geolocation import geolocate
from .ingestion import load_image_file
from .reporting import CivicRouter, InProcessCivicRouter, build_report
from .schema import Detection, Image, ImageSource, Report


@dataclass
class PipelineResult:
    image: Image
    detections: List[Detection] = field(default_factory=list)
    reports: List[Report] = field(default_factory=list)


class TrashTrackPipeline:
    def __init__(self, detector: Optional[Detector] = None, router=None,
                 confidence_threshold: float = 0.25, route_to_civic: bool = True):
        self.detector = detector or get_detector()
        self.router = router or (CivicRouter() if route_to_civic else InProcessCivicRouter())
        self.confidence_threshold = confidence_threshold
        self.route_to_civic = route_to_civic

    def process_file(self, path: str, source: ImageSource = ImageSource.upload,
                     dataset: str = "local",
                     browser_coords=None) -> PipelineResult:
        image, array = load_image_file(path, source=source, dataset=dataset)
        return self.process(image, array, image_path=path, browser_coords=browser_coords)

    def process(self, image: Image, array, image_path: str,
                browser_coords=None) -> PipelineResult:
        # C2
        dets = self.detector.detect(image, array)
        dets = apply_confidence_threshold(dets, self.confidence_threshold)
        # C3
        dets = geolocate(dets, image_path, browser_coords=browser_coords)
        image.has_gps = any(d.geo_source and d.geo_source.value == "exif" for d in dets)
        # C5
        reports: List[Report] = []
        for d in dets:
            r = build_report(d)
            if self.route_to_civic:
                r = self.router.submit(r)
            reports.append(r)
        return PipelineResult(image=image, detections=dets, reports=reports)
