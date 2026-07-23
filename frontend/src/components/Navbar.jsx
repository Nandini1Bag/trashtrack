import React from 'react'

const LINKS = [
  { key: 'map', label: 'Home' },
  { key: 'reports', label: 'Reports' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
]

export default function Navbar({ view, onNavigate, alerts, onToggleSidebar }) {
  return (
    <header className="navbar">
      <button
        className="navbar__burger"
        onClick={onToggleSidebar}
        aria-label="Toggle filters and views"
      >
        ☰
      </button>

      <div className="navbar__brand">
        <span className="navbar__logo" aria-hidden="true">
          🗑
        </span>
        TrashTrack
      </div>

      <nav className="navbar__links">
        {LINKS.map((l) => (
          <button
            key={l.key}
            className={`navbar__link ${
              view === l.key || (l.key === 'map' && view === 'list') ? 'navbar__link--active' : ''
            }`}
            onClick={() => onNavigate(l.key)}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <div className="navbar__spacer" />

      <button
        className={`navbar__alerts ${alerts ? '' : 'navbar__alerts--quiet'}`}
        onClick={() => onNavigate('list', { severity: ['high'], states: ['uncleaned'] })}
        title={
          alerts
            ? `${alerts} high-severity detections still uncleaned`
            : 'No high-severity detections awaiting response'
        }
      >
        <span aria-hidden="true">🔔</span>
        {alerts ? `${alerts} alerts` : 'No alerts'}
      </button>
    </header>
  )
}
