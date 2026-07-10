# TrashTrack — AI for City Trash Detection & Reporting

MSDS 498 Capstone · Group 4. A closed-loop computer-vision pipeline that
detects litter in urban imagery, geotags it, maps it, and routes structured
cleanup reports to a civic endpoint.

## Architecture (maps to the Project Plan §2, C1–C5)

```
                     React Frontend (:3000)
                      ┌──────────────────────────┐
                      │  Upload · Canvas · Map    │
                      │  Reports · Geo Status     │
                      └────────┬─────────────────┘
                               │ POST /ingest
                               ▼
image ─▶ C1 Ingestion ─▶ C2 Detection ─▶ C3 Geolocation ─▶ C5 Reporting ─▶ Civic API
 (upload/batch/live)    (YOLOv8)         (EXIF|browser|sim)  (severity)      (:8001)
```

### Geotagging priority chain (C3)
1. **EXIF GPS** — embedded in the photo file → `geo_source: "exif"`
2. **Browser Geolocation** — sent by the React frontend via the Geolocation API → `geo_source: "browser"`
3. **Simulated fallback** — default coordinates for testing → `geo_source: "simulated"`

Provenance is recorded in every Detection's `geo_source` field so evaluation
stays transparent (§10.4 in the Project Plan).

## Quickstart

### 1. Backend (Python)

```bash
cd trashtrack
python3 -m venv .venv && source .venv/bin/activate

# light install — tests + API, no GPU needed
pip install -r requirements-core.txt
TT_DETECTOR=stub pytest -q          # 13 tests should pass

# start the API
uvicorn trashtrack.api:app --reload --port 8000
```

For real YOLO detection (downloads PyTorch + weights):
```bash
pip install -r requirements.txt      # adds ultralytics
uvicorn trashtrack.api:app --reload --port 8000
```

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev                          # opens on http://localhost:3000
```

The Vite dev server proxies `/api/*` to `localhost:8000`, so just start both.

### 3. Full loop with civic endpoint (optional)

```bash
# terminal 3
uvicorn trashtrack.civic_api:app --port 8001
```

Then set `route_to_civic=True` in `api.py` to see reports acknowledged.

## File map

| File | Role |
|------|------|
| `trashtrack/ingestion.py` | C1 — validate & decode images |
| `trashtrack/detection.py` | C2 — YOLOv8 + stub backend |
| `trashtrack/geolocation.py` | C3 — EXIF / browser / simulated geotagging |
| `trashtrack/reporting.py` | C5 — severity rule, reports, civic routing |
| `trashtrack/pipeline.py` | closed-loop orchestrator |
| `trashtrack/api.py` | FastAPI with CORS (serves the React frontend) |
| `trashtrack/civic_api.py` | mock municipal intake |
| `trashtrack/schema.py` | §10 data schema (Image / Detection / Report) |
| `frontend/` | React + Vite + Leaflet UI |
| `tests/` | UT-01..06 + IT-01..07 (13 tests) |

## Status

**Done:** schema, all 5 components, React frontend with map + canvas + reports,
browser geolocation, closed-loop pipeline, mock civic API, 13 passing tests, TACO EDA.

**Next (P2/P4):** fine-tune YOLOv8 on TACO/UAVVaste/RoLID-11K, cross-dataset
mAP benchmark (ST-04), live-camera mode (ST-05), UAT.
