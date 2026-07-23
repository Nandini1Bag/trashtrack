import React, { useMemo } from 'react'
import {
  DATE_RANGES,
  HEX,
  LITTER_TYPES,
  SEVERITIES,
  SOURCES,
  countBy,
  hotspots,
  metrics,
  responseBuckets,
  timeSeries,
} from '../lib/derive'
import { download, num, pct, toCSV } from '../lib/format'
import { BarsH, BarsV, LineChart } from '../components/charts'
import { Empty, Legend, Panel, StatTile } from '../components/ui'

export default function AnalyticsView({ rows, allRows, filters, onFilters }) {
  const range = DATE_RANGES.find((r) => r.key === filters.range) || DATE_RANGES[2]
  const days = range.days || 30

  // Equal-length preceding window, so the trend delta compares like with like.
  const prevRows = useMemo(() => {
    if (!range.days) return null
    const now = Date.now()
    const start = now - range.days * 864e5
    const prevStart = start - range.days * 864e5
    return allRows.filter((r) => {
      const t = new Date(r.detected_at).getTime()
      return t >= prevStart && t < start
    })
  }, [allRows, range])

  const m = useMemo(() => metrics(rows, prevRows), [rows, prevRows])
  const series = useMemo(() => timeSeries(rows, Math.min(days, 90)), [rows, days])

  const typeData = useMemo(() => {
    const counts = countBy(rows, 'type')
    return LITTER_TYPES.map((t) => ({
      key: t.key,
      label: t.label,
      value: counts[t.key] || 0,
      color: t.hex,
    })).sort((a, b) => b.value - a.value)
  }, [rows])

  const severityData = useMemo(() => {
    const counts = countBy(rows, 'severity')
    return SEVERITIES.map((s) => ({
      key: s.key,
      label: `${s.icon} ${s.label}`,
      value: counts[s.key] || 0,
      color: s.color,
    }))
  }, [rows])

  const sourceData = useMemo(() => {
    const counts = countBy(rows, 'source')
    return SOURCES.map((s, i) => ({
      key: s.key,
      label: s.label,
      value: counts[s.key] || 0,
      color: HEX.ramp[i % HEX.ramp.length],
    }))
  }, [rows])

  const response = useMemo(() => responseBuckets(rows), [rows])
  const responseData = response.buckets.map((b, i) => ({
    key: b.key,
    label: b.label,
    value: b.n,
    color: HEX.ramp[i],
  }))

  const topZones = useMemo(() => hotspots(rows).slice(0, 6), [rows])
  const zoneData = topZones.map((z) => ({
    key: z.zone,
    label: z.zone.replace('Zone ', ''),
    value: z.total,
    color: HEX.series[0],
  }))

  const exportSummary = () => {
    const cols = [
      { label: 'metric', get: (r) => r.k },
      { label: 'value', get: (r) => r.v },
    ]
    const data = [
      { k: 'window', v: range.label },
      { k: 'total_detections', v: m.total },
      { k: 'high_severity', v: m.high },
      { k: 'cleanup_rate', v: m.cleanupRate.toFixed(4) },
      { k: 'awaiting_response', v: m.awaiting },
      { k: 'mean_confidence', v: m.meanConfidence?.toFixed(4) ?? '' },
      { k: 'avg_resolution_days', v: m.avgResolution?.toFixed(2) ?? '' },
      ...typeData.map((t) => ({ k: `type_${t.key}`, v: t.value })),
      ...severityData.map((s) => ({ k: `severity_${s.key}`, v: s.value })),
    ]
    download(`trashtrack-analytics-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data, cols))
  }

  if (!rows.length) {
    return (
      <>
        <div className="view-head">
          <h1 className="view-head__title">Analytics</h1>
          <span className="view-head__crumb">Analytics › Summary</span>
        </div>
        <Panel>
          <Empty icon="📊" title="Nothing to analyse yet">
            Analytics summarise the detections currently in scope. Ingest images, widen the
            date range, or load the sample dataset from Settings to see trends here.
          </Empty>
        </Panel>
      </>
    )
  }

  return (
    <>
      <div className="view-head">
        <h1 className="view-head__title">Analytics</h1>
        <span className="view-head__crumb">Analytics › Summary · {range.label}</span>
        <div className="view-head__actions">
          <select
            className="select"
            style={{ width: 'auto' }}
            value={filters.range}
            onChange={(e) => onFilters({ ...filters, range: e.target.value })}
            aria-label="Date range"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={exportSummary}>
            ⭳ Export summary
          </button>
        </div>
      </div>

      <div className="tiles">
        <StatTile
          label="Total detections"
          value={num(m.total)}
          delta={m.delta}
          deltaGoodWhenUp={false}
          foot={prevRows?.length ? `vs ${num(prevRows.length)} prior period` : 'No prior period'}
        />
        <StatTile
          label="High priority"
          value={num(m.high)}
          foot={`${pct(m.highPct)} of total · ${num(m.awaiting)} awaiting response`}
          tone={m.high ? HEX.critical : undefined}
        />
        <StatTile
          label="Cleanup rate"
          value={pct(m.cleanupRate)}
          foot={
            m.avgResolution != null
              ? `Avg resolution ${m.avgResolution.toFixed(1)} days`
              : 'No cleanups recorded yet'
          }
          tone={m.cleanupRate >= 0.8 ? HEX.good : undefined}
        />
        <StatTile
          label="Mean confidence"
          value={m.meanConfidence != null ? pct(m.meanConfidence, 1) : '—'}
          foot={`Across ${num(m.total)} detections in scope`}
        />
      </div>

      <div className="chart-grid">
        <Panel title="Detections over time">
          <LineChart data={series} label="Detections" color={HEX.ramp[1]} />
          <p className="chart__caption">
            Daily count over the last {series.length} days. Hover for exact values.
          </p>
        </Panel>

        <Panel title="Litter type distribution">
          <BarsH data={typeData} ariaLabel="Detections by litter type" />
          <p className="chart__caption">
            Type is derived from the detector's class label. Ranked by volume.
          </p>
        </Panel>

        <Panel title="Severity breakdown">
          <BarsH data={severityData} ariaLabel="Detections by severity" />
          <Legend
            items={SEVERITIES.map((s) => ({
              label: `${s.icon} ${s.label}`,
              color: s.color,
            }))}
          />
        </Panel>

        <Panel title="Response time distribution">
          {response.total === 0 ? (
            <Empty icon="⏱" title="No completed cleanups in this window">
              Mark detections as cleaned from the map or list to build response-time history.
            </Empty>
          ) : (
            <>
              <BarsV data={responseData} ariaLabel="Time from detection to cleanup" />
              <p className="chart__caption">
                Time from detection to cleanup across {num(response.total)} resolved detections.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Detections by source">
          <BarsH data={sourceData} ariaLabel="Detections by capture source" />
          <p className="chart__caption">Capture channel recorded at ingest.</p>
        </Panel>

        <Panel title="Top zones by volume">
          {zoneData.length ? (
            <>
              <BarsV data={zoneData} ariaLabel="Detections by zone" />
              <p className="chart__caption">
                Zones are a ~1.1 km coordinate grid; a real deployment substitutes municipal
                district boundaries.
              </p>
            </>
          ) : (
            <Empty icon="📍" title="No geotagged detections in scope" />
          )}
        </Panel>
      </div>
    </>
  )
}
