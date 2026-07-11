import { useState, useMemo } from 'react'
import { useSimTime } from '../time/TimeContext'
import { useEventPins, toEvent } from './eventPins'
import { computeTransits, computeElongations } from './solarSystemEvents'

// Compute once on module load — covers 1990-2200
const TRANSIT_START = new Date('1990-01-01T00:00:00Z')
export const ALL_TRANSITS  = computeTransits(TRANSIT_START, 40)

const ELONG_START   = new Date(Date.now())
export const ALL_ELONGATIONS = computeElongations(ELONG_START, 16)

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

const PLANET_FILTERS = [['all', 'All'], ['Mercury', '☿ Mercury'], ['Venus', '♀ Venus']]

function PlanetFilterRow({ filter, onChange }) {
  return (
    <div className="transit-filter-row">
      <span className="eclipse-filter-label">Planet</span>
      <div className="evt-pill-row">
        {PLANET_FILTERS.map(([val, label]) => (
          <button
            key={val}
            className={`evt-pill${filter === val ? ' is-on' : ''}`}
            onClick={() => onChange(val)}
          >{label}</button>
        ))}
      </div>
    </div>
  )
}

// ── Transit Panel ─────────────────────────────────────────────────────────────

export default function PlanetaryTransitPanel() {
  const { simTime } = useSimTime()
  const { isPinned, togglePin } = useEventPins()
  const [filter, setFilter] = useState('all')

  const transits = useMemo(() =>
    ALL_TRANSITS.filter(t => filter === 'all' || t.planet === filter),
    [filter]
  )

  return (
    <div className="transit-panel">
      <PlanetFilterRow filter={filter} onChange={setFilter} />

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
  const [filter, setFilter] = useState('all')

  const elongations = useMemo(() =>
    ALL_ELONGATIONS.filter(e => filter === 'all' || e.planet === filter),
    [filter]
  )

  return (
    <div className="transit-panel">
      <PlanetFilterRow filter={filter} onChange={setFilter} />

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
              <span className="transit-name">{e.visibility === 'morning' ? '🌅' : '🌇'} {e.planet}</span>
              <span className="transit-dur">{e.angleDeg}°</span>
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
