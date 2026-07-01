import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSimTime } from './TimeContext'
import { useOverlays, OVERLAY_ITEMS } from '../eclipse/OverlaysContext'
import Logo from '../components/Logo'
import './time.css'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function pad2(n) { return String(n).padStart(2, '0') }

function formatDate(d) {
  return `${DAYS[d.getUTCDay()]} ${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
function formatTime(d) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
}
function toDateInputValue(d) {
  const y = d.getUTCFullYear()
  const year = Math.max(-9999, Math.min(9999, y))
  return `${year < 0 ? '-' : ''}${String(Math.abs(year)).padStart(4, '0')}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}
function toTimeInputValue(d) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

// ── Timezone clock ──────────────────────────────────────────────────────────

const COMMON_ZONES = [
  'UTC',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Anchorage','Pacific/Honolulu','America/Sao_Paulo','America/Toronto',
  'America/Mexico_City','America/Vancouver',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Moscow',
  'Asia/Dubai','Asia/Kolkata','Asia/Bangkok','Asia/Shanghai',
  'Asia/Tokyo','Asia/Seoul','Australia/Sydney','Pacific/Auckland',
  'Africa/Cairo','Africa/Johannesburg',
]

function formatTzTime(date, tz) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(date)
  } catch { return '--:--:--' }
}

function tzAbbr(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date)
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz.split('/').pop()
  } catch { return tz.split('/').pop() }
}

