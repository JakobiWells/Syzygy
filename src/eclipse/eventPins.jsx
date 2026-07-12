import { createContext, useContext, useState, useCallback, useMemo } from 'react'
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
      const typeName = TYPE_NAMES[e.type?.[0]] ?? ''
      return {
        id: `${isLunar ? 'le' : 'se'}-${e.cat}`,
        kind: 'eclipse',
        icon: isLunar ? '☽' : '☀',
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
        icon: '☄',
        title: `${shower.name} Meteor Shower`,
        dateLabel: `Peak ${fmtShortDate(peakMs)} · ~${shower.zhr}/hr`,
        startMs: peakMs - 1.5 * DAY, peakMs, endMs: peakMs + 1.5 * DAY,
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

  const addPin = useCallback((evt, focus = true) => {
    if (!evt) return
    setPins(prev => {
      if (prev.some(p => p.id === evt.id)) return prev
      return [...prev, evt].sort((a, b) => a.peakMs - b.peakMs)
    })
    if (focus) setFocusId(evt.id)
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
      return [...prev, evt].sort((a, b) => a.peakMs - b.peakMs)
    })
  }, [])

  const focusPin = useCallback((id) => setFocusId(id), [])

  const clearPins = useCallback(() => { setPins([]); setFocusId(null) }, [])

  // The only sanctioned way an event moves the clock. Events with a path play
  // from the start so the animation runs; instant events jump straight to peak.
  const jumpTo = useCallback((evt) => {
    if (!evt) return
    const solarWithPath = evt.kind === 'eclipse' && evt.payload?.kind !== 'lunar' && evt.payload?.pathDurationS
    setSimTime(new Date(solarWithPath ? evt.startMs : evt.peakMs))
  }, [setSimTime])

  const focused = useMemo(() => pins.find(p => p.id === focusId) ?? null, [pins, focusId])

  const isPinned = useCallback((id) => pins.some(p => p.id === id), [pins])

  return (
    <EventPinsContext.Provider value={{
      pins, focusId, focused, hiddenIds,
      addPin, removePin, togglePin, focusPin, clearPins, jumpTo, isPinned, toggleHidden,
    }}>
      {children}
    </EventPinsContext.Provider>
  )
}

export function useEventPins() {
  return useContext(EventPinsContext)
}
