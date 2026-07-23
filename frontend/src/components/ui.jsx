/** Small shared primitives used across every view. */
import React, { useEffect } from 'react'
import { SEVERITY_META } from '../lib/derive'
import { signedPct } from '../lib/format'

/**
 * Severity pill. Severity is a *status*, so it always ships icon + text label --
 * the color never carries the meaning alone.
 */
export function SeverityPill({ severity }) {
  const meta = SEVERITY_META[severity]
  if (!meta) return <span className="pill pill--neutral">—</span>
  return (
    <span className="pill" style={{ background: meta.wash, color: meta.color }}>
      <span className="pill__icon" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  )
}

const STATE_STYLE = {
  cleaned: { icon: '✓', label: 'Cleaned', color: 'var(--status-good)', wash: 'var(--status-good-wash)' },
  in_progress: { icon: '◐', label: 'In Progress', color: 'var(--status-warning)', wash: 'var(--status-warning-wash)' },
  uncleaned: { icon: '○', label: 'Uncleaned', color: 'var(--text-secondary)', wash: 'var(--surface-hover)' },
}

export function StatePill({ state }) {
  const s = STATE_STYLE[state] || STATE_STYLE.uncleaned
  return (
    <span className="pill" style={{ background: s.wash, color: s.color }}>
      <span className="pill__icon" aria-hidden="true">
        {s.icon}
      </span>
      {s.label}
    </span>
  )
}

const REPORT_STYLE = {
  acknowledged: { icon: '✓', label: "Ack'd", color: 'var(--status-good)', wash: 'var(--status-good-wash)' },
  submitted: { icon: '✉', label: 'Sent', color: 'var(--ramp-1)', wash: 'rgba(57,135,229,0.15)' },
  generated: { icon: '◷', label: 'Pending', color: 'var(--status-warning)', wash: 'var(--status-warning-wash)' },
  failed: { icon: '✕', label: 'Failed', color: 'var(--status-critical)', wash: 'var(--status-critical-wash)' },
}

export function ReportStatusPill({ status }) {
  const s = REPORT_STYLE[status] || REPORT_STYLE.generated
  return (
    <span className="pill" style={{ background: s.wash, color: s.color }}>
      <span className="pill__icon" aria-hidden="true">
        {s.icon}
      </span>
      {s.label}
    </span>
  )
}

/**
 * Stat tile. `delta` is a fraction; `deltaGoodWhenUp` says whether a rise is
 * good news -- more litter detected is not, a higher cleanup rate is.
 */
export function StatTile({ label, value, unit, delta, deltaGoodWhenUp = true, foot, tone }) {
  const d = signedPct(delta)
  const good = d ? (d.up ? deltaGoodWhenUp : !deltaGoodWhenUp) : null

  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="tile__unit">{unit}</span>}
      </span>
      <span className="tile__foot">
        {d && (
          <span className={good ? 'tile__delta--up' : 'tile__delta--down'}>{d.text}</span>
        )}
        {foot}
      </span>
    </div>
  )
}

export function Panel({ title, badge, actions, children, flush = false, className = '' }) {
  return (
    <section className={`panel ${flush ? 'panel--flush' : ''} ${className}`.trim()}>
      {(title || actions) && (
        <header className="panel__head" style={flush ? { padding: '0.9rem 1rem 0' } : undefined}>
          {title && <h2 className="panel__title">{title}</h2>}
          {badge != null && <span className="badge">{badge}</span>}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Empty({ icon = '🗺', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
      {action}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`modal ${wide ? 'modal--wide' : ''}`.trim()}>
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

/** Legend for >= 2 series, so identity is never carried by color alone. */
export function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li className="legend__item" key={it.label}>
          <span className="legend__swatch" style={{ background: it.color }} aria-hidden="true" />
          {it.label}
          {it.value != null && (
            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {it.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function KV({ label, children }) {
  return (
    <div>
      <div className="kv__key">{label}</div>
      <div className="kv__val">{children}</div>
    </div>
  )
}
