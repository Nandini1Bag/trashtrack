/**
 * Detection store.
 *
 * The FastAPI backend (trashtrack/api.py) is stateless -- it exposes POST
 * /ingest and GET /health only, with no persistence layer. So the dashboard
 * keeps its own append-only log of everything ingested in this browser. When a
 * real GET /detections lands, swap `load`/`persist` for fetches; nothing above
 * this module needs to change.
 */

const KEY = 'trashtrack.detections.v1'
const FILTER_KEY = 'trashtrack.savedfilters.v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or private mode -- the session still works, it just won't persist */
  }
}

export const loadRows = () => read(KEY, [])
export const saveRows = (rows) => write(KEY, rows)

export const loadSavedFilters = () => read(FILTER_KEY, [])
export const saveSavedFilters = (f) => write(FILTER_KEY, f)

export function clearAll() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// --- report grouping --------------------------------------------------------
/**
 * Reports aggregate 5-10 detections per the project plan. The pipeline emits
 * one Report per Detection, so the dashboard groups them into civic-facing
 * report batches by zone + ingest.
 */
const REPORT_KEY = 'trashtrack.reports.v1'

export const loadReports = () => read(REPORT_KEY, [])
export const saveReports = (r) => write(REPORT_KEY, r)

export function nextReportId(existing) {
  const nums = existing
    .map((r) => Number(String(r.id).replace(/\D/g, '')))
    .filter((n) => !Number.isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 840) + 1
  return `RPT-${String(next).padStart(4, '0')}`
}

export function buildReport(id, rows, { zone, crew = null } = {}) {
  const severities = rows.map((r) => r.severity)
  return {
    id,
    zone: zone || rows[0]?.zone || 'Unzoned',
    detection_ids: rows.map((r) => r.detection_id),
    count: rows.length,
    high: severities.filter((s) => s === 'high').length,
    medium: severities.filter((s) => s === 'medium').length,
    low: severities.filter((s) => s === 'low').length,
    crew,
    status: 'generated', // generated -> submitted -> acknowledged
    civic_ack_id: null,
    endpoint: null,
    generated_at: new Date().toISOString(),
    submitted_at: null,
    acknowledged_at: null,
  }
}
