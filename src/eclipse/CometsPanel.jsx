import { useState, useMemo } from 'react'
import { useSimTime } from '../time/TimeContext'
import { useEventPins, toEvent } from './eventPins'
import { PeriodFilter } from './ConjunctionsPanel'
import { COMETS } from './cometData'

// Comet perihelion passages, derived from the Keplerian elements already used
// by the orrery. Periodic comets (e < 1) repeat every a^1.5 years; hyperbolic
// / near-parabolic ones appear once at their catalogued perihelion.

const JD_UNIX_EPOCH = 2440587.5
const YEAR_MS = 365.25 * 86400000

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function perihelionsInRange(y0, y1) {
  const startMs = Date.UTC(y0, 0, 1)
  const endMs   = Date.UTC(y1 + 1, 0, 1)
  const out = []
  for (const comet of COMETS) {
    const TpMs = (comet.Tp - JD_UNIX_EPOCH) * 86400000
    if (comet.e >= 0.999) {
      // One-off (hyperbolic or period of millennia)
      if (TpMs >= startMs && TpMs < endMs) out.push({ comet, periMs: TpMs })
      continue
    }
    const a = comet.q / (1 - comet.e)
    const periodMs = Math.pow(a, 1.5) * YEAR_MS
    let k = Math.ceil((startMs - TpMs) / periodMs)
    for (; TpMs + k * periodMs < endMs && out.length < 200; k++) {
      out.push({ comet, periMs: TpMs + k * periodMs, approx: k !== 0 })
    }
  }
  return out.sort((a, b) => a.periMs - b.periMs)
}

function timeLabel(ms, simTime) {
  const diff = Math.floor((ms - simTime.getTime()) / 86_400_000)
  if (diff < 0) return null
  if (diff === 0) return 'today'
  if (diff < 365) return `in ${diff}d`
  return `in ${Math.round(diff / 365.25)}yr`
}

function fmtDate(ms) {
  const d = new Date(ms)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export default function CometsPanel() {
  const { simTime } = useSimTime()
  const { isPinned, togglePin } = useEventPins()
  // Comets are sparse — default to a generous window around now
  const [yearRange, setYearRange] = useState(() => {
    const y = new Date().getUTCFullYear()
    return [y - 40, y + 40]
  })

  const events = useMemo(() => perihelionsInRange(yearRange[0], yearRange[1]), [yearRange[0], yearRange[1]])

  return (
    <div className="transit-panel">
      <div className="eclipse-filter-bar">
        <PeriodFilter yearRange={yearRange} onChange={setYearRange} />
      </div>

      {events.length === 0 && <div className="eclipse-browser-status">No comet perihelions in this period</div>}
      {events.map(p => {
        const evt = toEvent('comet', p)
        const active = isPinned(evt.id)
        const label = timeLabel(evt.peakMs, simTime)
        return (
          <button
            key={evt.id}
            className={`transit-row${active ? ' transit-row--active' : ''}`}
            onClick={() => togglePin(evt)}
          >
            <div className="transit-row-top">
              <span className="transit-planet-badge" style={{ color: '#0e7490' }}>☄</span>
              <span className="transit-name">{p.comet.name}</span>
              {p.approx && <span className="transit-dur">± est.</span>}
            </div>
            <div className="transit-row-sub">
              <span className="transit-date">Perihelion {fmtDate(p.periMs)}</span>
              {label && <span className="transit-when">{label}</span>}
            </div>
          </button>
        )
      })}
      <div className="transit-note">Perihelion = closest approach to the Sun · best visibility is usually within weeks of it</div>
    </div>
  )
}
