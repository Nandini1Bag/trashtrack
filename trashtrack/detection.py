"""
C2 -- Detection.

Detect litter and emit bounding boxes + confidence as `Detection` records.

The detector is pluggable so the pipeline and tests do not hard-depend on a
GPU or on torch being installed:

    * YoloDetector  -- real ultralytics YOLOv8 backend (baseline or fine-tuned).
    * StubDetector  -- deterministic fake, used in unit/integration tests.

Validated by: UT-04, UT-05, ST-01, and the §12 baseline experiment.
"""
from __future__ import annotations

from typing import List, Protocol

import numpy as np

from .config import settings
from .schema import Detection, Image


class Detector(Protocol):
    def detect(self, image: Image, array: np.ndarray) -> List[Detection]: ...


def apply_confidence_threshold(dets: List[Detection], threshold: float) -> List[Detection]:
    """UT-02: a stricter threshold keeps fewer-or-equal detections."""
    return [d for d in dets if d.confidence >= threshold]


class StubDetector:
    """Deterministic detector for tests. Emits one centered box unless the
    array is entirely zero (an 'empty'/no-litter image -> no detections)."""

    def __init__(self, confidence: float = 0.9, class_label: str = "litter"):
        self.confidence = confidence
        self.class_label = class_label

    def detect(self, image: Image, array: np.ndarray) -> List[Detection]:
        if array.size == 0 or not array.any():
            return []
        w, h = image.width, image.height
        return [Detection(
            image_id=image.image_id,
            class_label=self.class_label,
            confidence=self.confidence,
            bbox_x=w // 4, bbox_y=h // 4, bbox_w=w // 2, bbox_h=h // 2,
        )]


class YoloDetector:
    """Ultralytics YOLOv8 backend. Lazy-imports so the package imports cleanly
    without torch installed. Point `weights` at your fine-tuned checkpoint
    (P2 deliverable) to move past the baseline."""

    def __init__(self, weights: str | None = None, confidence: float | None = None,
                 litter_only: bool = False):
        self.weights = weights or settings.model_weights
        self.confidence = confidence if confidence is not None else settings.confidence_threshold
        self.litter_only = litter_only
        self._model = None

    def _lazy_model(self):
        if self._model is None:
            from ultralytics import YOLO  # imported here on purpose
            self._model = YOLO(self.weights)
        return self._model

    def detect(self, image: Image, array: np.ndarray) -> List[Detection]:
        model = self._lazy_model()
        results = model.predict(array, conf=self.confidence, verbose=False)
        out: List[Detection] = []
        for r in results:
            names = r.names
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cls_id = int(box.cls[0])
                label = names.get(cls_id, str(cls_id))
                if self.litter_only and label == "litter":
                    label = "litter"
                out.append(Detection(
                    image_id=image.image_id,
                    class_label=label,
                    confidence=float(box.conf[0]),
                    bbox_x=int(x1), bbox_y=int(y1),
                    bbox_w=max(1, int(x2 - x1)), bbox_h=max(1, int(y2 - y1)),
                ))
        return out


def get_detector() -> Detector:
    """Factory honoring TT_DETECTOR ('yolo' | 'stub')."""
    if settings.detector_backend == "stub":
        return StubDetector()
    return YoloDetector()
