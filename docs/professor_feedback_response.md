# TrashTrack — Addressing Professor Feedback

## 1. Privacy Concerns with Geospatial Metadata

The professor raises both sides of the same coin: (a) collecting EXIF GPS from people's
photos may violate privacy, and (b) because of privacy concerns, EXIF GPS is routinely
stripped — so the data may simply not be available.

### The availability problem (the practical side)

EXIF GPS is stripped by almost every major platform and messaging app. Our own EDA
confirms this — the five real TACO images we tested all had `geo_source: "simulated"`
because no embedded GPS was present. This is not an accident; it is the norm.

| Source                  | EXIF GPS preserved? |
|-------------------------|---------------------|
| iPhone/Android camera   | Yes (on device)     |
| WhatsApp / Telegram     | Stripped            |
| Twitter / Instagram     | Stripped            |
| Shared via email        | Usually preserved   |
| Dashcam footage         | No EXIF; separate GPS track file |
| Drone footage           | No EXIF; flight telemetry file   |

This means the system **cannot rely on EXIF as the primary geotagging source**.
Our three-tier fallback chain already handles this:

    EXIF GPS → Browser Geolocation API → Simulated/manual fallback

But the professor's comment pushes us to be more explicit about **which source
is realistic for each use case**:

| Use case               | Realistic geo source          |
|-------------------------|-------------------------------|
| Citizen photo upload    | Browser Geolocation API       |
| Dashcam street survey   | GPS track file synced by timestamp |
| Drone area surveillance | Flight telemetry (lat/lon per frame) |
| Batch processing (TACO) | Simulated (for eval only)     |

### The privacy side (the ethical side)

Even when GPS is available, we must handle it responsibly:

1. **No PII in detection records.** The schema stores coordinates and bounding boxes,
   never faces, license plates, or identifiable features. The model detects *litter*,
   not people.

2. **Coordinate coarsening.** For civic reports, exact sub-meter precision is unnecessary.
   We will round coordinates to ~100m precision (3 decimal places) in reports sent to
   civic endpoints, sufficient for a cleanup crew to find the site without enabling
   surveillance of individuals.

3. **Transparent provenance.** The `geo_source` field ("exif" / "browser" / "simulated")
   lets auditors and users see exactly where the coordinates came from. No hidden tracking.

4. **No image retention in civic reports.** Reports sent to the civic endpoint carry a
   cropped evidence thumbnail (the bounding box region only), not the full original image.
   This limits incidental capture of bystanders, vehicles, or private property.

5. **Browser geolocation is opt-in.** The Geolocation API requires explicit user consent
   via a browser permission dialog. If denied, the system falls back gracefully.

### What we will add to the codebase

- A `privacy.py` module implementing coordinate coarsening (configurable precision).
- Evidence thumbnail cropping in the report generator (bbox region only).
- Documentation of the privacy stance in the README and the final report.


---

## 2. Quantifiable Success Thresholds

The professor is right — the testing plan has test cases (UT/IT/ST/UAT) but no numeric
pass/fail thresholds. Here are concrete, defensible targets:

### Detection performance (ST-04)

| Metric          | Target          | Rationale |
|-----------------|-----------------|-----------|
| mAP@0.5 (TACO, single-class "litter") | ≥ 0.45 | Published TACO baselines range 0.20–0.55 for multi-class; single-class should be at the upper end. Baseline (pretrained YOLOv8n) = 0.00 — any improvement is meaningful. |
| mAP@0.5 (UAVVaste) | ≥ 0.35 | Aerial images are harder (smaller objects, altitude variation). Cross-dataset transfer is the research question. |
| mAP@0.5 (RoLID-11K) | ≥ 0.30 | Dashcam adds motion blur and wide aspect ratio. Lower target reflects domain shift. |
| Precision @ conf ≥ 0.50 | ≥ 0.70 | Civic reports must not waste cleanup crews on false positives. |
| Recall @ conf ≥ 0.25 | ≥ 0.50 | Catch at least half the litter; missing some is acceptable, false alarms are not. |

### System performance (ST-05, ST-06)

| Metric               | Target       | Rationale |
|-----------------------|--------------|-----------|
| Single-image latency (CPU) | ≤ 3 seconds | Acceptable for upload/batch mode on a laptop. |
| Single-image latency (GPU) | ≤ 500 ms    | Required for live-camera mode to feel responsive. |
| Batch throughput      | ≥ 50 images in < 3 min (CPU) | ST-03 scenario. |
| API uptime under load | No crashes over 100 sequential requests | ST-06 stability. |

