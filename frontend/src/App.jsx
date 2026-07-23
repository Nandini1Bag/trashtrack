import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import UploadModal from './components/UploadModal'
import MapView from './views/MapView'
import ListView from './views/ListView'
import AnalyticsView from './views/AnalyticsView'
import ReportsView from './views/ReportsView'
import SettingsView from './views/SettingsView'
import { EMPTY_FILTERS, applyFilters, hotspots, toRows } from './lib/derive'
import {
  buildReport,
  clearAll,
  loadReports,
  loadRows,
  nextReportId,
  saveReports,
  saveRows,
} from './lib/store'
import { generateSample, generateSampleReports } from './lib/sample'
import './App.css'

const API = '/api'
const ENDPOINT_KEY = 'trashtrack.endpoint.v1'
const CREWS = ['Team Alpha', 'Team Bravo', 'Team Charlie']

export default function App() {
  const [rows, setRows] = useState(() => loadRows())
  const [reports, setReports] = useState(() => loadReports())
  const [view, setView] = useState('map')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openReportId, setOpenReportId] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString())
  const [endpoint, setEndpoint] = useState(
    () => localStorage.getItem(ENDPOINT_KEY) || 'https://civic-api.city.gov/reports'
  )

  // upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // browser geolocation, requested once
  const [browserCoords, setBrowserCoords] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable')
      return
    }
    setGeoStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBrowserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoStatus('granted')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // persist
  useEffect(() => saveRows(rows), [rows])
  useEffect(() => saveReports(reports), [reports])
  useEffect(() => localStorage.setItem(ENDPOINT_KEY, endpoint), [endpoint])

  // --- derived data ---------------------------------------------------------
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const zones = useMemo(() => hotspots(rows), [rows])
  const hasSample = rows.some((r) => r.sample)

  const alerts = useMemo(
    () => rows.filter((r) => r.severity === 'high' && r.state !== 'cleaned').length,
    [rows]
  )

  const sidebarCounts = useMemo(
    () => ({
      map: filtered.filter((r) => r.latitude != null).length,
      list: filtered.length,
      reports: reports.length,
    }),
    [filtered, reports]
  )

  // --- navigation -----------------------------------------------------------
  const navigate = useCallback((next, filterPatch) => {
    setView(next)
    setOpenReportId(null)
    setSidebarOpen(false)
    if (filterPatch) setFilters((f) => ({ ...f, ...filterPatch }))
  }, [])

  // --- ingest ---------------------------------------------------------------
  const ingest = useCallback(
    async (file, { source }) => {
      if (!file) return
      setLoading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        if (browserCoords) {
          form.append('browser_lat', String(browserCoords.lat))
          form.append('browser_lon', String(browserCoords.lon))
        }
        const res = await fetch(`${API}/ingest`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(`Server responded ${res.status}. Is the API running on :8000?`)
        const data = await res.json()
        setResult(data)

        const newRows = toRows(data, { source })
        if (newRows.length) {
          setRows((prev) => [...newRows, ...prev])
          setLastUpdated(new Date().toISOString())
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [browserCoords]
  )

  const closeUpload = useCallback(() => {
    setUploadOpen(false)
    setResult(null)
    setError(null)
  }, [])

  // --- detection actions ----------------------------------------------------
  const markCleaned = useCallback((detectionId) => {
    const now = new Date().toISOString()
    setRows((prev) =>
      prev.map((r) =>
        r.detection_id === detectionId
          ? { ...r, state: 'cleaned', cleaned_at: now, crew: r.crew || CREWS[0] }
          : r
      )
    )
  }, [])

  // --- reports --------------------------------------------------------------
  const generateReport = useCallback((arg) => {
    // Accepts a hotspot ({zone, items}) or an explicit {zone, items} selection.
    const list = arg.items || []
    const zone = arg.zone || list[0]?.zone || 'Unzoned'
    if (!list.length) return

    setReports((prev) => {
      const id = nextReportId(prev)
      const crew = list.find((r) => r.crew)?.crew || CREWS[0]
      const report = buildReport(id, list, { zone, crew })
      setRows((rprev) =>
        rprev.map((r) =>
          report.detection_ids.includes(r.detection_id) && !r.report_id
            ? { ...r, report_id: id, report_status: 'generated' }
            : r
        )
      )
      setOpenReportId(id)
      setView('reports')
      return [report, ...prev]
    })
  }, [])

  const submitReport = useCallback(
    (id) => {
      const now = new Date().toISOString()
      setReports((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'submitted', submitted_at: now, endpoint } : r
        )
      )
    },
    [endpoint]
  )

  const acknowledgeReport = useCallback((id) => {
    const now = new Date().toISOString()
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'acknowledged',
              acknowledged_at: now,
              civic_ack_id: r.civic_ack_id || `${Math.floor(1000 + Math.random() * 8999)}-A-2026`,
            }
          : r
      )
    )
  }, [])

  const openReport = useCallback((id) => {
    setOpenReportId(id)
    if (id) setView('reports')
  }, [])

  // --- sample data ----------------------------------------------------------
  const loadSample = useCallback(() => {
    const sample = generateSample()
    const sampleReports = generateSampleReports(sample)
    setRows((prev) => [...sample, ...prev.filter((r) => !r.sample)])
    setReports((prev) => [...sampleReports, ...prev.filter((r) => !r.sample)])
    setLastUpdated(new Date().toISOString())
  }, [])

  const clearData = useCallback(() => {
    if (!window.confirm('Clear all local detections and reports? This cannot be undone.')) return
    clearAll()
    setRows([])
    setReports([])
    setOpenReportId(null)
  }, [])

  // --- render ---------------------------------------------------------------
  const renderView = () => {
    switch (view) {
      case 'list':
        return (
          <ListView
            rows={filtered}
            allRows={rows}
            filters={filters}
            onFilters={setFilters}
            onMarkCleaned={markCleaned}
            onGenerateReport={generateReport}
            onOpenUpload={() => setUploadOpen(true)}
          />
        )
      case 'analytics':
        return (
          <AnalyticsView rows={filtered} allRows={rows} filters={filters} onFilters={setFilters} />
        )
      case 'reports':
        return (
          <ReportsView
            reports={reports}
            rows={rows}
            onSubmit={submitReport}
            onAcknowledge={acknowledgeReport}
            onArchive={() => {}}
            openReportId={openReportId}
            onOpenReport={openReport}
          />
        )
      case 'settings':
        return (
          <SettingsView
            rows={rows}
            reports={reports}
            endpoint={endpoint}
            onEndpoint={setEndpoint}
            onLoadSample={loadSample}
            onClear={clearData}
            hasSample={hasSample}
          />
        )
      default:
        return (
          <MapView
            rows={filtered}
            allRows={rows}
            filters={filters}
            onFilters={setFilters}
            onMarkCleaned={markCleaned}
            onGenerateReport={generateReport}
            onOpenReport={openReport}
            onOpenUpload={() => setUploadOpen(true)}
            lastUpdated={lastUpdated}
          />
        )
    }
  }

  return (
    <div className="app">
      <Navbar
        view={view}
        onNavigate={navigate}
        alerts={alerts}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="shell">
        <Sidebar
          view={view}
          onNavigate={navigate}
          filters={filters}
          onFilters={setFilters}
          counts={sidebarCounts}
          zones={zones}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="content">
          {hasSample && (
            <div className="banner banner--sample">
              <span aria-hidden="true">⚠</span>
              Showing synthetic sample data for demonstration. Real ingests are kept alongside it.
              <div className="banner__actions">
                <button className="btn btn--sm" onClick={() => navigate('settings')}>
                  Manage in Settings
                </button>
              </div>
            </div>
          )}
          {renderView()}
        </main>
      </div>

      {/* Mobile bottom tabs mirror the spec's phone wireframe */}
      <nav className="tabbar">
        <button aria-current={view === 'map'} onClick={() => navigate('map')}>
          <span className="tabbar__icon">🗺</span>
          Map
        </button>
        <button aria-current={view === 'list'} onClick={() => navigate('list')}>
          <span className="tabbar__icon">📋</span>
          List
        </button>
        <button onClick={() => setUploadOpen(true)}>
          <span className="tabbar__icon">＋</span>
          Ingest
        </button>
        <button aria-current={view === 'analytics'} onClick={() => navigate('analytics')}>
          <span className="tabbar__icon">📊</span>
          Stats
        </button>
        <button aria-current={view === 'reports'} onClick={() => navigate('reports')}>
          <span className="tabbar__icon">📝</span>
          Reports
        </button>
      </nav>

      {uploadOpen && (
        <UploadModal
          onClose={closeUpload}
          onIngest={ingest}
          loading={loading}
          result={result}
          error={error}
          geoStatus={geoStatus}
          browserCoords={browserCoords}
        />
      )}
    </div>
  )
}
