import React, { useRef, useState } from 'react'
import { SOURCES } from '../lib/derive'
import { pct } from '../lib/format'
import { Modal } from './ui'
import DetectionCanvas from './DetectionCanvas'

const GEO_DOT = {
  granted: 'var(--status-good)',
  requesting: 'var(--status-warning)',
  denied: 'var(--status-warning)',
  unavailable: 'var(--text-muted)',
  idle: 'var(--text-muted)',
}

function GeoLine({ status, coords }) {
  const text = {
    granted: coords
      ? `Browser location active (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}) — used when a photo has no EXIF GPS.`
      : 'Browser location active.',
    requesting: 'Requesting location access…',
    denied: 'Location denied — detections without EXIF GPS fall back to simulated coordinates.',
    unavailable: 'Geolocation unavailable in this browser — simulated fallback will be used.',
    idle: '',
  }[status]
  if (!text) return null
  return (
    <div className="geo-status">
      <span className="geo-status__dot" style={{ background: GEO_DOT[status] }} aria-hidden="true" />
      {text}
    </div>
  )
}

export default function UploadModal({
  onClose,
  onIngest,
  loading,
  result,
  error,
  geoStatus,
  browserCoords,
}) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [source, setSource] = useState('photo')
  const [dragging, setDragging] = useState(false)

  const accept = (f) => {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const detections = result?.detections || []

  return (
    <Modal
      title="Ingest image"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            className="btn btn--primary"
            disabled={!file || loading}
            onClick={() => onIngest(file, { source })}
          >
            {loading ? 'Detecting…' : result ? 'Re-run detection' : 'Run detection'}
          </button>
        </>
      }
    >
      <div
        className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          accept(e.dataTransfer.files?.[0])
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => accept(e.target.files?.[0])}
        />
        {file ? (
          <span className="dropzone__name">{file.name}</span>
        ) : (
          <>
            Drop an image here or click to browse
            <br />
            <span style={{ fontSize: '0.78rem' }}>street photo · dashcam frame · drone shot</span>
          </>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="src">
            Capture source
          </label>
          <select id="src" className="select" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <GeoLine status={geoStatus} coords={browserCoords} />

      {error && <div className="banner banner--error">⚠ {error}</div>}

      {preview && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="panel__title">Detection preview</span>
            {result && (
              <span className="badge">
                {detections.length} object{detections.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <DetectionCanvas imageSrc={preview} detections={detections} />
          {result && detections.length === 0 && (
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              No detections returned. This is expected with stock YOLOv8n weights — fine-tuning
              on TACO closes the gap (see project plan, target mAP@0.5 ≥ 0.65).
            </p>
          )}
          {result && detections.length > 0 && (
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              Added {detections.length} detection{detections.length !== 1 ? 's' : ''} to the
              dashboard · mean confidence{' '}
              {pct(detections.reduce((s, d) => s + d.confidence, 0) / detections.length)}.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
