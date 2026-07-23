import React, { useMemo, useState } from 'react'
import { SEVERITY_META, TYPE_COLOR, TYPE_LABEL } from '../lib/derive'
import { age, coords, dateTime, download, pct, shortId, toCSV } from '../lib/format'
import { Empty, KV, Panel, ReportStatusPill, SeverityPill } from '../components/ui'
import { StackBar } from '../components/charts'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'generated', label: 'Pending' },
  { key: 'submitted', label: 'Sent' },
  { key: 'acknowledged', label: "Ack'd" },
]

/** The JSON the civic endpoint would receive -- shown verbatim in the detail view. */
function civicPayload(report, items) {
  return {
    report_id: report.id,
    zone: report.zone,
    generated_at: report.generated_at,
    summary: {
      total_items: report.count,
      high: report.high,
      medium: report.medium,
      low: report.low,
      recommended_crew: report.crew,
    },
    detections: items.map((r) => ({
      detection_id: r.detection_id,
      class_label: r.class_label,
      litter_type: r.type,
      severity: r.severity,
      confidence: Number(r.confidence?.toFixed(3)),
      latitude: r.latitude,
      longitude: r.longitude,
      geo_source: r.geo_source,
      detected_at: r.detected_at,
    })),
  }
}

function ReportDetail({ report, rows, onBack, onSubmit, onAcknowledge, onArchive }) {
  const [showPayload, setShowPayload] = useState(false)
  const items = rows.filter((r) => report.detection_ids.includes(r.detection_id))

  return (
    <>
      <div className="view-head">
        <h1 className="view-head__title">{report.id}</h1>
        <span className="view-head__crumb">Reports › Detail</span>
        <div className="view-head__actions">
          <button className="btn btn--sm btn--ghost" onClick={onBack}>
            ← All reports
          </button>
          {report.status === 'generated' && (
            <button className="btn btn--sm btn--primary" onClick={() => onSubmit(report.id)}>
              Submit to civic API
            </button>
          )}
          {report.status === 'submitted' && (
            <button className="btn btn--sm" onClick={() => onAcknowledge(report.id)}>
              Record acknowledgement
            </button>
          )}
          <button className="btn btn--sm" onClick={() => window.print()}>
            ⎙ Print
          </button>
        </div>
      </div>

      <Panel title="Report summary">
        <div className="kv-grid">
          <KV label="Status">
            <ReportStatusPill status={report.status} />
          </KV>
          <KV label="Zone">{report.zone}</KV>
          <KV label="Total items">{report.count}</KV>
          <KV label="Severity mix">
            ▲ {report.high} · ◆ {report.medium} · ● {report.low}
          </KV>
          <KV label="Recommended crew">{report.crew || 'Unassigned'}</KV>
          <KV label="Generated">{dateTime(report.generated_at)}</KV>
          <KV label="Submitted">
            {report.submitted_at ? dateTime(report.submitted_at) : '—'}
          </KV>
          <KV label="Acknowledged">
            {report.acknowledged_at ? dateTime(report.acknowledged_at) : '—'}
          </KV>
          <KV label="Civic ack ID">
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>
              {report.civic_ack_id || '—'}
            </span>
          </KV>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <StackBar
            data={[
              { key: 'high', label: 'High', value: report.high, color: SEVERITY_META.high.color },
              { key: 'medium', label: 'Medium', value: report.medium, color: SEVERITY_META.medium.color },
              { key: 'low', label: 'Low', value: report.low, color: SEVERITY_META.low.color },
            ]}
          />
        </div>
      </Panel>

      <Panel title={`Detections in this report`} badge={items.length}>
        {items.length === 0 ? (
          <Empty icon="🔍" title="Detections not found">
            The detections referenced by this report are no longer in the local store.
          </Empty>
        ) : (
          items.map((r, i) => (
            <div className="detection-item" key={r.detection_id}>
              <span className="detection-item__idx">{i + 1}</span>
              <span
                className="chip__dot"
                style={{ background: TYPE_COLOR[r.type] }}
                aria-hidden="true"
              />
              <div className="detection-item__main">
                <div className="detection-item__title">
                  {r.class_label} · {TYPE_LABEL[r.type]}
                </div>
                <div className="detection-item__meta">
                  {coords(r.latitude, r.longitude)} · conf {pct(r.confidence)} ·{' '}
                  {shortId(r.detection_id)}
                </div>
              </div>
              <SeverityPill severity={r.severity} />
            </div>
          ))
        )}
      </Panel>

      <Panel
        title="Civic authority integration"
        actions={
          <button className="btn btn--sm" onClick={() => setShowPayload((v) => !v)}>
            {showPayload ? 'Hide payload' : 'View payload'}
          </button>
        }
      >
        <div className="kv-grid" style={{ marginBottom: showPayload ? '1rem' : 0 }}>
          <KV label="Endpoint">
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
              {report.endpoint || 'Not yet submitted'}
            </span>
          </KV>
          <KV label="Transport">POST application/json</KV>
          <KV label="Response">
            {report.status === 'acknowledged'
              ? 'HTTP 200 OK'
              : report.status === 'submitted'
                ? 'Awaiting acknowledgement'
                : '—'}
          </KV>
        </div>

        {showPayload && (
          <pre className="code-block">
            {JSON.stringify(civicPayload(report, items), null, 2)}
          </pre>
        )}

        <p className="hint" style={{ marginTop: '0.75rem' }}>
          Submission is recorded locally. The pipeline runs with{' '}
          <code>route_to_civic=False</code> (see <code>trashtrack/api.py</code>), so no request
          leaves this machine until a real endpoint is configured in Settings.
        </p>
      </Panel>
    </>
  )
}

