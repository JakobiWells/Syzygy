import { useMemo, useState } from 'react'
import { useSimTime } from '../time/TimeContext'
import { useEventPins, toEvent } from './eventPins'
import { PeriodFilter, DEFAULT_PERIOD } from './ConjunctionsPanel'
import * as A from 'astronomy-engine'

const DEG = Math.PI / 180

// Major annual meteor showers: RA/Dec are the radiant coordinates at peak
export const SHOWERS = [
  { id: 'qua', name: 'Quadrantids',     month: 0,  day: 3,  ra: 230.1, dec: 48.5, zhr: 120 },
  { id: 'lyr', name: 'Lyrids',          month: 3,  day: 22, ra: 271.4, dec: 33.6, zhr: 18  },
  { id: 'eta', name: 'Eta Aquariids',   month: 4,  day: 6,  ra: 337.8, dec: -1.1, zhr: 60  },
  { id: 'dlt', name: 'Delta Aquariids', month: 6,  day: 28, ra: 340.0, dec: -16.0, zhr: 20 },
  { id: 'per', name: 'Perseids',        month: 7,  day: 12, ra: 46.0,  dec: 58.0, zhr: 100 },
  { id: 'dra', name: 'Draconids',       month: 9,  day: 8,  ra: 262.0, dec: 54.0, zhr: 10  },
  { id: 'ori', name: 'Orionids',        month: 9,  day: 21, ra: 94.5,  dec: 15.5, zhr: 25  },
  { id: 'leo', name: 'Leonids',         month: 10, day: 17, ra: 152.5, dec: 22.0, zhr: 15  },
  { id: 'gem', name: 'Geminids',        month: 11, day: 13, ra: 112.3, dec: 33.2, zhr: 150 },
  { id: 'urs', name: 'Ursids',          month: 11, day: 22, ra: 217.4, dec: 75.5, zhr: 10  },
]

// Sub-radiant longitude at given date+time (where the radiant is directly overhead)
function subRadiantLng(date, raDeg) {
  const gmst = A.SiderealTime(A.MakeTime(date))   // hours
  let lng    = raDeg - gmst * 15
  lng = ((lng % 360) + 360) % 360
  return lng > 180 ? lng - 360 : lng
}

// Build a visibility zone polygon for a given radiant declination and angular radius.
//
// When dec + radius ≥ 89° the zone wraps over the North Pole, and when
// dec - radius ≤ -89° it wraps over the South Pole.  In either case the
// great-circle ring degenerates into a "cone" on a flat map, so we fall back
// to a simple latitude-band rectangle (which is the correct approximation:
// visibility only depends on the observer's latitude, not longitude).
//
// For zones that fit within one hemisphere we draw the true great-circle ring,
// unwrapping longitude to avoid an antimeridian seam.
function visibilityZone(dec, lng, radiusDeg, steps = 90) {
  const containsN = dec + radiusDeg >= 89
  const containsS = dec - radiusDeg <= -89

  if (containsN) {
    // Covers from southernmost boundary latitude up to North Pole cap
    const southLat = Math.max(-89.9, dec - radiusDeg)
    const band = [[-180, southLat]]
    for (let x = -180; x <= 180; x += 4) band.push([x, southLat])
    band.push([180, southLat], [180, 89.9], [-180, 89.9], [-180, southLat])
    return band
  }
  if (containsS) {
    const northLat = Math.min(89.9, dec + radiusDeg)
    const band = [[-180, northLat]]
    for (let x = -180; x <= 180; x += 4) band.push([x, northLat])
    band.push([180, northLat], [180, -89.9], [-180, -89.9], [-180, northLat])
    return band
  }

  // True great-circle ring, longitude unwrapped to stay continuous
  const R    = radiusDeg * DEG
  const clat = dec * DEG
  const clng = lng * DEG
  const pts  = []
  let prevLng = lng
  for (let i = 0; i <= steps; i++) {
    const az      = (i / steps) * 2 * Math.PI
    const sinLat  = Math.sin(clat) * Math.cos(R) + Math.cos(clat) * Math.sin(R) * Math.cos(az)
    const lat2    = Math.asin(Math.max(-1, Math.min(1, sinLat)))
    const dlng    = Math.atan2(Math.sin(az) * Math.sin(R) * Math.cos(clat), Math.cos(R) - Math.sin(clat) * Math.sin(lat2))
    let lng2      = (clng + dlng) / DEG
    while (lng2 - prevLng > 180) lng2 -= 360
    while (prevLng - lng2 > 180) lng2 += 360
    prevLng = lng2
    pts.push([lng2, lat2 / DEG])
  }
  return pts
}

