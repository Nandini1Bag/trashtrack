"""
Main API (C1 entry point). Ingest an image over HTTP and run the closed loop.

    uvicorn trashtrack.api:app --reload --port 8000

Endpoints:
    POST /ingest    multipart image + optional browser coords -> pipeline result
    GET  /health
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .ingestion import load_image_bytes
from .pipeline import TrashTrackPipeline
from .schema import ImageSource

app = FastAPI(title="TrashTrack API")

# --- CORS for the React frontend ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipeline = TrashTrackPipeline(route_to_civic=False)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    browser_lat: Optional[float] = Form(None),
    browser_lon: Optional[float] = Form(None),
):
    """Accept an image + optional browser geolocation coordinates.

    Geotagging priority:
      1. EXIF GPS in the image itself
      2. browser_lat / browser_lon from the Geolocation API
      3. Simulated fallback
    """
    raw = await file.read()
    image, array = load_image_bytes(raw, file_hint=file.filename or "upload.jpg",
                                    source=ImageSource.upload)

    suffix = Path(file.filename or "x.jpg").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    browser_coords = None
    if browser_lat is not None and browser_lon is not None:
        browser_coords = (browser_lat, browser_lon)

    result = _pipeline.process(image, array, image_path=tmp_path,
                               browser_coords=browser_coords)
    return {
        "image": result.image.model_dump(mode="json"),
        "detections": [d.model_dump(mode="json") for d in result.detections],
        "reports": [r.model_dump(mode="json") for r in result.reports],
    }
