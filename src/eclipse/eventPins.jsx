import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import * as A from 'astronomy-engine'
import { useSimTime } from '../time/TimeContext'

// ─── Unified event model ─────────────────────────────────────────────────────
//
// Every pinnable event — regardless of source panel — is adapted into:
//   { id, kind, icon, title, dateLabel, startMs, peakMs, endMs, payload }
// `payload` keeps the original catalog object for map-rendering code.
//
// Pinning an event draws its footprint on the map and a marker on the
// scrubber. It never moves the simulation clock — only jumpTo() does.

export const TYPE_NAMES = { T: 'Total', A: 'Annular', H: 'Hybrid', P: 'Partial', N: 'Penumbral' }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const HOUR = 3600_000
const DAY  = 86_400_000

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  const neg = dateStr.startsWith('-')
  const bare = neg ? dateStr.slice(1) : dateStr
  const [y, m, d] = bare.split('-')
  const prefix = neg ? '−' : ''
  return `${prefix}${y} ${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

function fmtShortDate(ms) {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${y < 0 ? `${-y} BCE` : y}`
}

// Parse an eclipse catalog entry's date (+optional time) into UTC ms.
// Handles negative (BCE) years, which Date.parse does not.
function eclipsePeakMs(entry) {
  const neg = entry.date.startsWith('-')
  const bare = neg ? entry.date.slice(1) : entry.date
  const [y, m, d] = bare.split('-').map(Number)
  const dt = new Date(0)
  dt.setUTCFullYear(neg ? -y : y, m - 1, d)
  if (entry.time) {
    const [h, mi, s] = entry.time.split(':').map(Number)
    dt.setUTCHours(h, mi || 0, s || 0, 0)
  } else {
    dt.setUTCHours(12, 0, 0, 0)
  }
  return dt.getTime()
}

