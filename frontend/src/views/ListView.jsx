import React, { useMemo, useState } from 'react'
import { TYPE_COLOR, TYPE_LABEL, SOURCE_LABEL } from '../lib/derive'
import { age, coords, dateTime, download, pct, shortId, toCSV } from '../lib/format'
import { Empty, SeverityPill, StatePill } from '../components/ui'

const PAGE = 40

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 }

const COLUMNS = [
  { key: 'id', label: 'ID', sort: (r) => r.detection_id },
  { key: 'location', label: 'Location', sort: (r) => r.latitude ?? -999 },
  { key: 'zone', label: 'Zone', sort: (r) => r.zone },
  { key: 'type', label: 'Type', sort: (r) => r.type },
  { key: 'severity', label: 'Severity', sort: (r) => SEVERITY_RANK[r.severity] ?? 0 },
  { key: 'confidence', label: 'Conf.', sort: (r) => r.confidence ?? 0 },
  { key: 'source', label: 'Source', sort: (r) => r.source },
  { key: 'state', label: 'Status', sort: (r) => r.state },
  { key: 'age', label: 'Age', sort: (r) => new Date(r.detected_at).getTime() },
]

const CSV_COLUMNS = [
  { label: 'detection_id', get: (r) => r.detection_id },
  { label: 'display_id', get: (r) => shortId(r.detection_id) },
  { label: 'class_label', get: (r) => r.class_label },
  { label: 'litter_type', get: (r) => TYPE_LABEL[r.type] },
  { label: 'confidence', get: (r) => r.confidence?.toFixed(4) },
  { label: 'severity', get: (r) => r.severity },
  { label: 'status', get: (r) => r.state },
  { label: 'latitude', get: (r) => r.latitude },
  { label: 'longitude', get: (r) => r.longitude },
  { label: 'geo_source', get: (r) => r.geo_source },
  { label: 'zone', get: (r) => r.zone },
  { label: 'source', get: (r) => r.source },
  { label: 'detected_at', get: (r) => r.detected_at },
  { label: 'cleaned_at', get: (r) => r.cleaned_at || '' },
  { label: 'crew', get: (r) => r.crew || '' },
  { label: 'report_id', get: (r) => r.report_id || '' },
]

export default function ListView({
  rows,
  allRows,
  filters,
  onFilters,
  onMarkCleaned,
  onGenerateReport,
  onOpenUpload,
}) {
  const [sort, setSort] = useState({ key: 'age', dir: 'desc' })
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState(() => new Set())

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) || COLUMNS[8]
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sort(a)
      const bv = col.sort(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [rows, sort])

  const visible = sorted.slice(0, limit)

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.detection_id))

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.detection_id))
      else visible.forEach((r) => next.add(r.detection_id))
      return next
    })

  const selectedRows = rows.filter((r) => selected.has(r.detection_id))

  const exportCSV = (which) => {
    const data = which === 'selected' ? selectedRows : sorted
    download(
      `trashtrack-detections-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(data, CSV_COLUMNS)
    )
  }

  return (
    <>
      <div className="view-head">
        <h1 className="view-head__title">List View</h1>
        <span className="view-head__crumb">Detections › All records</span>
        <div className="view-head__actions">
          <button className="btn btn--sm" onClick={() => exportCSV('all')} disabled={!sorted.length}>
            ⭳ Download CSV
          </button>
          <button className="btn btn--sm" onClick={() => window.print()} disabled={!sorted.length}>
            ⎙ Print
          </button>
          <button className="btn btn--primary btn--sm" onClick={onOpenUpload}>
            + Ingest image
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="banner" style={{ background: 'var(--teal-wash)', borderColor: 'var(--teal-dim)', color: 'var(--text)' }}>
          <strong>{selected.size}</strong> selected
          <div className="banner__actions">
            <button
              className="btn btn--sm btn--primary"
              onClick={() => {
                onGenerateReport({ zone: selectedRows[0]?.zone, items: selectedRows })
                setSelected(new Set())
              }}
            >
              Generate report
            </button>
            <button className="btn btn--sm" onClick={() => exportCSV('selected')}>
              Export selection
            </button>
            <button
              className="btn btn--sm"
              onClick={() => {
                selectedRows.forEach((r) => onMarkCleaned(r.detection_id))
                setSelected(new Set())
              }}
            >
              Mark cleaned
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      <section className="panel panel--flush">
        <div
          className="panel__head"
          style={{ padding: '0.85rem 1rem', marginBottom: 0, borderBottom: '1px solid var(--border)' }}
        >
          <span className="panel__title">
            Showing {visible.length.toLocaleString()} of {rows.length.toLocaleString()}
            {rows.length !== allRows.length && ` (filtered from ${allRows.length.toLocaleString()})`}
          </span>
          <div className="panel__actions">
            <input
              className="input"
              style={{ width: 200 }}
              placeholder="Search id, zone, class…"
              value={filters.query}
              onChange={(e) => onFilters({ ...filters, query: e.target.value })}
              aria-label="Search detections"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty icon="📋" title="No detections match these filters">
            Adjust the filters in the sidebar, widen the date range, or ingest a new image to
            populate the list.
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        aria-label="Select all visible"
                      />
                    </th>
                    {COLUMNS.map((c) => (
                      <th key={c.key}>
                        <button onClick={() => toggleSort(c.key)}>
                          {c.label}
                          {sort.key === c.key && (
                            <span aria-hidden="true">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </button>
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.detection_id} className={selected.has(r.detection_id) ? 'is-selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(r.detection_id)}
                          onChange={() => toggleRow(r.detection_id)}
                          aria-label={`Select ${shortId(r.detection_id)}`}
                        />
                      </td>
                      <td className="table__mono">{shortId(r.detection_id)}</td>
                      <td className="table__mono">{coords(r.latitude, r.longitude, 3)}</td>
                      <td>{r.zone}</td>
                      <td>
                        <span
                          className="chip__dot"
                          style={{
                            background: TYPE_COLOR[r.type],
                            display: 'inline-block',
                            marginRight: 6,
                          }}
                          aria-hidden="true"
                        />
                        {TYPE_LABEL[r.type]}
                      </td>
                      <td>
                        <SeverityPill severity={r.severity} />
                      </td>
                      <td className="table__num">{pct(r.confidence)}</td>
                      <td>{SOURCE_LABEL[r.source] || r.source}</td>
                      <td>
                        <StatePill state={r.state} />
                      </td>
                      <td className="table__num" title={dateTime(r.detected_at)}>
                        {age(r.detected_at)}
                      </td>
                      <td>
                        {r.state !== 'cleaned' && (
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => onMarkCleaned(r.detection_id)}
                          >
                            ✓ Clean
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {limit < sorted.length && (
              <div style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn--sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Load {Math.min(PAGE, sorted.length - limit)} more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
