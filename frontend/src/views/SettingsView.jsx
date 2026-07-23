import React from 'react'
import { KV, Panel } from '../components/ui'
import { num } from '../lib/format'

const ROLES = [
  { role: 'Admin', who: 'Municipality IT', can: 'All dashboards · manage users · configure civic endpoints · export all data' },
  { role: 'Supervisor', who: 'Waste management', can: 'Map, reports, analytics · create & submit reports · assign crews' },
  { role: 'Field crew lead', who: 'Street cleaning', can: 'Assigned reports on mobile · mark cleaned · upload completion evidence' },
  { role: 'Analyst', who: 'Planning dept.', can: 'Read-only analytics · export data · no report creation' },
]

export default function SettingsView({ rows, reports, endpoint, onEndpoint, onLoadSample, onClear, hasSample }) {
  const real = rows.filter((r) => !r.sample).length

  return (
    <>
      <div className="view-head">
        <h1 className="view-head__title">Settings</h1>
        <span className="view-head__crumb">Configuration & data</span>
      </div>

      <Panel title="Data store">
        <div className="kv-grid">
          <KV label="Detections (total)">{num(rows.length)}</KV>
          <KV label="Ingested (real)">{num(real)}</KV>
          <KV label="Sample rows">{num(rows.length - real)}</KV>
          <KV label="Reports">{num(reports.length)}</KV>
        </div>
        <p className="hint" style={{ margin: '0.75rem 0' }}>
          The backend (<code>trashtrack/api.py</code>) is stateless, so the dashboard keeps an
          append-only log of ingested detections in this browser's localStorage. Clearing it
          removes only local state — nothing on the server.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn--sm" onClick={onLoadSample}>
            {hasSample ? 'Regenerate sample data' : 'Load sample data'}
          </button>
          <button className="btn btn--sm btn--danger" onClick={onClear}>
            Clear all local data
          </button>
        </div>
      </Panel>

      <Panel title="Civic authority endpoint">
        <label className="field__label" htmlFor="endpoint">
          Report intake URL
        </label>
        <input
          id="endpoint"
          className="input"
          value={endpoint}
          onChange={(e) => onEndpoint(e.target.value)}
          placeholder="https://civic-api.city.gov/reports"
        />
        <p className="hint" style={{ marginTop: '0.6rem' }}>
          Reports submitted from the dashboard record this endpoint in their audit trail. The
          pipeline ships with <code>route_to_civic=False</code>, so submissions are logged
          locally rather than forwarded — wire this to a live intake path before enabling
          outbound POSTs.
        </p>
      </Panel>

      <Panel title="Roles & access">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>User group</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.role}>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{r.role}</td>
                  <td>{r.who}</td>
                  <td>{r.can}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: '0.6rem' }}>
          Role-based access control per the project plan. This build runs unauthenticated for
          local development; roles are shown here as the intended production model.
        </p>
      </Panel>
    </>
  )
}
