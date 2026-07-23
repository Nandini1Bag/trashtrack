import React, { useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import { HEX, SEVERITY_META, TYPE_COLOR, TYPE_LABEL, SOURCE_LABEL, hotspots } from '../lib/derive'
import { age, coords, dateTime, pct, shortId } from '../lib/format'
import { SeverityPill, StatePill, Empty } from '../components/ui'
import { StackBar } from '../components/charts'

const CHICAGO = [41.8781, -87.6298]

// Leaflet writes these straight onto SVG attributes, so they must be real hex.
const INTENSITY = {
  high: HEX.critical,
  medium: HEX.warning,
  low: HEX.good,
}

/** Imperative recentre when the caller jumps to a zone or search hit. */
function FlyTo({ target }) {
  const map = useMap()
  const last = useRef(null)
  React.useEffect(() => {
    if (!target) return
    const key = target.join(',')
    if (key === last.current) return
    last.current = key
    map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [target, map])
  return null
}

/** Fit the viewport to the data the first time points arrive. */
function FitBounds({ points }) {
  const map = useMap()
  const done = useRef(false)
  React.useEffect(() => {
    if (done.current || points.length < 2) return
    done.current = true
    const lats = points.map((p) => p.latitude)
    const lons = points.map((p) => p.longitude)
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { padding: [40, 40], maxZoom: 16 }
    )
  }, [points, map])
  return null
}

function DetectionPopup({ row, onMarkCleaned, onOpenReport, onDispatch }) {
  return (
    <div className="popup">
      <div className="popup__head">Detection {shortId(row.detection_id)}</div>
      <div className="popup__body">
        <div className="popup__row">
          <span className="popup__key">Location</span>
          <span className="popup__val" style={{ fontFamily: 'var(--mono)', fontSize: '0.76rem' }}>
            {coords(row.latitude, row.longitude)}
          </span>
        </div>
        <div className="popup__row">
          <span className="popup__key">Type</span>
          <span className="popup__val">
            <span
              className="chip__dot"
              style={{
                background: TYPE_COLOR[row.type],
                display: 'inline-block',
                marginRight: 6,
              }}
            />
            {TYPE_LABEL[row.type]} · {row.class_label}
          </span>
        </div>
        <div className="popup__row">
          <span className="popup__key">Severity</span>
          <SeverityPill severity={row.severity} />
        </div>
        <div className="popup__row">
          <span className="popup__key">Status</span>
          <StatePill state={row.state} />
        </div>
        <div className="popup__row">
          <span className="popup__key">Source</span>
          <span className="popup__val">{SOURCE_LABEL[row.source] || row.source}</span>
        </div>
        <div className="popup__row">
          <span className="popup__key">Detected</span>
          <span className="popup__val">{dateTime(row.detected_at)}</span>
        </div>
        <div className="popup__row">
          <span className="popup__key">Confidence</span>
          <span className="popup__val">{pct(row.confidence)}</span>
        </div>
        <div className="popup__row">
          <span className="popup__key">Geotag</span>
          <span className="popup__val" style={{ fontFamily: 'var(--mono)', fontSize: '0.76rem' }}>
            {row.geo_source || '—'}
          </span>
        </div>
      </div>
      <div className="popup__foot">
        {row.state !== 'cleaned' && (
          <button className="btn btn--sm" onClick={() => onMarkCleaned(row.detection_id)}>
            Mark as cleaned
          </button>
        )}
        {row.report_id ? (
          <button className="btn btn--sm btn--ghost" onClick={() => onOpenReport(row.report_id)}>
            View report
          </button>
        ) : (
          <button className="btn btn--sm btn--ghost" onClick={() => onDispatch([row])}>
            Create report
          </button>
        )}
      </div>
    </div>
  )
}

function HotspotPopup({ spot, onGenerateReport, onFilterZone }) {
  return (
    <div className="popup">
      <div className="popup__head">Hotspot · {spot.zone}</div>
      <div className="popup__body">
        <div className="popup__row">
          <span className="popup__key">Detections</span>
          <span className="popup__val">{spot.total}</span>
        </div>

        <div>
          <span className="popup__key" style={{ fontSize: '0.72rem' }}>
            Severity mix
          </span>
          <div className="popup__bar">
            <StackBar
              height={6}
              data={[
                { key: 'high', label: 'High', value: spot.counts.high, color: SEVERITY_META.high.color },
                { key: 'medium', label: 'Medium', value: spot.counts.medium, color: SEVERITY_META.medium.color },
                { key: 'low', label: 'Low', value: spot.counts.low, color: SEVERITY_META.low.color },
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span>▲ {spot.counts.high} high</span>
            <span>◆ {spot.counts.medium} med</span>
            <span>● {spot.counts.low} low</span>
          </div>
        </div>

        <div style={{ marginTop: '0.3rem' }}>
          <span className="popup__key" style={{ fontSize: '0.72rem' }}>
            Top types
          </span>
          {spot.topTypes.slice(0, 3).map((t) => (
            <div className="popup__row" key={t.type}>
              <span
                className="chip__dot"
                style={{ background: TYPE_COLOR[t.type] }}
                aria-hidden="true"
              />
              <span className="popup__val" style={{ flex: 1 }}>
                {TYPE_LABEL[t.type]}
              </span>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {t.n} · {Math.round(t.pct * 100)}%
              </span>
            </div>
          ))}
        </div>

        <div className="popup__row" style={{ marginTop: '0.3rem' }}>
          <span className="popup__key">Cleanup</span>
          <span className="popup__val" style={{ fontSize: '0.76rem' }}>
            {spot.states.cleaned} done · {spot.states.in_progress} active ·{' '}
            {spot.states.uncleaned} open
          </span>
        </div>
      </div>
      <div className="popup__foot">
        <button className="btn btn--sm btn--primary" onClick={() => onGenerateReport(spot)}>
          Generate report
        </button>
        <button className="btn btn--sm btn--ghost" onClick={() => onFilterZone(spot.zone)}>
          Filter to zone
        </button>
      </div>
    </div>
  )
}

export default function MapView({
  rows,
  allRows,
  filters,
  onFilters,
  onMarkCleaned,
  onGenerateReport,
  onOpenReport,
  onOpenUpload,
  lastUpdated,
}) {
  const [basemap, setBasemap] = useState('dark')
  const [showHotspots, setShowHotspots] = useState(true)
  const [flyTarget, setFlyTarget] = useState(null)
  const [search, setSearch] = useState('')

  const points = useMemo(
    () => rows.filter((r) => r.latitude != null && r.longitude != null),
    [rows]
  )
  const spots = useMemo(() => hotspots(points), [points])

  const legendCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, cleaned: 0 }
    for (const r of points) {
      c[r.severity] = (c[r.severity] || 0) + 1
      if (r.state === 'cleaned') c.cleaned++
    }
    return c
  }, [points])

  const hotspotCount = spots.filter((s) => s.intensity !== 'low').length

  const runSearch = (e) => {
    e.preventDefault()
    const q = search.trim().toLowerCase()
    if (!q) return
    // Zone name first, then raw "lat, lon"
    const zone = spots.find((s) => s.zone.toLowerCase().includes(q))
    if (zone) {
      setFlyTarget(zone.center)
      return
    }
    const m = q.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/)
    if (m) setFlyTarget([parseFloat(m[1]), parseFloat(m[2])])
  }

  const center = points.length ? [points[0].latitude, points[0].longitude] : CHICAGO

  return (
    <>
      <div className="view-head">
        <h1 className="view-head__title">Map View</h1>
        <span className="view-head__crumb">
          Home › Live litter map
        </span>
        <div className="view-head__actions">
          <button className="btn btn--primary btn--sm" onClick={onOpenUpload}>
            + Ingest image
          </button>
        </div>
      </div>

      <div className="map-panel">
        <div className="map-toolbar">
          <form className="map-search" onSubmit={runSearch}>
            <input
              className="input"
              placeholder="Search zone or lat, lon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search address or zone"
            />
          </form>

          <div className="segmented" role="group" aria-label="Basemap">
            <button
              aria-pressed={basemap === 'dark'}
              onClick={() => setBasemap('dark')}
            >
              Street
            </button>
            <button
              aria-pressed={basemap === 'satellite'}
              onClick={() => setBasemap('satellite')}
            >
              Satellite
            </button>
          </div>

          <button
            className={`btn btn--sm ${showHotspots ? '' : 'btn--ghost'}`}
            onClick={() => setShowHotspots((v) => !v)}
            aria-pressed={showHotspots}
          >
            {showHotspots ? '◉' : '○'} Hotspot zones
          </button>

          {filters.zone && (
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => onFilters({ ...filters, zone: '' })}
            >
              ✕ {filters.zone}
            </button>
          )}
        </div>

        <div className="map-canvas">
          {points.length === 0 ? (
            <Empty icon="🗺" title="No geotagged detections in this view">
              Ingest an image, widen the date range, or clear filters. Detections appear here
              once the pipeline resolves coordinates from EXIF GPS, the browser Geolocation
              API, or the simulated fallback.
            </Empty>
          ) : (
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
              preferCanvas
            >
              {basemap === 'dark' ? (
                <TileLayer
                  className="tt-tiles"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}

              <FitBounds points={points} />
              <FlyTo target={flyTarget} />

              {showHotspots &&
                spots
                  .filter((s) => s.intensity !== 'low')
                  .map((s) => (
                    <Circle
                      key={s.zone}
                      center={s.center}
                      radius={s.radius}
                      pathOptions={{
                        color: INTENSITY[s.intensity],
                        fillColor: INTENSITY[s.intensity],
                        fillOpacity: s.intensity === 'high' ? 0.22 : 0.14,
                        weight: 1.5,
                      }}
                    >
                      <Popup>
                        <HotspotPopup
                          spot={s}
                          onGenerateReport={onGenerateReport}
                          onFilterZone={(zone) => onFilters({ ...filters, zone })}
                        />
                      </Popup>
                    </Circle>
                  ))}

              {points.map((r) => {
                const meta = SEVERITY_META[r.severity]
                const cleaned = r.state === 'cleaned'
                return (
                  <CircleMarker
                    key={r.detection_id}
                    center={[r.latitude, r.longitude]}
                    radius={cleaned ? 4 : 6}
                    pathOptions={{
                      color: HEX.surface,
                      // 2px surface ring so overlapping markers stay separable
                      weight: 2,
                      fillColor: cleaned ? HEX.muted : meta.color,
                      fillOpacity: cleaned ? 0.5 : 0.95,
                    }}
                  >
                    <Popup>
                      <DetectionPopup
                        row={r}
                        onMarkCleaned={onMarkCleaned}
                        onOpenReport={onOpenReport}
                        onDispatch={(items) =>
                          onGenerateReport({ zone: r.zone, items })
                        }
                      />
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          )}

          {points.length > 0 && (
            <div className="map-legend">
              <div className="map-legend__title">Legend</div>
              <div className="map-legend__row">
                <span
                  className="chip__dot"
                  style={{ background: SEVERITY_META.high.color }}
                  aria-hidden="true"
                />
                ▲ High severity
                <span className="map-legend__count">{legendCounts.high}</span>
              </div>
              <div className="map-legend__row">
                <span
                  className="chip__dot"
                  style={{ background: SEVERITY_META.medium.color }}
                  aria-hidden="true"
                />
                ◆ Medium
                <span className="map-legend__count">{legendCounts.medium}</span>
              </div>
              <div className="map-legend__row">
                <span
                  className="chip__dot"
                  style={{ background: SEVERITY_META.low.color }}
                  aria-hidden="true"
                />
                ● Low
                <span className="map-legend__count">{legendCounts.low}</span>
              </div>
              <div className="map-legend__row">
                <span
                  className="chip__dot"
                  style={{ background: HEX.muted, opacity: 0.6 }}
                  aria-hidden="true"
                />
                ✓ Cleaned
                <span className="map-legend__count">{legendCounts.cleaned}</span>
              </div>
              {showHotspots && (
                <div
                  className="map-legend__row"
                  style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      border: `1.5px solid ${INTENSITY.high}`,
                      background: 'rgba(208,59,59,0.22)',
                    }}
                    aria-hidden="true"
                  />
                  Hotspot zone (10+)
                  <span className="map-legend__count">{hotspotCount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="map-status">
          <span className="map-status__dot" aria-hidden="true" />
          Showing {points.length.toLocaleString()} of {allRows.length.toLocaleString()} detections
          {rows.length !== points.length && ` · ${rows.length - points.length} without coordinates`}
          <span style={{ marginLeft: 'auto' }}>
            Last updated {lastUpdated ? age(lastUpdated) : '—'} ago
          </span>
        </div>
      </div>
    </>
  )
}
