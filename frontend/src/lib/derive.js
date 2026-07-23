/**
 * Derivations that turn raw pipeline records (Image / Detection / Report, see
 * trashtrack/schema.py) into the shapes the dashboard renders.
 *
 * The backend does not emit litter *category*, zone or hotspot -- those are
 * dashboard-level concepts, so they are derived here rather than faked upstream.
 */

/**
 * Palette, in hex.
 *
 * These mirror the custom properties in index.css. Both forms are needed:
 * CSS `var()` does NOT resolve inside SVG presentation attributes or Leaflet
 * path options, so charts and map layers must be handed real hex. Keep the two
 * in sync -- and re-run the palette validator if you ever change a value, since
 * the slot ORDER is what makes the set colorblind-safe.
 */
export const HEX = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
  ramp: ['#86b6ef', '#3987e5', '#256abf'],
  critical: '#d03b3b',
  warning: '#fab219',
  good: '#0ca30c',
  muted: '#8b949e',
  surface: '#1a1f25',
  grid: '#2c3238',
}

// --- litter type ------------------------------------------------------------
// Categorical slot order is fixed and must not be reordered (see index.css).
export const LITTER_TYPES = [
  { key: 'plastic', label: 'Plastic', color: 'var(--series-1)', hex: HEX.series[0] },
  { key: 'paper', label: 'Paper', color: 'var(--series-2)', hex: HEX.series[1] },
  { key: 'glass', label: 'Glass', color: 'var(--series-3)', hex: HEX.series[2] },
  { key: 'metal', label: 'Metal', color: 'var(--series-4)', hex: HEX.series[3] },
  { key: 'other', label: 'Other', color: 'var(--series-5)', hex: HEX.series[4] },
]

export const TYPE_LABEL = Object.fromEntries(LITTER_TYPES.map((t) => [t.key, t.label]))
export const TYPE_COLOR = Object.fromEntries(LITTER_TYPES.map((t) => [t.key, t.hex]))

// COCO/TACO-ish class labels -> the five civic categories a crew cares about.
const TYPE_RULES = [
  [/bottle|plastic|bag|wrapper|cup|straw|styrofoam|lid|container|carton/i, 'plastic'],
  [/paper|cardboard|carton|napkin|newspaper|box/i, 'paper'],
  [/glass|jar/i, 'glass'],
  [/can|metal|tin|foil|aluminium|aluminum/i, 'metal'],
]

export function litterType(classLabel = '') {
  for (const [re, key] of TYPE_RULES) if (re.test(classLabel)) return key
  return 'other'
}

// --- severity ---------------------------------------------------------------
// Reserved status palette -- always rendered with its icon + label alongside,
// so severity is never communicated by color alone.
export const SEVERITIES = [
  { key: 'high', label: 'High', color: HEX.critical, wash: 'var(--status-critical-wash)', icon: '▲' },
  { key: 'medium', label: 'Medium', color: HEX.warning, wash: 'var(--status-warning-wash)', icon: '◆' },
  { key: 'low', label: 'Low', color: HEX.good, wash: 'var(--status-good-wash)', icon: '●' },
]

export const SEVERITY_META = Object.fromEntries(SEVERITIES.map((s) => [s.key, s]))

// --- source -----------------------------------------------------------------
export const SOURCES = [
  { key: 'photo', label: 'Photo' },
  { key: 'dashcam', label: 'Dashcam' },
  { key: 'drone', label: 'Drone' },
]

export const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]))

