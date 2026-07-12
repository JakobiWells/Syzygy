import { useState, useMemo, useDeferredValue } from 'react'
import * as A from 'astronomy-engine'
import { useSimTime } from '../time/TimeContext'
import { useEventPins, toEvent } from './eventPins'
import { PeriodFilter, DEFAULT_PERIOD } from './ConjunctionsPanel'

// Full moons (with supermoon/micromoon detection by geocentric distance).
// Blood moons are total lunar eclipses — they live in the Eclipse catalog.

const SUPER_KM = 360_000   // full moon nearer than this ≈ supermoon
const MICRO_KM = 405_000   // farther than this ≈ micromoon

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fullMoonsInRange(y0, y1) {
  const out = []
  const endMs = Date.UTC(y1 + 1, 0, 1)
  let cursor = new Date(Date.UTC(y0, 0, 1))
  for (let i = 0; i < (y1 - y0 + 1) * 14 + 2; i++) {
    let t
    try { t = A.SearchMoonPhase(180, cursor, 40) } catch { break }
    if (!t || t.date.getTime() >= endMs) break
    let distanceKm = null
    try { distanceKm = A.GeoMoon(t).Length() * A.KM_PER_AU } catch {}
    const variant = distanceKm == null ? 'full'
      : distanceKm <= SUPER_KM ? 'super'
      : distanceKm >= MICRO_KM ? 'micro' : 'full'
    out.push({ date: t.date, distanceKm: distanceKm ?? 384_400, variant })
    cursor = new Date(t.date.getTime() + 15 * 86400000)
  }
  return out
}

function timeLabel(ms, simTime) {
  const diff = Math.floor((ms - simTime.getTime()) / 86_400_000)
  if (diff < 0) return null
  if (diff === 0) return 'tonight'
  if (diff === 1) return 'tomorrow'
  if (diff < 365) return `in ${diff}d`
  return `in ${Math.round(diff / 365.25)}yr`
}

function fmtDate(d) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

const VARIANT_FILTERS = [['all', 'All'], ['super', 'Supermoons'], ['micro', 'Micromoons']]

export default function MoonsPanel() {
  const { simTime } = useSimTime()
  const { isPinned, togglePin } = useEventPins()
  const [yearRange, setYearRange] = useState(DEFAULT_PERIOD)
  const [variant, setVariant] = useState('all')
  const deferred = useDeferredValue(yearRange)

  const moons = useMemo(() => fullMoonsInRange(deferred[0], deferred[1]), [deferred[0], deferred[1]])

  const visible = useMemo(() =>
    moons.filter(m => variant === 'all' || m.variant === variant).slice(0, 40),
    [moons, variant]
  )

  return (
    <div className="transit-panel">
      <div className="eclipse-filter-bar">
        <div className="eclipse-filter-row">
          <span className="eclipse-filter-label">Type</span>
          <div className="evt-pill-row">
            {VARIANT_FILTERS.map(([val, label]) => (
              <button
                key={val}
                className={`evt-pill${variant === val ? ' is-on' : ''}`}
                onClick={() => setVariant(val)}
              >{label}</button>
            ))}
          </div>
        </div>
        <PeriodFilter yearRange={yearRange} onChange={setYearRange} />
      </div>

      {visible.length === 0 && <div className="eclipse-browser-status">No full moons in this period</div>}
      {visible.map(m => {
        const evt = toEvent('moon', m)
        const active = isPinned(evt.id)
        const label = timeLabel(evt.peakMs, simTime)
        return (
          <button
            key={evt.id}
            className={`transit-row${active ? ' transit-row--active' : ''}`}
            onClick={() => togglePin(evt)}
          >
            <div className="transit-row-top">
              <span className="transit-planet-badge">🌕</span>
              <span className="transit-name">{evt.title}</span>
              <span className="transit-dur">{Math.round(m.distanceKm).toLocaleString()} km</span>
            </div>
            <div className="transit-row-sub">
              <span className="transit-date">{fmtDate(m.date)}</span>
              {label && <span className="transit-when">{label}</span>}
            </div>
          </button>
        )
      })}
      <div className="transit-note">Supermoon ≤ 360,000 km · Micromoon ≥ 405,000 km · blood moons are total lunar eclipses (see Eclipse)</div>
    </div>
  )
}

export { fullMoonsInRange }
