import { useState, useMemo, useDeferredValue } from 'react'
import { useSimTime } from '../time/TimeContext'
import { useEventPins, toEvent } from './eventPins'
import { computeTransits, computeElongations } from './solarSystemEvents'
import { PeriodFilter, DEFAULT_PERIOD } from './ConjunctionsPanel'

// Compute once on module load — covers 1990-2200. Transits are rare enough
// (a handful per century) that the full list needs no period filter.
const TRANSIT_START = new Date('1990-01-01T00:00:00Z')
export const ALL_TRANSITS  = computeTransits(TRANSIT_START, 40)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtTransitDur(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export function fmtTransitDate(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function timeLabel(date, simTime) {
  const diff = Math.floor((date - simTime) / 86_400_000)
  if (diff < 0) return null
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff < 365) return `in ${diff}d`
  return `in ${Math.round(diff / 365.25)}yr`
}

// Only Mercury and Venus: inferior planets are the only ones that transit the
// Sun or reach greatest elongation as seen from Earth.
const INNER_PLANET_COLOR = { Mercury: '#64748b', Venus: '#b45309' }

// Multi-select planet pills — same pattern as the conjunctions/oppositions
// panels (empty selection = all)
function PlanetFilterRow({ selected, onToggle }) {
  return (
    <div className="eclipse-filter-row">
      <span className="eclipse-filter-label">Planet</span>
      <div className="evt-pill-row">
        {Object.entries(INNER_PLANET_COLOR).map(([planet, color]) => {
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

function usePlanetFilter() {
  const [selected, setSelected] = useState(new Set())
  const onToggle = p => setSelected(prev => {
    const s = new Set(prev)
    s.has(p) ? s.delete(p) : s.add(p)
    return s
  })
  const matches = planet => selected.size === 0 || selected.has(planet)
  return { selected, onToggle, matches }
}

// Elongations recur ~7×/yr for Mercury, so they're computed per period
// (deferred so slider drags don't trigger a search per pixel)
function useElongationsInPeriod(yearRange) {
  const deferred = useDeferredValue(yearRange)
  return useMemo(() => {
    const [y0, y1] = deferred
    const start = new Date(Date.UTC(y0, 0, 1))
    const end   = new Date(Date.UTC(y1 + 1, 0, 1))
    const count = Math.min((y1 - y0 + 1) * 7 + 2, 40)
    return computeElongations(start, count).filter(e => e.date >= start && e.date < end)
  }, [deferred[0], deferred[1]])
}

// ── Transit Panel ─────────────────────────────────────────────────────────────

export default function PlanetaryTransitPanel() {
  const { simTime } = useSimTime()
  const { isPinned, togglePin } = useEventPins()
  const { selected, onToggle, matches } = usePlanetFilter()

  const transits = useMemo(() =>
    ALL_TRANSITS.filter(t => matches(t.planet)),
    [selected]
  )

  return (
    <div className="transit-panel">
      <div className="eclipse-filter-bar">
        <PlanetFilterRow selected={selected} onToggle={onToggle} />
      </div>

      {transits.map(t => {
        const evt    = toEvent('transit', t)
        const active = isPinned(evt.id)
        const label  = timeLabel(t.peak, simTime)
        return (
          <button
            key={t.id}
            className={`transit-row${active ? ' transit-row--active' : ''} transit-row--${t.planet.toLowerCase()}`}
            onClick={() => togglePin(evt)}
          >
            <div className="transit-row-top">
              <span className="transit-planet-badge">{t.planet === 'Mercury' ? '☿' : '♀'}</span>
              <span className="transit-name">{t.planet}</span>
              <span className="transit-dur">{fmtTransitDur(t.durMin)}</span>
            </div>
            <div className="transit-row-sub">
              <span className="transit-date">{fmtTransitDate(t.peak)}</span>
              {label && <span className="transit-when">{label}</span>}
            </div>
          </button>
        )
      })}

      <div className="transit-note">
        Exact · computed via astronomy-engine · visible from day hemisphere
      </div>
    </div>
  )
}

// ── Elongation Panel ──────────────────────────────────────────────────────────

export function ElongationPanel() {
  const { simTime } = useSimTime()
  const { isPinned, togglePin } = useEventPins()
  const { selected, onToggle, matches } = usePlanetFilter()
  const [yearRange, setYearRange] = useState(DEFAULT_PERIOD)

  const all = useElongationsInPeriod(yearRange)
  const elongations = useMemo(() =>
    all.filter(e => matches(e.planet)).slice(0, 30),
    [all, selected]
  )

  return (
    <div className="transit-panel">
      <div className="eclipse-filter-bar">
        <PlanetFilterRow selected={selected} onToggle={onToggle} />
        <PeriodFilter yearRange={yearRange} onChange={setYearRange} />
      </div>

      {elongations.length === 0 && <div className="eclipse-browser-status">No elongations in this period</div>}
      {elongations.map(e => {
        const evt    = toEvent('elongation', e)
        const active = isPinned(evt.id)
        const label  = timeLabel(e.date, simTime)
        return (
          <button
            key={e.id}
            className={`transit-row${active ? ' transit-row--active' : ''} transit-row--${e.planet.toLowerCase()}`}
            onClick={() => togglePin(evt)}
          >
            <div className="transit-row-top">
              <span className="transit-planet-badge">{e.planet === 'Mercury' ? '☿' : '♀'}</span>
              <span className="transit-name">{e.planet}</span>
              <span className="transit-dur">{e.angleDeg}° · {e.visibility}</span>
            </div>
            <div className="transit-row-sub">
              <span className="transit-date">{fmtTransitDate(e.date)}</span>
              {label && <span className="transit-when">{label}</span>}
            </div>
          </button>
        )
      })}

      <div className="transit-note">Greatest elongation · best evening/morning visibility</div>
    </div>
  )
}
