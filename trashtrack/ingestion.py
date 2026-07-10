"""
C1 -- Ingestion.

Accept images (upload / batch / live camera), validate and normalize them,
and produce a schema-valid `Image` record plus a decoded RGB numpy array.

Validated by: UT-01, UT-02, UT-03, IT-01
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image as PILImage

from .schema import Image, ImageSource

VALID_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class IngestionError(ValueError):
    """Raised when an input cannot be ingested."""


def _to_rgb_array(pil: PILImage.Image) -> np.ndarray:
    return np.asarray(pil.convert("RGB"))


def load_image_file(path: str | Path, source: ImageSource = ImageSource.upload,
                    dataset: str = "local") -> Tuple[Image, np.ndarray]:
    """Load a valid image from disk. Returns (Image record, RGB ndarray).

    UT-01: a valid JPEG path yields a tensor-like array.
    """
    path = Path(path)
    if not path.exists():
        raise IngestionError(f"file not found: {path}")
    if path.suffix.lower() not in VALID_EXT:
        raise IngestionError(f"unsupported extension: {path.suffix}")

    try:
        pil = PILImage.open(path)
        pil.load()
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"cannot decode image: {exc}") from exc

    arr = _to_rgb_array(pil)
    rec = Image(
        source=source,
        dataset=dataset,
        file_path=str(path),
        width=pil.width,
        height=pil.height,
    )
    return rec, arr


def load_image_bytes(raw: bytes, file_hint: str = "upload.jpg",
                     source: ImageSource = ImageSource.upload) -> Tuple[Image, np.ndarray]:
    """Load an image from raw bytes (e.g. a FastAPI UploadFile or a camera frame)."""
    try:
        pil = PILImage.open(io.BytesIO(raw))
        pil.load()
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"cannot decode bytes: {exc}") from exc

    arr = _to_rgb_array(pil)
    rec = Image(source=source, file_path=file_hint, width=pil.width, height=pil.height)
    return rec, arr
