import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import UploadPanel from './components/UploadPanel'
import DetectionCanvas from './components/DetectionCanvas'
import MapView from './components/MapView'
import ReportsTable from './components/ReportsTable'
import GeoStatus from './components/GeoStatus'
import './App.css'

const API = '/api'

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [browserCoords, setBrowserCoords] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | requesting | granted | denied | unavailable

  // Request browser geolocation on mount
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

  const handleFileSelect = useCallback((f) => {
    setFile(f)
    setResult(null)
    setError(null)
    if (f) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      if (browserCoords) {
        form.append('browser_lat', browserCoords.lat.toString())
        form.append('browser_lon', browserCoords.lon.toString())
      }
      const res = await fetch(`${API}/ingest`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [file, browserCoords])

  const detections = result?.detections || []
  const reports = result?.reports || []
  const hasResults = detections.length > 0

  return (
    <>
      <Header />
      <main className="main">
        <section className="panel upload-section">
          <UploadPanel
            onFileSelect={handleFileSelect}
            onUpload={handleUpload}
            loading={loading}
            hasFile={!!file}
          />
          <GeoStatus status={geoStatus} coords={browserCoords} />
          {error && <p className="error-msg">⚠ {error}</p>}
        </section>

        {(preview || hasResults) && (
          <section className="panel results-section">
            <div className="results-grid">
              <div className="result-card">
                <h3>
                  Detection
                  {result && (
                    <span className="badge">
                      {detections.length} object{detections.length !== 1 && 's'}
                    </span>
                  )}
                </h3>
                {preview && (
                  <DetectionCanvas
                    imageSrc={preview}
                    detections={detections}
                  />
                )}
              </div>

              <div className="result-card">
                <h3>Map</h3>
                <MapView detections={detections} />
              </div>
            </div>
          </section>
        )}

        {reports.length > 0 && (
          <section className="panel">
            <h3>
              Reports
              <span className="badge">{reports.length}</span>
            </h3>
            <ReportsTable reports={reports} detections={detections} />
          </section>
        )}
      </main>
    </>
  )
}