// GeoJSON FeatureCollection with three nested visibility zones rendered largest→smallest
// so the data-driven fill-color/opacity creates three distinct visible bands.
export function meteorGeoJSON(shower, peakDate) {
  const lng = subRadiantLng(peakDate, shower.ra)
  const dec = shower.dec
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [visibilityZone(dec, lng, 80)] }, properties: { zone: 'some' } },
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [visibilityZone(dec, lng, 60)] }, properties: { zone: 'good' } },
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [visibilityZone(dec, lng, 30)] }, properties: { zone: 'best' } },
    ]
  }
}

export function peakDate(shower, year) {
  return new Date(Date.UTC(year, shower.month, shower.day, 0, 0, 0))
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function MeteorShowerPanel() {
  const { simTime } = useSimTime()
  const { isPinned, togglePin } = useEventPins()
  const [yearRange, setYearRange] = useState(DEFAULT_PERIOD)

  // Every shower × year in the selected period (each year's peak differs in
  // moonlight, which is the main viewing-quality factor besides the rate)
  const events = useMemo(() => {
    const [y0, y1] = yearRange
    const out = []
    for (let y = y0; y <= y1; y++) {
      for (const s of SHOWERS) {
        out.push(toEvent('meteor', { shower: s, peakDate: peakDate(s, y) }))
      }
    }
    return out.sort((a, b) => a.peakMs - b.peakMs).slice(0, 40)
  }, [yearRange[0], yearRange[1]])

  function daysLabel(peakMs) {
    const days = Math.floor((peakMs - simTime.getTime()) / 86_400_000)
    if (days < 0)  return null
    if (days === 0) return 'tonight'
    if (days === 1) return 'tomorrow'
    return `in ${days}d`
  }

  return (
    <div className="meteor-panel">
      <div className="eclipse-filter-bar">
        <PeriodFilter yearRange={yearRange} onChange={setYearRange} />
      </div>
      {events.map(evt => {
        const s      = evt.payload.shower
        const active = isPinned(evt.id)
        const days   = daysLabel(evt.peakMs)
        const moonPct = evt.moonPct != null ? Math.round(evt.moonPct * 100) : null
        return (
          <button key={evt.id} className={`meteor-row${active ? ' meteor-row--active' : ''}`} onClick={() => togglePin(evt)}>
            <div className="meteor-row-top">
              <span className="meteor-name">{s.name}</span>
              <span className="meteor-str">~{s.zhr}/hr</span>
            </div>
            <div className="meteor-row-sub">
              <span className="meteor-date">{fmtDate(new Date(evt.peakMs))}</span>
              {days && <span className="meteor-days">{days}</span>}
              {evt.moonIcon && (
                <span className="meteor-moon" title={`Moon ${moonPct}% illuminated at peak — ${moonPct <= 35 ? 'good dark skies' : moonPct >= 75 ? 'strong moonlight' : 'some moonlight'}`}>
                  {evt.moonIcon}{moonPct != null && <span className="meteor-moon-pct">{moonPct}%</span>}
                </span>
              )}
            </div>
          </button>
        )
      })}
      <div className="meteor-legend">
        <span className="meteor-legend-dot" style={{ background: 'rgba(124,58,237,0.75)' }} /> best
        <span className="meteor-legend-dot" style={{ background: 'rgba(168,85,247,0.45)', marginLeft: 8 }} /> good
        <span className="meteor-legend-dot" style={{ background: 'rgba(216,180,254,0.25)', marginLeft: 8 }} /> some
        <span className="meteor-legend-note">· radiant altitude at midnight</span>
      </div>
    </div>
  )
}
