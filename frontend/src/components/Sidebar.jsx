import React from 'react'
import {
  DATE_RANGES,
  LITTER_TYPES,
  SEVERITIES,
  SOURCES,
  STATES,
  activeFilterCount,
  EMPTY_FILTERS,
} from '../lib/derive'

const VIEWS = [
  { key: 'map', label: 'Map View', icon: '🗺' },
  { key: 'list', label: 'List View', icon: '📋' },
  { key: 'analytics', label: 'Analytics', icon: '📊' },
  { key: 'reports', label: 'Reports', icon: '📝' },
]

/** Multi-select chip group: clicking toggles membership in `selected`. */
function ChipGroup({ label, options, selected, onChange, dots = false }) {
  const toggle = (key) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])

  return (
    <div className="filter-block">
      <span className="filter-block__label">{label}</span>
      <div className="chip-row">
        {options.map((o) => {
          const on = selected.includes(o.key)
          return (
            <button
              key={o.key}
              className={`chip ${on ? 'chip--on' : ''}`}
              onClick={() => toggle(o.key)}
              aria-pressed={on}
            >
              {dots && (
                <span
                  className="chip__dot"
                  style={{ background: o.color }}
                  aria-hidden="true"
                />
              )}
              {on && (
                <span className="chip__mark" aria-hidden="true">
                  ✓
                </span>
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Sidebar({
  view,
  onNavigate,
  filters,
  onFilters,
  counts,
  zones,
  open,
  onClose,
}) {
  const set = (patch) => onFilters({ ...filters, ...patch })
  const active = activeFilterCount(filters)

  return (
    <>
      {open && <div className="sidebar__backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="side-group">
          <div className="side-group__title">Views</div>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className={`side-link ${view === v.key ? 'side-link--active' : ''}`}
              onClick={() => {
                onNavigate(v.key)
                onClose()
              }}
            >
              <span className="side-link__icon" aria-hidden="true">
                {v.icon}
              </span>
              {v.label}
              {counts[v.key] != null && (
                <span className="side-link__count">{counts[v.key].toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>

        <div className="side-group">
          <div className="side-group__title">
            Filters
            {active > 0 && <span className="badge">{active}</span>}
          </div>

          <div className="filter-block">
            <label className="filter-block__label" htmlFor="f-range">
              Date range
            </label>
            <select
              id="f-range"
              className="select"
              value={filters.range}
              onChange={(e) => set({ range: e.target.value })}
            >
              {DATE_RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <ChipGroup
            label="Severity"
            options={SEVERITIES}
            selected={filters.severity}
            onChange={(v) => set({ severity: v })}
            dots
          />

          <ChipGroup
            label="Litter type"
            options={LITTER_TYPES}
            selected={filters.types}
            onChange={(v) => set({ types: v })}
            dots
          />

          <ChipGroup
            label="Source"
            options={SOURCES}
            selected={filters.sources}
            onChange={(v) => set({ sources: v })}
          />

          <ChipGroup
            label="Status"
            options={STATES}
            selected={filters.states}
            onChange={(v) => set({ states: v })}
          />

          <div className="filter-block">
            <label className="filter-block__label" htmlFor="f-zone">
              Zone / district
            </label>
            <select
              id="f-zone"
              className="select"
              value={filters.zone}
              onChange={(e) => set({ zone: e.target.value })}
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.zone} ({z.total})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => onFilters({ ...EMPTY_FILTERS })}
              disabled={active === 0}
            >
              Reset filters
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
