import { useState, useMemo } from 'react'
import * as A from 'astronomy-engine'
import { useSimTime } from '../time/TimeContext'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtConjDate(d) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function timeLabel(date, simTime) {
  const diff = Math.floor((date - simTime) / 86_400_000)
  if (diff < -1) return null
  if (diff <= 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff < 365) return `in ${diff}d`
  return `in ${Math.round(diff / 365.25)}yr`
}

// Dark enough to read on the light panel background
export const PLANET_COLOR = {
  Mars: '#dc2626', Jupiter: '#d97706', Saturn: '#a16207',
  Uranus: '#0e7490', Neptune: '#4f46e5',
}

const OUTER = [
  { body: A.Body.Mars,    name: 'Mars',    synodic: 780 },
  { body: A.Body.Jupiter, name: 'Jupiter', synodic: 399 },
  { body: A.Body.Saturn,  name: 'Saturn',  synodic: 378 },
  { body: A.Body.Uranus,  name: 'Uranus',  synodic: 370 },
  { body: A.Body.Neptune, name: 'Neptune', synodic: 368 },
]

// Compute N oppositions or conjunctions (targetRelLon=180 or 0) starting from startDate.
function findEvents(type, targetRelLon, startDate, count) {
  const results = []
  for (const planet of OUTER) {
    try {
      let t = A.SearchRelativeLongitude(planet.body, targetRelLon, A.MakeTime(startDate))
      for (let n = 0; n < count; n++) {
        results.push({
          id:     `${type}-${planet.name.toLowerCase()}-${t.date.toISOString().slice(0,10)}`,
          type,
          planet: planet.name,
          date:   t.date,
        })
        const next = new Date(t.date.getTime() + planet.synodic * 86400000 * 0.9)
        t = A.SearchRelativeLongitude(planet.body, targetRelLon, A.MakeTime(next))
      }
    } catch { /* planet search failed, skip */ }
  }
  results.sort((a, b) => a.date - b.date)
  return results
}

// ── Planet filter (multi-select pills) ──────────────────────────────────────

function PlanetFilter({ selected, onToggle }) {
  return (
    <div className="transit-filter-row">
      <span className="eclipse-filter-label">Planet</span>
      <div className="evt-pill-row">
        {Object.entries(PLANET_COLOR).map(([planet, color]) => {
          const on = selected.has(planet)
          return (
            <button
              key={planet}
              className={`evt-pill${on ? ' is-on' : ''}`}
              style={on ? { background: color, borderColor: color } : {}}
              onClick={() => onToggle(planet)}
            >{planet}</button>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared event list ────────────────────────────────────────────────────────

function EventList({ events, selected, onSelect, simTime, emptyMsg }) {
  if (events.length === 0) return <div className="eclipse-browser-status">{emptyMsg}</div>
  return events.map(e => {
    const active = selected?.id === e.id
    const label  = timeLabel(e.date, simTime)
    const color  = PLANET_COLOR[e.planet] ?? '#94a3b8'
    return (
      <button
        key={e.id}
        className={`transit-row conj-row${active ? ' conj-row--active' : ''}`}
        style={{ '--planet-color': color }}
        onClick={() => onSelect(active ? null : e)}
      >
        <div className="transit-row-top">
          <span className="transit-name conj-planet-name">{e.planet}</span>
          <span className="transit-dur conj-vs-sun">vs Sun</span>
        </div>
        <div className="transit-row-sub">
          <span className="transit-date">{fmtConjDate(e.date)}</span>
          {label && <span className="transit-when">{label}</span>}
        </div>
      </button>
    )
  })
}

// ── Oppositions Panel ────────────────────────────────────────────────────────

export function OppositionsPanel({ onSelect, selected }) {
  const { simTime } = useSimTime()
  const [planetFilter, setPlanetFilter] = useState(new Set())

  // Recompute when simTime moves by more than ~5 years
  const epochKey = Math.floor(simTime.getFullYear() / 5)
  const events = useMemo(() => {
    const start = new Date(Date.UTC(simTime.getFullYear() - 1, 0, 1))
    return findEvents('opposition', 180, start, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epochKey])

  const visible = useMemo(() => {
    const cutoff = new Date(simTime.getTime() - 365 * 86400000)
    return events.filter(e =>
      e.date >= cutoff &&
      (planetFilter.size === 0 || planetFilter.has(e.planet))
    ).slice(0, 30)
  }, [events, simTime, planetFilter])

  function togglePlanet(p) {
    setPlanetFilter(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s })
  }

  return (
    <div className="transit-panel">
      <PlanetFilter selected={planetFilter} onToggle={togglePlanet} />
      <EventList events={visible} selected={selected} onSelect={onSelect} simTime={simTime} emptyMsg="No oppositions found" />
      <div className="transit-note">Planet opposite Sun · best for viewing</div>
    </div>
  )
}

// ── Conjunctions Panel ───────────────────────────────────────────────────────

export default function ConjunctionsPanel({ onSelect, selected }) {
  const { simTime } = useSimTime()
  const [planetFilter, setPlanetFilter] = useState(new Set())

  const epochKey = Math.floor(simTime.getFullYear() / 5)
  const events = useMemo(() => {
    const start = new Date(Date.UTC(simTime.getFullYear() - 1, 0, 1))
    return findEvents('conjunction', 0, start, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epochKey])

  const visible = useMemo(() => {
    const cutoff = new Date(simTime.getTime() - 365 * 86400000)
    return events.filter(e =>
      e.date >= cutoff &&
      (planetFilter.size === 0 || planetFilter.has(e.planet))
    ).slice(0, 30)
  }, [events, simTime, planetFilter])

  function togglePlanet(p) {
    setPlanetFilter(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s })
  }

  return (
    <div className="transit-panel">
      <PlanetFilter selected={planetFilter} onToggle={togglePlanet} />
      <EventList events={visible} selected={selected} onSelect={onSelect} simTime={simTime} emptyMsg="No conjunctions found" />
      <div className="transit-note">Planet near Sun · difficult to observe</div>
    </div>
  )
}
