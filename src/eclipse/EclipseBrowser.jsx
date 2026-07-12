import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useEventPins, toEvent } from './eventPins'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function typeFamily(t) { return t?.[0] ?? 'P' }

function yearFromDate(s) {
  if (!s) return 0
  const neg = s.startsWith('-')
  const y = parseInt((neg ? s.slice(1) : s).split('-')[0], 10)
  return neg ? -y : y
}

function formatDate(s) {
  if (!s) return ''
  const neg = s.startsWith('-')
  const [y, m, d] = (neg ? s.slice(1) : s).split('-')
  const yr = parseInt(y, 10)
  return `${MONTHS[parseInt(m,10)-1]} ${parseInt(d,10)}, ${neg ? yr + ' BCE' : yr}`
}

function formatDur(s) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m ? `${m}m${String(sec).padStart(2,'0')}s` : `${sec}s`
}

function formatDurLabel(s) {
  if (s === 0) return '0s'
  return formatDur(s)
}

function formatYearLabel(y) {
  if (y === 0) return '0'
  return y < 0 ? `${-y} BCE` : `${y}`
}

// ── Duration config per kind ──────────────────────────────────────────────────

// Solar durations are in seconds (max annular ~743s).
// Lunar total durations are also stored in seconds but can reach ~112 min,
// so we display/input in minutes and convert when filtering.
const DUR_CFG = {
  solar: { max: 750,  step: 5,  unit: 's',   toSec: v => v      },
  lunar: { max: 112,  step: 1,  unit: 'min', toSec: v => v * 60 },
}

export function RangeSlider({ min, max, low, high, onChange, formatLabel, step = 1, unit = '' }) {
  const [lowText,  setLowText]  = useState(String(low))
  const [highText, setHighText] = useState(String(high))

  // Keep text in sync when slider moves
  useEffect(() => setLowText(String(low)),  [low])
  useEffect(() => setHighText(String(high)), [high])

  const commitLow = useCallback((raw) => {
    const v = Math.round(Math.max(min, Math.min(Number(raw), high - step)) / step) * step
    if (isFinite(v)) onChange([v, high])
    else setLowText(String(low))
  }, [min, high, step, low, onChange])

  const commitHigh = useCallback((raw) => {
    const v = Math.round(Math.min(max, Math.max(Number(raw), low + step)) / step) * step
    if (isFinite(v)) onChange([low, v])
    else setHighText(String(high))
  }, [max, low, step, high, onChange])

  const lowPct  = ((low  - min) / (max - min)) * 100
  const highPct = ((high - min) / (max - min)) * 100

  return (
    <div className="rs-wrap">
      <div className="rs-area">
        <div className="rs-track-bg">
          <div className="rs-track-fill" style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }} />
        </div>
        <input className="rs-thumb" type="range" min={min} max={max} step={step} value={low}
          onChange={e => onChange([Math.min(+e.target.value, high - step), high])} />
        <input className="rs-thumb" type="range" min={min} max={max} step={step} value={high}
          onChange={e => onChange([low, Math.max(+e.target.value, low + step)])} />
      </div>
      <div className="rs-labels">
        <span className="rs-input-wrap">
          <input className="rs-text-input" type="number" value={lowText}
            onChange={e => setLowText(e.target.value)}
            onBlur={() => commitLow(lowText)}
            onKeyDown={e => e.key === 'Enter' && commitLow(lowText)}
          />
          {unit && <span className="rs-unit">{unit}</span>}
        </span>
        <span className="rs-dash">–</span>
        <span className="rs-input-wrap">
          <input className="rs-text-input" type="number" value={highText}
            onChange={e => setHighText(e.target.value)}
            onBlur={() => commitHigh(highText)}
            onKeyDown={e => e.key === 'Enter' && commitHigh(highText)}
          />
          {unit && <span className="rs-unit">{unit}</span>}
        </span>
      </div>
    </div>
  )
}

// ── Solar / lunar type options ─────────────────────────────────────────────────