// --- cleanup state ----------------------------------------------------------
export const STATES = [
  { key: 'uncleaned', label: 'Uncleaned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'cleaned', label: 'Cleaned' },
]

/**
 * Zone label from coordinates. Real deployments reverse-geocode against the
 * municipal district layer; with no geocoder available offline we bucket to a
 * ~1.1km grid so hotspots and the Zone filter still mean something consistent.
 */
const ZONE_GRID = 0.01

export function zoneOf(lat, lon) {
  if (lat == null || lon == null) return 'Unzoned'
  const r = Math.round(lat / ZONE_GRID)
  const c = Math.round(lon / ZONE_GRID)
  const letter = String.fromCharCode(65 + (((r % 26) + 26) % 26))
  return `Zone ${letter}${(((c % 90) + 90) % 90) + 10}`
}

export function zoneCenter(zone, rows) {
  const pts = rows.filter((r) => r.zone === zone && r.latitude != null)
  if (!pts.length) return null
  return [
    pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
    pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
  ]
}

/**
 * Join a pipeline response into flat dashboard rows: one row per detection,
 * carrying its report (if the pipeline generated one) and derived fields.
 */
export function toRows(result, { source = 'photo', capturedAt = null } = {}) {
  const reportByDetection = Object.fromEntries(
    (result.reports || []).map((r) => [r.detection_id, r])
  )
  return (result.detections || []).map((d) => {
    const report = reportByDetection[d.detection_id] || null
    return {
      detection_id: d.detection_id,
      image_id: d.image_id,
      class_label: d.class_label,
      type: litterType(d.class_label),
      confidence: d.confidence,
      bbox: { x: d.bbox_x, y: d.bbox_y, w: d.bbox_w, h: d.bbox_h },
      latitude: d.latitude,
      longitude: d.longitude,
      geo_source: d.geo_source,
      detected_at: capturedAt || d.detected_at,
      zone: zoneOf(d.latitude, d.longitude),
      source,
      severity: report?.severity || 'low',
      state: 'uncleaned',
      cleaned_at: null,
      crew: null,
      report_id: report?.report_id || null,
      report_status: report?.status || null,
      civic_ack_id: report?.civic_ack_id || null,
      sample: false,
    }
  })
}

// --- filtering --------------------------------------------------------------
export const DATE_RANGES = [
  { key: '24h', label: 'Last 24 hours', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
]

export function withinRange(row, rangeKey, now = Date.now()) {
  const range = DATE_RANGES.find((r) => r.key === rangeKey)
  if (!range || range.days == null) return true
  const t = new Date(row.detected_at).getTime()
  if (Number.isNaN(t)) return true
  return now - t <= range.days * 864e5
}

export function applyFilters(rows, f, now = Date.now()) {
  return rows.filter((r) => {
    if (!withinRange(r, f.range, now)) return false
    if (f.severity.length && !f.severity.includes(r.severity)) return false
    if (f.types.length && !f.types.includes(r.type)) return false
    if (f.sources.length && !f.sources.includes(r.source)) return false
    if (f.zone && r.zone !== f.zone) return false
    if (f.states.length && !f.states.includes(r.state)) return false
    if (f.query) {
      const q = f.query.toLowerCase()
      const hay = `${r.zone} ${r.class_label} ${r.detection_id} ${r.latitude} ${r.longitude}`
      if (!hay.toLowerCase().includes(q)) return false
    }
    return true
  })
}

export const EMPTY_FILTERS = {
  range: '30d',
  severity: [],
  types: [],
  sources: [],
  states: [],
  zone: '',
  query: '',
}

export function activeFilterCount(f) {
  return (
    f.severity.length +
    f.types.length +
    f.sources.length +
    f.states.length +
    (f.zone ? 1 : 0) +
    (f.query ? 1 : 0) +
    (f.range !== EMPTY_FILTERS.range ? 1 : 0)
  )
}

// --- hotspots ---------------------------------------------------------------
/**
 * Grid-cluster detections into hotspot zones. Mirrors the spec's rule: a zone
 * with >10 detections in the window is a hotspot; intensity is high/medium/low.
 */
export function hotspots(rows) {
  const byZone = new Map()
  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue
    if (!byZone.has(r.zone)) byZone.set(r.zone, [])
    byZone.get(r.zone).push(r)
  }

  return [...byZone.entries()]
    .map(([zone, items]) => {
      const center = [
        items.reduce((s, p) => s + p.latitude, 0) / items.length,
        items.reduce((s, p) => s + p.longitude, 0) / items.length,
      ]
      const counts = { high: 0, medium: 0, low: 0 }
      for (const i of items) counts[i.severity] = (counts[i.severity] || 0) + 1

      const byType = {}
      for (const i of items) byType[i.type] = (byType[i.type] || 0) + 1
      const topTypes = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, n]) => ({ type, n, pct: n / items.length }))

      const states = { uncleaned: 0, in_progress: 0, cleaned: 0 }
      for (const i of items) states[i.state] = (states[i.state] || 0) + 1

      const intensity = items.length >= 30 ? 'high' : items.length >= 10 ? 'medium' : 'low'

      return {
        zone,
        center,
        total: items.length,
        counts,
        topTypes,
        states,
        intensity,
        // radius grows with count but is capped so a busy zone stays readable
        radius: Math.min(340, 90 + items.length * 8),
        items,
      }
    })
    .sort((a, b) => b.total - a.total)
}

// --- analytics --------------------------------------------------------------
export function countBy(rows, key) {
  const out = {}
  for (const r of rows) out[r[key]] = (out[r[key]] || 0) + 1
  return out
}

/** Daily detection counts across the active window, zero-filled. */
export function timeSeries(rows, days = 30, now = Date.now()) {
  const buckets = new Map()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 864e5)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const r of rows) {
    const k = new Date(r.detected_at).toISOString().slice(0, 10)
    if (buckets.has(k)) buckets.set(k, buckets.get(k) + 1)
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }))
}

/** Hours between detection and cleanup, bucketed like the spec's chart. */
export function responseBuckets(rows) {
  const cleaned = rows.filter((r) => r.state === 'cleaned' && r.cleaned_at)
  const b = [
    { key: 'lt1', label: '< 1 day', n: 0 },
    { key: '1to2', label: '1-2 days', n: 0 },
    { key: 'gt2', label: '> 2 days', n: 0 },
  ]
  for (const r of cleaned) {
    const hrs = (new Date(r.cleaned_at) - new Date(r.detected_at)) / 36e5
    if (hrs < 24) b[0].n++
    else if (hrs <= 48) b[1].n++
    else b[2].n++
  }
  return { buckets: b, total: cleaned.length }
}

export function avgResolutionDays(rows) {
  const cleaned = rows.filter((r) => r.state === 'cleaned' && r.cleaned_at)
  if (!cleaned.length) return null
  const sum = cleaned.reduce(
    (s, r) => s + (new Date(r.cleaned_at) - new Date(r.detected_at)) / 864e5,
    0
  )
  return sum / cleaned.length
}

/**
 * Headline metrics. `prev` is the equal-length preceding window, used for the
 * trend delta -- shown only when that window actually has data, so a first-run
 * dashboard doesn't claim a meaningless "+100%".
 */
export function metrics(rows, prevRows) {
  const total = rows.length
  const high = rows.filter((r) => r.severity === 'high').length
  const cleaned = rows.filter((r) => r.state === 'cleaned').length
  const awaiting = rows.filter((r) => r.severity === 'high' && r.state !== 'cleaned').length

  let delta = null
  if (prevRows && prevRows.length) delta = (total - prevRows.length) / prevRows.length

  const confidences = rows.filter((r) => r.confidence != null).map((r) => r.confidence)
  const meanConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null

  return {
    total,
    high,
    highPct: total ? high / total : 0,
    cleaned,
    cleanupRate: total ? cleaned / total : 0,
    awaiting,
    delta,
    meanConfidence,
    avgResolution: avgResolutionDays(rows),
  }
}