const PLANET_GLYPH = { Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆' }

// Eclipse type → icon color (matches the catalog type badges)
const SOLAR_TYPE_COLOR = { T: '#1a1a1a', A: '#d97706', H: '#7c3aed', P: '#9ca3af' }
const LUNAR_TYPE_COLOR = { T: '#b91c1c', P: '#9ca3af', N: '#c4b5fd' }

// Moon phase icon at a given time (angle 0 = new, 180 = full)
export function moonPhaseIcon(ms) {
  try {
    const angle = A.MoonPhase(new Date(ms))
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']
    return icons[Math.round(angle / 45) % 8]
  } catch { return null }
}

// Fraction of the Moon illuminated at a given time (0–1)
export function moonIllumination(ms) {
  try { return A.Illumination(A.Body.Moon, new Date(ms)).phase_fraction } catch { return null }
}

export function toEvent(kind, payload) {
  if (!payload) return null

  switch (kind) {
    case 'eclipse': {
      const e = payload
      const peakMs = eclipsePeakMs(e)
      const isLunar = e.kind === 'lunar'
      let startMs, endMs
      if (!isLunar && e.pathDurationS) {
        startMs = peakMs - (e.peakFrac ?? 0.5) * e.pathDurationS * 1000
        endMs   = startMs + e.pathDurationS * 1000
      } else if (e.durationS) {
        startMs = peakMs - e.durationS * 500
        endMs   = peakMs + e.durationS * 500
      } else {
        startMs = peakMs - 1.5 * HOUR
        endMs   = peakMs + 1.5 * HOUR
      }
      const fam = e.type?.[0] ?? 'P'
      const typeName = TYPE_NAMES[fam] ?? ''
      return {
        id: `${isLunar ? 'le' : 'se'}-${e.cat}`,
        kind: 'eclipse',
        icon: isLunar ? '☽' : '●',
        iconColor: isLunar ? (LUNAR_TYPE_COLOR[fam] ?? '#9ca3af') : (SOLAR_TYPE_COLOR[fam] ?? '#1a1a1a'),
        title: `${typeName} ${isLunar ? 'Lunar' : 'Solar'} Eclipse`,
        dateLabel: formatEventDate(e.date),
        startMs, peakMs, endMs,
        payload: e,
      }
    }

    case 'meteor': {
      const { shower, peakDate } = payload
      const peakMs = +peakDate
      return {
        id: `ms-${shower.id}-${peakDate.getUTCFullYear()}`,
        kind: 'meteor',
        icon: '✷',
        iconColor: '#7c3aed',
        moonIcon: moonPhaseIcon(peakMs),
        moonPct: moonIllumination(peakMs),
        title: `${shower.name} Meteor Shower`,
        dateLabel: `Peak ${fmtShortDate(peakMs)} · ~${shower.zhr}/hr`,
        startMs: peakMs - 1.5 * DAY, peakMs, endMs: peakMs + 1.5 * DAY,
        payload,
      }
    }

    case 'moon': {
      const m = payload
      const peakMs = +new Date(m.date)
      const label = m.variant === 'super' ? 'Supermoon'
        : m.variant === 'micro' ? 'Micromoon' : 'Full Moon'
      const d = new Date(peakMs)
      return {
        id: `mo-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
        kind: 'moon',
        icon: '🌕',
        title: label,
        dateLabel: `${fmtShortDate(peakMs)} · ${Math.round(m.distanceKm / 100) / 10}k km`,
        startMs: peakMs - 12 * HOUR, peakMs, endMs: peakMs + 12 * HOUR,
        payload: m,
      }
    }

    case 'comet': {
      const { comet, periMs } = payload
      return {
        id: `cm-${comet.id}-${new Date(periMs).getUTCFullYear()}`,
        kind: 'comet',
        icon: '☄',
        iconColor: '#0e7490',
        title: comet.name,
        dateLabel: `Perihelion ${fmtShortDate(periMs)}`,
        // Naked-eye window is roughly weeks around perihelion
        startMs: periMs - 30 * DAY, peakMs: periMs, endMs: periMs + 30 * DAY,
        payload,
      }
    }

    case 'transit': {
      const t = payload
      const peakMs = +new Date(t.peak)
      const half = (t.durMin ?? 60) * 30_000
      return {
        id: `tr-${t.id}`,
        kind: 'transit',
        icon: PLANET_GLYPH[t.planet] ?? '⊙',
        title: `${t.planet} Transit`,
        dateLabel: fmtShortDate(peakMs),
        startMs: peakMs - half, peakMs, endMs: peakMs + half,
        payload: t,
      }
    }

    case 'elongation': {
      const e = payload
      const peakMs = +new Date(e.date)
      return {
        id: `el-${e.id}`,
        kind: 'elongation',
        icon: PLANET_GLYPH[e.planet] ?? '⚹',
        title: `${e.planet} Greatest Elongation`,
        dateLabel: `${fmtShortDate(peakMs)} · ${e.angleDeg}° ${e.visibility}`,
        startMs: peakMs, peakMs, endMs: peakMs,
        payload: e,
      }
    }

    case 'conjunction':
    case 'opposition': {
      const e = payload
      const peakMs = +new Date(e.date)
      return {
        id: `${kind === 'conjunction' ? 'cj' : 'op'}-${e.id}`,
        kind,
        icon: kind === 'conjunction' ? '☌' : '☍',
        title: `${e.planet} ${kind === 'conjunction' ? 'Conjunction' : 'Opposition'}`,
        dateLabel: fmtShortDate(peakMs),
        startMs: peakMs, peakMs, endMs: peakMs,
        payload: e,
      }
    }

    default:
      return null
  }
}

// ─── Pins context ────────────────────────────────────────────────────────────

const EventPinsContext = createContext(null)

export function EventPinsProvider({ children }) {
  const { setSimTime } = useSimTime()
  const [pins, setPins] = useState([])
  const [focusId, setFocusId] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())

  // The only sanctioned ways the clock moves: jumping to an event (explicitly
  // via ▶/markers, or implicitly when a new event is pinned).
  const jumpTo = useCallback((evt) => {
    if (!evt) return
    const solarWithPath = evt.kind === 'eclipse' && evt.payload?.kind !== 'lunar' && evt.payload?.pathDurationS
    setSimTime(new Date(solarWithPath ? evt.startMs : evt.peakMs))
  }, [setSimTime])

  const addPin = useCallback((evt, focus = true) => {
    if (!evt) return
    setPins(prev => {
      if (prev.some(p => p.id === evt.id)) return prev
      return [...prev, evt].sort((a, b) => a.peakMs - b.peakMs)
    })
    if (focus) {
      setFocusId(evt.id)
      jumpTo(evt)
    }
  }, [jumpTo])

  // Refine a pin in place (e.g. exact path timing computed after focus)
  const updatePin = useCallback((id, patch) => {
    setPins(prev => {
      const idx = prev.findIndex(p => p.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      next.sort((a, b) => a.peakMs - b.peakMs)
      return next
    })
  }, [])

  const removePin = useCallback((id) => {
    setPins(prev => prev.filter(p => p.id !== id))
    setFocusId(prev => (prev === id ? null : prev))
    setHiddenIds(prev => {
      if (!prev.has(id)) return prev
      const s = new Set(prev); s.delete(id); return s
    })
  }, [])

  // Eye toggle: hide/show a pin's rendering on the map (it stays pinned
  // and keeps its scrubber marker)
  const toggleHidden = useCallback((id) => {
    setHiddenIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }, [])

  const togglePin = useCallback((evt) => {
    if (!evt) return
    setPins(prev => {
      const exists = prev.some(p => p.id === evt.id)
      if (exists) {
        setFocusId(f => (f === evt.id ? null : f))
        return prev.filter(p => p.id !== evt.id)
      }
      setFocusId(evt.id)
      jumpTo(evt)
      return [...prev, evt].sort((a, b) => a.peakMs - b.peakMs)
    })
  }, [jumpTo])

  const focusPin = useCallback((id) => setFocusId(id), [])

  const clearPins = useCallback(() => { setPins([]); setFocusId(null) }, [])

  const focused = useMemo(() => pins.find(p => p.id === focusId) ?? null, [pins, focusId])

  const isPinned = useCallback((id) => pins.some(p => p.id === id), [pins])

  return (
    <EventPinsContext.Provider value={{
      pins, focusId, focused, hiddenIds,
      addPin, removePin, togglePin, focusPin, clearPins, jumpTo, isPinned, toggleHidden, updatePin,
    }}>
      {children}
    </EventPinsContext.Provider>
  )
}

export function useEventPins() {
  return useContext(EventPinsContext)
}
