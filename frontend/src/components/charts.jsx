/**
 * Charts, hand-rolled in SVG.
 *
 * Deliberately dependency-free: the app ships four npm packages and none of
 * these forms needs a charting library. Conventions held throughout --
 *   - 2px lines, >=8px hover markers, 4px rounded data-ends on the value side
 *     only (bars stay anchored to their baseline)
 *   - 2px surface gap between adjacent fills
 *   - recessive grid/axes; text wears ink tokens, never the series color
 *   - every chart has a hover layer; every multi-series chart has a legend
 *
 * Colors here are real hex, NOT `var(--token)`: CSS custom properties do not
 * resolve inside SVG presentation attributes. INK mirrors index.css -- keep the
 * two in sync.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

const INK = {
  primary: '#e1e4e8',
  secondary: '#b6bec7',
  muted: '#8b949e',
  grid: '#2c3238',
  axis: '#3a424b',
  surface: '#1a1f25',
  border: '#3d4753',
}

const AXIS_FONT = 11

// --- responsive width -------------------------------------------------------
function useWidth(ref, fallback = 480) {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (next > 0) setW(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// --- shared tooltip ---------------------------------------------------------
function useTooltip() {
  const [tip, setTip] = useState(null)
  const show = useCallback((e, content) => {
    setTip({ x: e.clientX, y: e.clientY, content })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  return { tip, show, hide }
}

function Tooltip({ tip }) {
  if (!tip) return null
  // Flip to the left of the cursor near the right edge so it never clips.
  const flip = tip.x > window.innerWidth - 200
  return (
    <div
      className="tooltip"
      style={{
        left: flip ? tip.x - 14 : tip.x + 14,
        top: tip.y - 12,
        transform: flip ? 'translateX(-100%)' : undefined,
      }}
    >
      {tip.content}
    </div>
  )
}

function Swatch({ color }) {
  return <span className="legend__swatch" style={{ background: color }} aria-hidden="true" />
}

/** Rounded rect path with the radius applied to one side only. */
function barPath(x, y, w, h, r, side) {
  const rr = Math.max(0, Math.min(r, side === 'right' ? w : h, side === 'right' ? h / 2 : w / 2))
  if (rr <= 0.5) return `M${x},${y}h${w}v${h}h${-w}z`
  if (side === 'right') {
    return `M${x},${y}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - 2 * rr}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-(w - rr)}z`
  }
  // 'top'
  return `M${x},${y + h}v${-(h - rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - rr}z`
}