### Geotagging accuracy (C3)

| Metric                     | Target   | Rationale |
|----------------------------|----------|-----------|
| EXIF extraction accuracy   | 100% (when EXIF GPS present) | Deterministic; either it parses or it doesn't. |
| Browser geo accuracy       | Within 100m of true position | Depends on device, but this is the GPS spec. |
| Fallback correctly flagged | 100%     | Every simulated coordinate must have `geo_source: "simulated"`. |

### User acceptance (UAT)

| Metric               | Target          |
|-----------------------|-----------------|
| UAT-01 task success   | ≥ 80% of testers complete without help |
| UAT-03 report rating  | Mean ≥ 3.5 / 5  |
| UAT-04 live camera    | Mean ≥ 3.0 / 5  |
| UAT-05 usefulness     | ≥ 70% "Agree"   |

### How these are measured

All detection metrics use the standard COCO evaluation protocol (pycocotools).
Latency is measured end-to-end (API request to response) using `time.perf_counter`.
UAT uses the task-based protocol already defined in §9 of the testing plan.


---

## 3. Compute Plan for Small-Object Detection

The professor correctly identifies that small-object detection at high resolution is
compute-intensive, and our plan says "free-tier Colab/Kaggle" — which needs more detail.

### The problem, quantified

From the EDA:
- Median TACO image is 2448 × 3264 pixels.
- Median litter object occupies 0.35% of the image area.
- YOLOv8n's default input is 640 × 640 — downscaling a 2448×3264 image to 640px
  shrinks a typical litter bbox to ~7 × 9 pixels. That is undetectable.

### Strategy: tiling + lightweight architecture

Rather than throwing bigger GPUs at bigger models, we tile the input:

1. **Slice large images into overlapping 640×640 tiles** using SAHI
   (Slicing Aided Hyper Inference). Each tile preserves object scale.
   Overlap (e.g., 20%) prevents edge-split detections.
   Post-process: NMS across tiles to merge duplicate boxes.

2. **Train on tiles, not full images.** This means each training sample is 640×640
   regardless of the original image size — standard VRAM usage.

3. **Use YOLOv8s (not n).** YOLOv8s is 2× larger than nano but still fits in
   free-tier GPU memory (Colab T4 has 16GB VRAM; YOLOv8s at batch 16 uses ~6GB).

### Compute budget (realistic)

| Resource        | Capability             | Cost  |
|-----------------|------------------------|-------|
| Google Colab    | T4 GPU, ~4hr sessions  | Free  |
| Kaggle Notebooks| P100 GPU, 30hr/week    | Free  |
| Combined        | ~50 GPU-hours/week     | Free  |

| Task                        | Estimated GPU-hours | Fits in free tier? |
|-----------------------------|---------------------|--------------------|
| TACO fine-tune (YOLOv8s, 100 epochs, tiled) | 3–5 hrs  | Yes |
| UAVVaste fine-tune          | 2–3 hrs             | Yes |
| RoLID-11K fine-tune         | 3–4 hrs             | Yes |
| Hyperparameter sweep (5 runs) | 15–20 hrs          | Yes (across 1 week) |
| Cross-dataset eval          | < 1 hr              | Yes |

Total: ~25–35 GPU-hours across the project. Free-tier Colab + Kaggle provides ~50/week.

### Inference compute (demo day)

| Mode        | Hardware    | Strategy               | Expected latency |
|-------------|-------------|------------------------|------------------|
| Upload/batch | Laptop CPU  | Single tile, YOLOv8s   | ~2 sec/image     |
| Live camera  | Laptop CPU  | 640px input, no tiling | ~1.5 sec/frame   |
| Live camera  | Colab T4    | Full tiling            | ~200 ms/frame    |

For the demo, live-camera mode will run on the laptop at reduced resolution
(no tiling, direct 640px resize) — acceptable for a proof-of-concept demo where
the audience sees real-time detection working, even if recall is lower than the
tiled batch mode.

### Fallback if free-tier is insufficient

- Google Cloud $300 free credits (new accounts) → ~100 GPU-hours on T4.
- Lambda Labs spot instances at $0.50/hr → $15 covers the entire training budget.
- Neither should be needed given the estimates above, but they exist as backstops.
