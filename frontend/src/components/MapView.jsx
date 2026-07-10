import React from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SEVERITY_COLOR = { high: '#e4572e', medium: '#d29922', low: '#3fb950' }

function makeIcon(severity) {
  const color = SEVERITY_COLOR[severity] || '#0e9aa7'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px; height:14px; border-radius:50%;
      background:${color}; border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

const empty = {
  height: 300,
  borderRadius: 6,
  background: 'var(--bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
}

export default function MapView({ detections }) {
  const pts = detections.filter((d) => d.latitude != null && d.longitude != null)

  if (pts.length === 0) {
    return <div style={empty}>Upload and detect to see markers here</div>
  }

  const center = [
    pts.reduce((s, d) => s + d.latitude, 0) / pts.length,
    pts.reduce((s, d) => s + d.longitude, 0) / pts.length,
  ]

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: 340, borderRadius: 6 }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pts.map((d, i) => (
        <Marker key={d.detection_id || i} position={[d.latitude, d.longitude]}
                icon={makeIcon(d.severity)}>
          <Popup>
            <strong>{d.class_label}</strong> — {(d.confidence * 100).toFixed(0)}%
            <br />
            Source: <code>{d.geo_source}</code>
            <br />
            {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
