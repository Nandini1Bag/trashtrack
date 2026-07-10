"""
Privacy controls for TrashTrack.

Addresses professor feedback on geospatial privacy:
  1. Coordinate coarsening — round lat/lon to configurable precision before
     sending to civic endpoints (~100m at 3 decimal places).
  2. Evidence thumbnails — crop to the bounding-box region only, avoiding
     incidental capture of bystanders, vehicles, or private property.
"""
from __future__ import annotations

import io
from typing import Optional

import numpy as np
from PIL import Image as PILImage

from .schema import Detection, Report


def coarsen_coordinates(lat: float, lon: float, decimals: int = 3) -> tuple[float, float]:
    """Round coordinates to `decimals` decimal places.

    Precision reference:
        4 decimals ≈ 11m
        3 decimals ≈ 111m
        2 decimals ≈ 1.1km

    Default (3) gives ~100m precision — enough for a cleanup crew to find
    the site without enabling precise tracking of individuals.
    """
    return round(lat, decimals), round(lon, decimals)


def coarsen_report(report: Report, decimals: int = 3) -> Report:
    """Apply coordinate coarsening to a report before civic submission."""
    if report.latitude is not None and report.longitude is not None:
        report.latitude, report.longitude = coarsen_coordinates(
            report.latitude, report.longitude, decimals
        )
    return report


def crop_evidence_thumbnail(
    image_array: np.ndarray,
    detection: Detection,
    padding_pct: float = 0.15,
    max_size: tuple[int, int] = (320, 320),
) -> bytes:
    """Crop the bounding-box region from the image as a JPEG thumbnail.

    Adds `padding_pct` around the bbox for context, then resizes to fit
    within `max_size`. Returns JPEG bytes — no full original image is
    stored or transmitted.
    """
    h, w = image_array.shape[:2]
    pad_x = int(detection.bbox_w * padding_pct)
    pad_y = int(detection.bbox_h * padding_pct)

    x1 = max(0, detection.bbox_x - pad_x)
    y1 = max(0, detection.bbox_y - pad_y)
    x2 = min(w, detection.bbox_x + detection.bbox_w + pad_x)
    y2 = min(h, detection.bbox_y + detection.bbox_h + pad_y)

    crop = image_array[y1:y2, x1:x2]
    pil = PILImage.fromarray(crop)
    pil.thumbnail(max_size, PILImage.LANCZOS)

    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=80)
    return buf.getvalue()