export default function ReportsView({
  reports,
  rows,
  onSubmit,
  onAcknowledge,
  onArchive,
  openReportId,
  onOpenReport,
}) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(
    () => (statusFilter === 'all' ? reports : reports.filter((r) => r.status === statusFilter)),
    [reports, statusFilter]
  )

  const open = reports.find((r) => r.id === openReportId)

  if (open) {
    return (
      <ReportDetail
        report={open}
        rows={rows}
        onBack={() => onOpenReport(null)}
        onSubmit={onSubmit}
        onAcknowledge={onAcknowledge}
        onArchive={onArchive}
      />
    )
  }

  const exportCSV = () => {
    const cols = [
      { label: 'report_id', get: (r) => r.id },
      { label: 'status', get: (r) => r.status },
      { label: 'zone', get: (r) => r.zone },
      { label: 'detections', get: (r) => r.count },
      { label: 'high', get: (r) => r.high },
      { label: 'medium', get: (r) => r.medium },
      { label: 'low', get: (r) => r.low },
      { label: 'crew', get: (r) => r.crew || '' },
      { label: 'generated_at', get: (r) => r.generated_at },
      { label: 'submitted_at', get: (r) => r.submitted_at || '' },
      { label: 'acknowledged_at', get: (r) => r.acknowledged_at || '' },
      { label: 'civic_ack_id', get: (r) => r.civic_ack_id || '' },
    ]
    download(`trashtrack-reports-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(filtered, cols))
  }

  return (
    <>
      <div className="view-head">
        <h1 className="view-head__title">Reports</h1>
        <span className="view-head__crumb">Reports › All reports</span>
        <div className="view-head__actions">
          <div className="segmented" role="group" aria-label="Report status">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.key}
                aria-pressed={statusFilter === s.key}
                onClick={() => setStatusFilter(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button className="btn btn--sm" onClick={exportCSV} disabled={!filtered.length}>
            ⭳ Export CSV
          </button>
        </div>
      </div>

      <section className="panel panel--flush">
        {filtered.length === 0 ? (
          <Empty icon="📝" title="No reports yet">
            Reports batch 5–10 detections for a civic authority. Create one from a hotspot
            popup on the map, or by selecting detections in the list view.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Status</th>
                  <th>Detections</th>
                  <th>Severity mix</th>
                  <th>Zone</th>
                  <th>Crew</th>
                  <th>Age</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="table__link" onClick={() => onOpenReport(r.id)}>
                        {r.id}
                      </button>
                    </td>
                    <td>
                      <ReportStatusPill status={r.status} />
                    </td>
                    <td className="table__num">{r.count} items</td>
                    <td style={{ minWidth: 130 }}>
                      <StackBar
                        height={8}
                        data={[
                          { key: 'high', label: 'High', value: r.high, color: SEVERITY_META.high.color },
                          { key: 'medium', label: 'Medium', value: r.medium, color: SEVERITY_META.medium.color },
                          { key: 'low', label: 'Low', value: r.low, color: SEVERITY_META.low.color },
                        ]}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ▲ {r.high} ◆ {r.medium} ● {r.low}
                      </span>
                    </td>
                    <td>{r.zone}</td>
                    <td>{r.crew || '—'}</td>
                    <td className="table__num" title={dateTime(r.generated_at)}>
                      {age(r.generated_at)}
                    </td>
                    <td>
                      {r.status === 'generated' ? (
                        <button className="btn btn--sm" onClick={() => onSubmit(r.id)}>
                          Submit
                        </button>
                      ) : (
                        <button
                          className="btn btn--sm btn--ghost"
                          onClick={() => onOpenReport(r.id)}
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
