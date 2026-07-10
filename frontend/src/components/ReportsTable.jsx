import React from 'react'

const sev = {
  high:   { bg: 'rgba(228, 87, 46, 0.15)', color: '#e4572e', label: 'HIGH' },
  medium: { bg: 'rgba(210, 153, 34, 0.15)', color: '#d29922', label: 'MED' },
  low:    { bg: 'rgba(63, 185, 80, 0.15)',  color: '#3fb950', label: 'LOW' },
}

const css = {
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 0.35rem',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.4rem 0.75rem',
  },
  td: {
    padding: '0.55rem 0.75rem',
    background: 'var(--surface-raised)',
  },
  first: { borderRadius: '6px 0 0 6px' },
  last:  { borderRadius: '0 6px 6px 0' },
  mono: { fontFamily: 'var(--mono)', fontSize: '0.8rem' },
  pill: (s) => ({
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    background: sev[s]?.bg || 'var(--border)',
    color: sev[s]?.color || 'var(--text-muted)',
  }),
}

export default function ReportsTable({ reports, detections }) {
  const detMap = Object.fromEntries(detections.map((d) => [d.detection_id, d]))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={css.table}>
        <thead>
          <tr>
            <th style={css.th}>Report ID</th>
            <th style={css.th}>Class</th>
            <th style={css.th}>Confidence</th>
            <th style={css.th}>Severity</th>
            <th style={css.th}>Geo Source</th>
            <th style={css.th}>Coordinates</th>
            <th style={css.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => {
            const det = detMap[r.detection_id] || {}
            return (
              <tr key={r.report_id}>
                <td style={{ ...css.td, ...css.first, ...css.mono }}>
                  {r.report_id?.slice(0, 8)}
                </td>
                <td style={css.td}>{det.class_label || '—'}</td>
                <td style={css.td}>
                  {det.confidence != null ? `${(det.confidence * 100).toFixed(0)}%` : '—'}
                </td>
                <td style={css.td}>
                  <span style={css.pill(r.severity)}>{sev[r.severity]?.label || r.severity}</span>
                </td>
                <td style={{ ...css.td, ...css.mono }}>{det.geo_source || '—'}</td>
                <td style={{ ...css.td, ...css.mono }}>
                  {r.latitude != null
                    ? `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`
                    : '—'}
                </td>
                <td style={{ ...css.td, ...css.last }}>
                  <span style={css.pill(r.status === 'acknowledged' ? 'low' : 'medium')}>
                    {r.status?.toUpperCase()}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
