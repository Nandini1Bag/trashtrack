import React from 'react'

const dot = (color) => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color,
  marginRight: 6,
})

const wrap = {
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginTop: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
}

export default function GeoStatus({ status, coords }) {
  if (status === 'granted' && coords) {
    return (
      <div style={wrap}>
        <span style={dot('var(--green)')} />
        Browser location active — ({coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}).
        Used when photos lack EXIF GPS.
      </div>
    )
  }
  if (status === 'denied') {
    return (
      <div style={wrap}>
        <span style={dot('var(--amber)')} />
        Location denied — will use simulated coordinates for photos without EXIF GPS.
      </div>
    )
  }
  if (status === 'unavailable') {
    return (
      <div style={wrap}>
        <span style={dot('var(--text-muted)')} />
        Geolocation API unavailable in this browser.
      </div>
    )
  }
  if (status === 'requesting') {
    return (
      <div style={wrap}>
        <span style={dot('var(--amber)')} />
        Requesting location access…
      </div>
    )
  }
  return null
}