// ===========================================================================
// Line chart -- change over time. Single series, so no legend box: the panel
// title names it. Crosshair + tooltip on hover.
// ===========================================================================
export function LineChart({ data, height = 190, color = '#3987e5', label = 'Detections' }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const { tip, show, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState(null)

  const pad = { top: 12, right: 12, bottom: 24, left: 34 }
  const iw = Math.max(10, width - pad.left - pad.right)
  const ih = Math.max(10, height - pad.top - pad.bottom)

  if (!data.length) return <div ref={wrapRef} style={{ height }} />

  const max = Math.max(1, ...data.map((d) => d.value))
  // Round the top tick up to something human.
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 60 ? 10 : Math.ceil(max / 4 / 10) * 10
  const top = Math.ceil(max / step) * step

  const x = (i) => pad.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v) => pad.top + ih - (v / top) * ih

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join('')
  const area = `${line}L${x(data.length - 1)},${pad.top + ih}L${x(0)},${pad.top + ih}Z`

  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left - pad.left
    const i = Math.round((px / iw) * (data.length - 1))
    const idx = Math.max(0, Math.min(data.length - 1, i))
    setHoverIdx(idx)
    const d = data[idx]
    show(
      e,
      <>
        <div className="tooltip__title">
          {new Date(d.date).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </div>
        <div className="tooltip__row">
          <Swatch color={color} />
          {label}: {d.value}
        </div>
      </>
    )
  }

  const gradId = 'ttLineFill'

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        className="chart"
        width={width}
        height={height}
        role="img"
        aria-label={`${label} over time`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          hide()
          setHoverIdx(null)
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={pad.left + iw}
              y1={y(v)}
              y2={y(v)}
              stroke={INK.grid}
              strokeWidth="1"
            />
            <text
              x={pad.left - 7}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize={AXIS_FONT}
              fill={INK.muted}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {v}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hoverIdx != null && (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={pad.top}
              y2={pad.top + ih}
              stroke={INK.border}
              strokeWidth="1"
            />
            {/* 2px surface ring keeps the marker legible over the line */}
            <circle
              cx={x(hoverIdx)}
              cy={y(data[hoverIdx].value)}
              r="5"
              fill={color}
              stroke={INK.surface}
              strokeWidth="2"
            />
          </g>
        )}

        {[0, Math.floor(data.length / 2), data.length - 1].map((i, n) => (
          <text
            key={n}
            x={x(i)}
            y={height - 7}
            textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}
            fontSize={AXIS_FONT}
            fill={INK.muted}
          >
            {new Date(data[i].date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </text>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

// ===========================================================================
// Horizontal bars -- magnitude + identity across a handful of categories.
//
// The reference design shows a pie here. Bars are used instead: with 5 slices
// a pie makes ranking and comparison guesswork, and the reference's own legend
// already lists exactly the values a bar chart labels directly on the mark.
// ===========================================================================
export function BarsH({ data, height, showValues = true, ariaLabel = 'Distribution' }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const { tip, show, hide } = useTooltip()

  const rowH = 30
  const gap = 8
  const h = height || data.length * (rowH + gap) + 6
  const labelW = 74
  const valueW = showValues ? 76 : 8
  const trackW = Math.max(20, width - labelW - valueW)

  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg className="chart" width={width} height={h} role="img" aria-label={ariaLabel}>
        {data.map((d, i) => {
          const y = i * (rowH + gap)
          const bw = d.value > 0 ? Math.max(3, (d.value / max) * trackW) : 0
          return (
            <g
              key={d.key ?? d.label}
              onMouseMove={(e) =>
                show(
                  e,
                  <>
                    <div className="tooltip__title">{d.label}</div>
                    <div className="tooltip__row">
                      <Swatch color={d.color} />
                      {d.value.toLocaleString()}
                      {total > 0 && ` · ${((d.value / total) * 100).toFixed(1)}%`}
                    </div>
                  </>
                )
              }
              onMouseLeave={hide}
            >
              {/* full-row hit target, bigger than the mark itself */}
              <rect x="0" y={y} width={Math.max(1, width)} height={rowH} fill="transparent" />
              <text x="0" y={y + rowH / 2 + 4} fontSize="12" fill={INK.secondary}>
                {d.label}
              </text>
              <rect
                x={labelW}
                y={y + 7}
                width={trackW}
                height={rowH - 14}
                rx="4"
                fill={INK.grid}
                opacity="0.55"
              />
              {bw > 0 && <path d={barPath(labelW, y + 7, bw, rowH - 14, 4, 'right')} fill={d.color} />}
              {showValues && (
                <text
                  x={width}
                  y={y + rowH / 2 + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill={INK.primary}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {d.value.toLocaleString()}
                  <tspan fill={INK.muted}>
                    {total > 0 ? `  ${Math.round((d.value / total) * 100)}%` : ''}
                  </tspan>
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

// ===========================================================================
// Vertical bars on an ordinal ramp (one hue, monotone lightness).
// ===========================================================================
export function BarsV({ data, height = 175, ariaLabel = 'Distribution' }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const { tip, show, hide } = useTooltip()

  const pad = { top: 20, right: 6, bottom: 36, left: 8 }
  const iw = Math.max(10, width - pad.left - pad.right)
  const ih = Math.max(10, height - pad.top - pad.bottom)
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((s, d) => s + d.value, 0)

  const slot = iw / Math.max(1, data.length)
  // 2px+ surface gap between adjacent fills
  const bw = Math.max(6, Math.min(64, slot - 16))

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg className="chart" width={width} height={height} role="img" aria-label={ariaLabel}>
        <line
          x1={pad.left}
          x2={pad.left + iw}
          y1={pad.top + ih}
          y2={pad.top + ih}
          stroke={INK.axis}
          strokeWidth="1"
        />
        {data.map((d, i) => {
          const bh = (d.value / max) * ih
          const x = pad.left + i * slot + (slot - bw) / 2
          const y = pad.top + ih - bh
          return (
            <g
              key={d.key ?? d.label}
              onMouseMove={(e) =>
                show(
                  e,
                  <>
                    <div className="tooltip__title">{d.label}</div>
                    <div className="tooltip__row">
                      <Swatch color={d.color} />
                      {d.value.toLocaleString()}
                      {total > 0 && ` · ${Math.round((d.value / total) * 100)}%`}
                    </div>
                  </>
                )
              }
              onMouseLeave={hide}
            >
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={ih} fill="transparent" />
              {bh > 0 && <path d={barPath(x, y, bw, bh, 4, 'top')} fill={d.color} />}
              <text
                x={x + bw / 2}
                y={Math.max(12, y - 6)}
                textAnchor="middle"
                fontSize="11.5"
                fill={INK.primary}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '0%'}
              </text>
              <text
                x={x + bw / 2}
                y={height - 15}
                textAnchor="middle"
                fontSize={AXIS_FONT}
                fill={INK.muted}
              >
                {d.label}
              </text>
              <text
                x={x + bw / 2}
                y={height - 3}
                textAnchor="middle"
                fontSize={AXIS_FONT}
                fill={INK.muted}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {d.value.toLocaleString()}
              </text>
            </g>
          )
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

/**
 * Single stacked proportion bar -- for a 2-4 part whole where the parts sum to
 * something meaningful (severity mix, cleanup state). 2px surface gaps.
 * Plain DOM, so CSS custom properties are fine here.
 */
export function StackBar({ data, height = 14, radius = 4 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) {
    return (
      <div
        style={{ height, borderRadius: radius, background: INK.grid, opacity: 0.6 }}
        aria-hidden="true"
      />
    )
  }
  return (
    <div style={{ display: 'flex', gap: 2, height, borderRadius: radius, overflow: 'hidden' }}>
      {data
        .filter((d) => d.value > 0)
        .map((d) => (
          <div
            key={d.key ?? d.label}
            title={`${d.label}: ${d.value}`}
            style={{ flex: d.value, background: d.color }}
          />
        ))}
    </div>
  )
}