function TzPicker({ tz, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const allZones = useMemo(() => {
    try { return Intl.supportedValuesOf('timeZone') } catch { return COMMON_ZONES }
  }, [])

  const q = query.toLowerCase()
  const shown = q
    ? allZones.filter(z => z.toLowerCase().includes(q)).slice(0, 14)
    : COMMON_ZONES

  return (
    <div className="tz-picker">
      <input
        ref={inputRef}
        className="tz-picker-input"
        placeholder="Search timezone…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="tz-picker-list">
        {shown.map(z => (
          <button key={z} className={`tz-picker-row${z === tz ? ' is-active' : ''}`}
            onClick={() => { onChange(z); onClose() }}>
            {z.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Speed slider ────────────────────────────────────────────────────────────

const SNAP_POINTS = [
  { label: 'RT',    value: 1        },
  { label: '1m/s',  value: 60       },
  { label: '1h/s',  value: 3600     },
  { label: '1d/s',  value: 86400    },
  { label: '1mo/s', value: 2629800  },
  { label: '1yr/s', value: 31557600 },
]

const LOG_MAX = Math.log10(31557600)   // log10 of max speed value
const SNAP_R  = 0.04                   // snap radius in [0,1] frac space

function toFrac(val)  { return Math.log10(Math.max(1, val)) / LOG_MAX }
function fromFrac(f)  { return Math.pow(10, Math.max(0, Math.min(1, f)) * LOG_MAX) }

function applySnap(frac) {
  for (const sp of SNAP_POINTS) {
    const sf = toFrac(sp.value)
    if (Math.abs(frac - sf) < SNAP_R) return sf
  }
  return frac
}

function speedLabel(val) {
  for (const sp of SNAP_POINTS) {
    if (Math.abs(val - sp.value) / sp.value < 0.001) return sp.label
  }
  if (val < 120)      return `${Math.round(val)}s/s`
  if (val < 7200)     return `${(val / 60).toFixed(0)}m/s`
  if (val < 172800)   return `${(val / 3600).toFixed(1)}h/s`
  if (val < 5259600)  return `${(val / 86400).toFixed(1)}d/s`
  return `${(val / 2629800).toFixed(1)}mo/s`
}

function SpeedSlider({ speed, onSpeedChange }) {
  const trackRef  = useRef(null)
  const dragging  = useRef(false)
  const frac = toFrac(speed)

  function fracFromEvent(e) {
    const rect = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function commit(e) {
    onSpeedChange(fromFrac(applySnap(fracFromEvent(e))))
  }

  function onPointerDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    trackRef.current.setPointerCapture(e.pointerId)
    commit(e)
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    commit(e)
  }

  function onPointerUp() {
    dragging.current = false
  }

  return (
    <div className="time-speed-slider">
      <span className="time-speed-label">{speedLabel(speed)}</span>
      <div
        ref={trackRef}
        className="time-speed-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Fill left of thumb */}
        <div className="time-speed-fill" style={{ width: `${frac * 100}%` }} />

        {/* Snap ticks */}
        {SNAP_POINTS.map(sp => {
          const tf = toFrac(sp.value)
          const isActive = Math.abs(tf - frac) < 0.01
          return (
            <div
              key={sp.label}
              className={`time-speed-tick${isActive ? ' is-active' : ''}`}
              style={{ left: `${tf * 100}%` }}
              title={sp.label}
            />
          )
        })}

        {/* Thumb */}
        <div className="time-speed-thumb" style={{ left: `${frac * 100}%` }} />
      </div>
    </div>
  )
}

// ── Drag-to-scrub handler ────────────────────────────────────────────────────

function useScrubHandler(simTime, speed, setSimTime, onShortClick) {
  return function onMouseDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    const startX  = e.clientX
    const startMs = simTime.getTime()
    let moved = false

    function onMove(ev) {
      const dx = ev.clientX - startX
      if (Math.abs(dx) > 4) moved = true
      if (moved) setSimTime(new Date(startMs + dx * speed * 1000))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!moved) onShortClick()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
}

// ── Layers dropdown ──────────────────────────────────────────────────────────

function LayersMenu() {
  const { overlays, toggleOverlay } = useOverlays()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="time-layers-wrap" ref={ref}>
      <button
        className={`time-btn time-layers-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Map overlays"
      >
        Layers
        <span className="time-layers-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="time-layers-dropdown">
          <p className="time-layers-title">Overlays</p>
          {OVERLAY_ITEMS.map(({ key, label, color }) => (
            <button
              key={key}
              className="time-layers-row"
              onClick={() => toggleOverlay(key)}
            >
              <span className="time-layers-dot" style={{ background: color }} />
              <span className="time-layers-label">{label}</span>
              <span className={`time-layers-toggle${overlays[key] ? ' is-on' : ''}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TimeBar() {
  const { simTime, isPlaying, speed, direction, togglePlay, setSimTime, setSpeed, setDirection, play, resetToNow } = useSimTime()
  const { projection, setProjection } = useOverlays()

  const [editingDate, setEditingDate] = useState(false)
  const [editingTime, setEditingTime] = useState(false)
  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)

  const [localTz, setLocalTz]       = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [tzPickerOpen, setTzPickerOpen] = useState(false)
  const tzRef = useRef(null)

  useEffect(() => {
    if (!tzPickerOpen) return
    function onDown(e) { if (tzRef.current && !tzRef.current.contains(e.target)) setTzPickerOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [tzPickerOpen])

  useEffect(() => {
    if (editingDate && dateInputRef.current) {
      dateInputRef.current.focus()
      try { dateInputRef.current.showPicker?.() } catch {}
    }
  }, [editingDate])

  useEffect(() => {
    if (editingTime && timeInputRef.current) {
      timeInputRef.current.focus()
      try { timeInputRef.current.showPicker?.() } catch {}
    }
  }, [editingTime])

  function handleDateChange(e) {
    const val = e.target.value
    if (!val) return
    const [y, m, day] = val.split('-').map(Number)
    const next = new Date(simTime)
    next.setUTCFullYear(y, m - 1, day)
    setSimTime(next)
    setEditingDate(false)
  }

  function handleTimeChange(e) {
    const val = e.target.value
    if (!val) return
    const [h, min] = val.split(':').map(Number)
    const next = new Date(simTime)
    next.setUTCHours(h, min, 0, 0)
    setSimTime(next)
    setEditingTime(false)
  }

  const onDateMouseDown = useScrubHandler(simTime, speed, setSimTime, () => setEditingDate(true))
  const onTimeMouseDown = useScrubHandler(simTime, speed, setSimTime, () => setEditingTime(true))

  const isFuture = simTime > new Date()

  return (
    <div className="time-bar">

      <Link to="/" className="time-bar-logo">
        <Logo size={20} />
        <span>Syzygy</span>
      </Link>

      <div className="time-bar-divider" />

      {/* Date — drag to scrub, click to set */}
      <div className="time-display">
        {editingDate ? (
          <input
            ref={dateInputRef}
            type="date"
            className="time-date-input"
            defaultValue={toDateInputValue(simTime)}
            onChange={handleDateChange}
            onBlur={() => setEditingDate(false)}
          />
        ) : (
          <button
            className="time-btn time-date time-scrub"
            onMouseDown={onDateMouseDown}
            title="Drag to scrub · click to set date"
          >
            <span className={isFuture ? 'time-future' : ''}>{formatDate(simTime)}</span>
          </button>
        )}

        <span className="time-sep">·</span>

        {editingTime ? (
          <input
            ref={timeInputRef}
            type="time"
            className="time-time-input"
            defaultValue={toTimeInputValue(simTime)}
            onChange={handleTimeChange}
            onBlur={() => setEditingTime(false)}
          />
        ) : (
          <button
            className="time-btn time-time time-scrub"
            onMouseDown={onTimeMouseDown}
            title="Drag to scrub · click to set time"
          >
            {formatTime(simTime)} <span className="time-utc-label">UTC</span>
          </button>
        )}
      </div>

      <div className="time-bar-divider" />

      {/* Local timezone clock */}
      <div className="time-local-wrap" ref={tzRef}>
        <button
          className="time-btn time-local-btn"
          onClick={() => setTzPickerOpen(o => !o)}
          title="Local time — click to change timezone"
        >
          <span className="time-local-time">{formatTzTime(simTime, localTz)}</span>
          <span className="time-local-tz">{tzAbbr(simTime, localTz)} ▾</span>
        </button>
        {tzPickerOpen && (
          <TzPicker tz={localTz} onChange={setLocalTz} onClose={() => setTzPickerOpen(false)} />
        )}
      </div>

      <div className="time-bar-divider" />

      <div className="time-playback-group">
        <button
          className={`time-btn time-dir${direction === -1 ? ' is-active' : ''}`}
          onClick={() => { setDirection(-1); play() }}
          title="Play backward"
        >◀</button>
        <button
          className="time-btn time-play"
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >{isPlaying ? '⏸' : '▶'}</button>
        <button
          className={`time-btn time-dir${direction === 1 ? ' is-active' : ''}`}
          onClick={() => { setDirection(1); play() }}
          title="Play forward"
        >▶</button>
      </div>

      <SpeedSlider speed={speed} onSpeedChange={setSpeed} />

      <div className="time-bar-divider" />

      <button className="time-btn time-now" onClick={resetToNow} title="Jump to current time">
        Now
      </button>

      <div className="time-bar-divider" />

      <button
        className="time-btn time-projection"
        onClick={() => setProjection(projection === 'globe' ? 'mercator' : 'globe')}
        title={projection === 'globe' ? 'Switch to 2D map' : 'Switch to 3D globe'}
      >
        {projection === 'globe' ? '3D' : '2D'}
      </button>

      <div className="time-bar-divider" />

      <LayersMenu />

    </div>
  )
}
