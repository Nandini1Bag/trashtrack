/**
 * Synthetic dashboard data.
 *
 * This exists so the dashboard can be demoed and laid out before enough real
 * ingests exist. Every row it produces carries `sample: true`, the UI shows a
 * persistent banner while any is loaded, and it is never generated implicitly
 * -- the user has to ask for it in Settings.
 */
import { zoneOf } from './derive'

// Deterministic PRNG so a reload doesn't reshuffle the demo.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const CLASSES = {
  plastic: ['plastic bottle', 'plastic bag', 'food wrapper', 'plastic cup', 'straw'],
  paper: ['paper litter', 'cardboard', 'newspaper', 'paper cup'],
  glass: ['glass bottle', 'broken glass', 'glass jar'],
  metal: ['metal can', 'aluminium foil', 'tin can'],
  other: ['misc debris', 'cigarette butt', 'unknown litter'],
}

const TYPE_MIX = [
  ['plastic', 0.52],
  ['paper', 0.19],
  ['glass', 0.12],
  ['metal', 0.1],
  ['other', 0.07],
]

const SOURCE_MIX = [
  ['dashcam', 0.45],
  ['photo', 0.35],
  ['drone', 0.2],
]

const CREWS = ['Team Alpha', 'Team Bravo', 'Team Charlie']

// Cluster centres near the Chicago Loop, matching the reference wireframe.
const CLUSTERS = [
  { lat: 41.8781, lon: -87.6298, weight: 0.3, spread: 0.004 }, // downtown commercial
  { lat: 41.8919, lon: -87.6051, weight: 0.2, spread: 0.005 }, // near north
  { lat: 41.8676, lon: -87.6169, weight: 0.18, spread: 0.006 }, // south loop
  { lat: 41.9042, lon: -87.6478, weight: 0.17, spread: 0.007 }, // west side
  { lat: 41.8557, lon: -87.6698, weight: 0.15, spread: 0.008 }, // parks
]

function pick(rand, mix) {
  const r = rand()
  let acc = 0
  for (const [key, w] of mix) {
    acc += w
    if (r <= acc) return key
  }
  return mix[mix.length - 1][0]
}

function gaussian(rand) {
  // Box-Muller, so clusters look like real spatial spread rather than a square blob.
  const u = Math.max(1e-9, rand())
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function generateSample(count = 320, days = 45, seed = 20260717) {
  const rand = rng(seed)
  const now = Date.now()
  const rows = []

  for (let i = 0; i < count; i++) {
    const cluster = pick(
      rand,
      CLUSTERS.map((c, idx) => [idx, c.weight])
    )
    const c = CLUSTERS[cluster]

    const lat = c.lat + gaussian(rand) * c.spread
    const lon = c.lon + gaussian(rand) * c.spread

    const type = pick(rand, TYPE_MIX)
    const classes = CLASSES[type]
    const class_label = classes[Math.floor(rand() * classes.length)]

    // Weight recent days more heavily so the trend line rises, as a growing
    // deployment's would.
    const ageDays = Math.pow(rand(), 1.6) * days
    const detected = new Date(now - ageDays * 864e5 - rand() * 36e5)

    const confidence = 0.62 + rand() * 0.36
    const sevRoll = rand()
    const severity = sevRoll > 0.81 ? 'high' : sevRoll > 0.36 ? 'medium' : 'low'

    // Older detections are more likely to be resolved.
    const resolveChance = Math.min(0.93, 0.25 + (ageDays / days) * 0.8)
    const roll = rand()
    let state = 'uncleaned'
    let cleaned_at = null
    let crew = null

    if (roll < resolveChance) {
      state = 'cleaned'
      const lagHours = severity === 'high' ? 4 + rand() * 26 : 10 + rand() * 70
      const t = detected.getTime() + lagHours * 36e5
      cleaned_at = new Date(Math.min(t, now)).toISOString()
      crew = CREWS[Math.floor(rand() * CREWS.length)]
    } else if (roll < resolveChance + 0.12) {
      state = 'in_progress'
      crew = CREWS[Math.floor(rand() * CREWS.length)]
    }

    rows.push({
      detection_id: `sample-${i}-${Math.floor(rand() * 1e9).toString(16)}`,
      image_id: `sample-img-${Math.floor(i / 4)}`,
      class_label,
      type,
      confidence,
      bbox: { x: 0, y: 0, w: 1, h: 1 },
      latitude: lat,
      longitude: lon,
      geo_source: pick(rand, [
        ['exif', 0.4],
        ['browser', 0.35],
        ['simulated', 0.25],
      ]),
      detected_at: detected.toISOString(),
      zone: zoneOf(lat, lon),
      source: pick(rand, SOURCE_MIX),
      severity,
      state,
      cleaned_at,
      crew,
      report_id: null,
      report_status: null,
      civic_ack_id: null,
      sample: true,
    })
  }

  return rows.sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
}

export function generateSampleReports(rows) {
  const byZone = new Map()
  for (const r of rows) {
    if (!byZone.has(r.zone)) byZone.set(r.zone, [])
    byZone.get(r.zone).push(r)
  }

  const reports = []
  let n = 841
  for (const [zone, items] of [...byZone.entries()].slice(0, 9)) {
    const batch = items.slice(0, 5 + (n % 4))
    if (batch.length < 2) continue

    const generated = new Date(
      Math.max(...batch.map((b) => new Date(b.detected_at).getTime())) + 18e5
    )
    const phase = n % 3 // rotate through generated / submitted / acknowledged
    const submitted = phase >= 1 ? new Date(generated.getTime() + 12e4) : null
    const acked = phase === 2 ? new Date(generated.getTime() + 58e5) : null

    reports.push({
      id: `RPT-${n}`,
      zone,
      detection_ids: batch.map((b) => b.detection_id),
      count: batch.length,
      high: batch.filter((b) => b.severity === 'high').length,
      medium: batch.filter((b) => b.severity === 'medium').length,
      low: batch.filter((b) => b.severity === 'low').length,
      crew: batch.find((b) => b.crew)?.crew || 'Team Alpha',
      status: phase === 2 ? 'acknowledged' : phase === 1 ? 'submitted' : 'generated',
      civic_ack_id: acked ? `${7700 + n}-A-2026` : null,
      endpoint: submitted ? 'https://civic-api.city.gov/reports' : null,
      generated_at: generated.toISOString(),
      submitted_at: submitted?.toISOString() || null,
      acknowledged_at: acked?.toISOString() || null,
      sample: true,
    })
    n++
  }
  return reports.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at))
}
