"""
C3 -- Geolocation.

Extract GPS from EXIF; fall back to simulated coordinates when absent, and
record provenance in `geo_source` so evaluation stays transparent (§10.4).

Validated by: UT-03 (EXIF present), UT-04 (fallback flagged), IT-02.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image as PILImage
from PIL.ExifTags import GPSTAGS, TAGS

from .config import settings
from .schema import Detection, GeoSource


def _dms_to_decimal(dms, ref) -> float:
    deg, minute, sec = (float(x) for x in dms)
    dec = deg + minute / 60.0 + sec / 3600.0
    if ref in ("S", "W"):
        dec = -dec
    return dec


def extract_exif_gps(path: str | Path) -> Optional[Tuple[float, float]]:
    """Return (lat, lon) from EXIF, or None if not present/parseable."""
    try:
        img = PILImage.open(path)
        exif = img._getexif()  # noqa: SLF001
    except Exception:  # noqa: BLE001
        return None
    if not exif:
        return None

    gps = {}
    for tag_id, value in exif.items():
        if TAGS.get(tag_id) == "GPSInfo":
            for k, v in value.items():
                gps[GPSTAGS.get(k, k)] = v
    if not gps:
        return None
    try:
        lat = _dms_to_decimal(gps["GPSLatitude"], gps.get("GPSLatitudeRef", "N"))
        lon = _dms_to_decimal(gps["GPSLongitude"], gps.get("GPSLongitudeRef", "E"))
        return lat, lon
    except KeyError:
        return None


def geolocate(detections: List[Detection], image_path: str | Path,
              browser_coords: Optional[Tuple[float, float]] = None,
              fallback: Optional[Tuple[float, float]] = None) -> List[Detection]:
    """Attach coordinates to every detection from one image.

    Priority chain (highest → lowest):
      1. EXIF GPS embedded in the image file     → geo_source='exif'
      2. Browser Geolocation API (sent by the UI) → geo_source='browser'
      3. Simulated/fallback coordinates           → geo_source='simulated'

    UT-03: image with GPS -> (lat, lon), geo_source='exif'.
    UT-04: image without GPS -> simulated coords, geo_source='simulated'.
    """
    coords = extract_exif_gps(image_path)
    if coords is not None:
        lat, lon = coords
        src = GeoSource.exif
    elif browser_coords is not None:
        lat, lon = browser_coords
        src = GeoSource.browser
    else:
        lat, lon = fallback or (settings.fallback_lat, settings.fallback_lon)
        src = GeoSource.simulated

    for d in detections:
        d.latitude, d.longitude, d.geo_source = lat, lon, src
    return detections