const SOLAR_TYPES = [
  { value: 'T', label: 'Total' },
  { value: 'A', label: 'Annular' },
  { value: 'H', label: 'Hybrid' },
  { value: 'P', label: 'Partial' },
]
const LUNAR_TYPES = [
  { value: 'T', label: 'Total' },
  { value: 'P', label: 'Partial' },
  { value: 'N', label: 'Penumbral' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function EclipseBrowser({
  catalog,
  lunarCatalog,
  loading,
  lunarLoading,
  embedded = false,
}) {
  const { pins, focusId, togglePin } = useEventPins()
  const [kind, setKind]               = useState('solar')
  const [typeFilters, setTypeFilters] = useState(new Set(['T']))
  const [durRange, setDurRange]       = useState([0, DUR_CFG.solar.max])
  const [yearRange, setYearRange]     = useState([2000, 2100])
  const [open, setOpen]               = useState(false)

  const activeCatalog = kind === 'lunar' ? lunarCatalog : catalog
  const activeLoading = kind === 'lunar' ? lunarLoading : loading
  const typeOpts      = kind === 'lunar' ? LUNAR_TYPES : SOLAR_TYPES

  const wrapRef        = useRef(null)
  const selectedRowRef = useRef(null)

  const pinnedIds = useMemo(() => new Set(pins.map(p => p.id)), [pins])
  const rowId = e => `${e.kind === 'lunar' ? 'le' : 'se'}-${e.cat}`

  // Reset filters when switching kind
  useEffect(() => {
    setTypeFilters(new Set(['T']))
    setDurRange([0, DUR_CFG[kind].max])
  }, [kind])

  function toggleType(val) {
    setTypeFilters(prev => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val); else next.add(val)
      return next
    })
  }

  const filtered = useMemo(() => {
    if (!activeCatalog) return []
    const cfg = DUR_CFG[kind]
    const durMinSec = cfg.toSec(durRange[0])
    const durMaxSec = cfg.toSec(durRange[1])
    const [yrMin, yrMax] = yearRange
    const durFiltering = durRange[0] > 0 || durRange[1] < cfg.max
    return activeCatalog.filter(e => {
      const yr = yearFromDate(e.date)
      if (yr < yrMin || yr > yrMax) return false
      if (typeFilters.size > 0 && !typeFilters.has(typeFamily(e.type))) return false
      if (durFiltering) {
        const ds = e.durationS ?? 0
        if (ds === 0 && durMinSec > 0) return false
        if (ds > 0 && (ds < durMinSec || ds > durMaxSec)) return false
      }
      return true
    })
  }, [activeCatalog, kind, typeFilters, durRange, yearRange])

  const shown = filtered.slice(0, 40)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Scroll selected row into view when panel opens
  useEffect(() => {
    if (open) setTimeout(() => selectedRowRef.current?.scrollIntoView({ block: 'nearest' }), 50)
  }, [open])

  const focusedEclipsePin = pins.find(p => p.id === focusId && p.kind === 'eclipse')
  const selectedEclipse = focusedEclipsePin?.payload ?? null

  const panelContent = (
    <>
      {/* Kind toggle */}
      <div className={embedded ? 'eclipse-kind-toggle eclipse-kind-toggle--embedded' : 'eclipse-kind-toggle'}>
        <button
          className={`eclipse-kind-btn${kind === 'solar' ? ' is-active' : ''}`}
          onClick={() => setKind('solar')}
        >☀ Solar</button>
        <button
          className={`eclipse-kind-btn${kind === 'lunar' ? ' is-active' : ''}`}
          onClick={() => setKind('lunar')}
        >☽ Lunar</button>
      </div>

      {/* Filters */}
      <div className="eclipse-filter-bar">
        {/* Type pills */}
        <div className="eclipse-filter-row">
          <span className="eclipse-filter-label">Type</span>
          <div className="eclipse-type-pills">
            {typeOpts.map(opt => (
              <button
                key={opt.value}
                className={`eclipse-type-pill eclipse-type-pill--${opt.value.toLowerCase()}${typeFilters.has(opt.value) ? ' is-on' : ''}`}
                onClick={() => toggleType(opt.value)}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Duration slider */}
        <div className="eclipse-filter-row">
          <span className="eclipse-filter-label">Duration</span>
          <RangeSlider
            min={0} max={DUR_CFG[kind].max} step={DUR_CFG[kind].step}
            low={durRange[0]} high={durRange[1]}
            onChange={setDurRange}
            unit={DUR_CFG[kind].unit}
          />
        </div>

        {/* Year range slider */}
        <div className="eclipse-filter-row">
          <span className="eclipse-filter-label">Period</span>
          <RangeSlider
            min={-2000} max={3000} step={1}
            low={yearRange[0]} high={yearRange[1]}
            onChange={setYearRange}
          />
        </div>
      </div>

      {/* List header */}
      <div className="eclipse-list-header">
        <span className="eclipse-list-count">
          {filtered.length > 40
            ? `Showing 40 of ${filtered.length}`
            : `${filtered.length} eclipse${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* List */}
      <div className="eclipse-panel-list">
        {activeLoading && <div className="eclipse-browser-status">Loading catalog…</div>}
        {!activeLoading && shown.length === 0 && (
          <div className="eclipse-browser-status">No eclipses match</div>
        )}
        {shown.map(e => {
          const fam = typeFamily(e.type)
          const id = rowId(e)
          const isPinnedRow = pinnedIds.has(id)
          return (
            <button
              key={e.cat}
              ref={id === focusId ? selectedRowRef : null}
              className={`eclipse-browser-row${isPinnedRow ? ' is-selected' : ''}`}
              onClick={() => {
                togglePin(toEvent('eclipse', e))
                if (!embedded) setOpen(false)
              }}
            >
              <span className={`eclipse-type-badge eclipse-type-${fam.toLowerCase()}`}>{fam}</span>
              <span className="eclipse-browser-row-date">{formatDate(e.date)}</span>
              <span className="eclipse-browser-row-dur">{formatDur(e.durationS)}</span>
            </button>
          )
        })}
      </div>
    </>
  )

  if (embedded) {
    return <div className="eclipse-embedded">{panelContent}</div>
  }

  return (
    <div className="eclipse-selector" ref={wrapRef}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          className={`eclipse-trigger${open ? ' is-open' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          {!selectedEclipse ? (
            <span className="eclipse-trigger-placeholder">Select eclipse…</span>
          ) : (
            <>
              <span className={`eclipse-type-badge eclipse-type-${typeFamily(selectedEclipse.type).toLowerCase()}`}>
                {typeFamily(selectedEclipse.type)}
              </span>
              <span className="eclipse-trigger-date">{formatDate(selectedEclipse.date)}</span>
            </>
          )}
          <span className="eclipse-trigger-caret">{open ? '▴' : '▾'}</span>
        </button>
      </div>

      {open && (
        <div className="eclipse-panel">
          {panelContent}
        </div>
      )}
    </div>
  )
}
