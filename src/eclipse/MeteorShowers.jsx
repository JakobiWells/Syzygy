import { useState, useMemo } from 'react'
import { useSimTime } from '../time/TimeContext'
import * as A from 'astronomy-engine'

const DEG = Math.PI / 180

// Major annual meteor showers: RA/Dec are the radiant coordinates at peak
const SHOWERS = [
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

function peakDate(shower, year) {
  return new Date(Date.UTC(year, shower.month, shower.day, 0, 0, 0))
}

function nextPeak(shower, from) {
  const y = from.getUTCFullYear()
  let d   = peakDate(shower, y)
  if (d < from) d = peakDate(shower, y + 1)
  return d
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function strength(zhr) {
  // Three filled / empty dots
  if (zhr >= 100) return '●●●'
  if (zhr >= 30)  return '●●○'
  return '●○○'
}

export default function MeteorShowerPanel({ onSelectShower }) {
  const { simTime } = useSimTime()
  const [selected, setSelected] = useState(null)

  const showers = useMemo(() =>
    SHOWERS.map(s => ({ ...s, peak: nextPeak(s, simTime) }))
           .sort((a, b) => a.peak - b.peak),
    [simTime]
  )

  function daysLabel(peak) {
    const days = Math.floor((peak - simTime) / 86_400_000)
    if (days < 0)  return null
    if (days === 0) return 'tonight'
    if (days === 1) return 'tomorrow'
    return `in ${days}d`
  }

  function toggle(s) {
    if (selected?.id === s.id) {
      setSelected(null)
      onSelectShower?.(null, null)
    } else {
      setSelected(s)
      onSelectShower?.(s, s.peak)
    }
  }

  return (
    <div className="meteor-panel">
      {showers.map(s => {
        const active = selected?.id === s.id
        const days   = daysLabel(s.peak)
        return (
          <button key={s.id} className={`meteor-row${active ? ' meteor-row--active' : ''}`} onClick={() => toggle(s)}>
            <div className="meteor-row-top">
              <span className="meteor-name">{s.name}</span>
              <span className="meteor-str" title={`~${s.zhr}/hr at peak ZHR`}>{strength(s.zhr)}</span>
            </div>
            <div className="meteor-row-sub">
              <span className="meteor-date">{fmtDate(s.peak)}</span>
              {days && <span className="meteor-days">{days}</span>}
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
