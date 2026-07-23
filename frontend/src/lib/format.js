/** Formatting helpers shared across views. */

export const num = (n) => (n == null ? '—' : n.toLocaleString())

export const pct = (v, digits = 0) =>
  v == null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(digits)}%`

export const signedPct = (v) => {
  if (v == null || Number.isNaN(v)) return null
  const s = `${Math.abs(v * 100).toFixed(0)}%`
  return { up: v >= 0, text: v >= 0 ? `↑ ${s}` : `↓ ${s}` }
}

export const coords = (lat, lon, d = 4) =>
  lat == null || lon == null ? '—' : `${lat.toFixed(d)}, ${lon.toFixed(d)}`

/** Human "age" of a detection: 8m, 3h, 6d. */
export function age(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const mins = Math.max(0, Math.round((now - t) / 6e4))
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h`
  return `${Math.round(hrs / 24)}d`
}

export function dateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function shortDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Short display id: TT-0234 style, stable per detection uuid. */
export function shortId(uuid, prefix = 'TT') {
  if (!uuid) return '—'
  const hex = String(uuid).replace(/-/g, '').slice(-4)
  return `${prefix}-${parseInt(hex, 16).toString().padStart(4, '0').slice(-4)}`
}

/** RFC-4180-ish CSV escape. */
const cell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows, columns) {
  const head = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(c.get(r))).join(',')).join('\n')
  return `${head}\n${body}`
}

export function download(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
