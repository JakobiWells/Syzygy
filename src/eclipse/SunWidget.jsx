import { useMemo } from 'react'
import SunCalc from 'suncalc'
import { useSimTime } from '../time/TimeContext'

// SunCalc azimuth: 0=south, CW. Convert to compass bearing (0=north, CW).
function toCompassDeg(azRad) {
  return ((azRad * 180 / Math.PI) + 180 + 360) % 360
}

// ── Compass ────────────────────────────────────────────────────────────────

const CX = 44, CY = 44, R = 32

function Compass({ azDeg, altDeg }) {
  const sunRad = (azDeg - 90) * Math.PI / 180
  const sx = CX + R * Math.cos(sunRad)
  const sy = CY + R * Math.sin(sunRad)
  const belowHorizon = altDeg < 0

  return (
    <svg viewBox="0 0 88 88" className="sun-widget-compass" aria-hidden="true">
      {/* Tick marks */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * 22.5 - 90) * Math.PI / 180
        const inner = i % 4 === 0 ? R - 5 : R - 3
        return (
          <line key={i}
            x1={CX + inner * Math.cos(a)} y1={CY + inner * Math.sin(a)}
            x2={CX + R * Math.cos(a)}     y2={CY + R * Math.sin(a)}
            stroke="#d0d0cc" strokeWidth={i % 4 === 0 ? 1.5 : 0.75}
          />
        )
      })}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e0e0dc" strokeWidth={1} />

      {/* Cardinals */}
      <text x={CX}    y={5}    textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#5c5c5c" fontFamily="inherit" fontWeight="600">N</text>
      <text x={CX}    y={83}   textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#5c5c5c" fontFamily="inherit">S</text>
      <text x={83}    y={CY}   textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#5c5c5c" fontFamily="inherit">E</text>
      <text x={5}     y={CY}   textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#5c5c5c" fontFamily="inherit">W</text>

      {/* Center dot */}
      <circle cx={CX} cy={CY} r={1.5} fill="#d0d0cc" />

      {/* Sun indicator */}
      <line x1={CX} y1={CY} x2={sx} y2={sy}
        stroke="#f0a500" strokeWidth={1} strokeOpacity={belowHorizon ? 0.3 : 0.5} />
      <circle cx={sx} cy={sy} r={5}
        fill={belowHorizon ? 'none' : '#f0a500'}
        stroke="#f0a500" strokeWidth={1.5}
        opacity={belowHorizon ? 0.35 : 1}
      />
    </svg>
  )
}

// ── Sky arc ────────────────────────────────────────────────────────────────

const ARC_W = 160, ARC_H = 60
const HORIZON_Y = 44   // y position of the horizon line
const ALT_SCALE = 40   // pixels per 90° — so 90° → top, 0° → horizon

function altToY(alt) {
  return HORIZON_Y - (alt / 90) * ALT_SCALE
}

function SkyArc({ arcPts, simTime, lat, lng }) {
  // Current sun position
  const pos = SunCalc.getPosition(simTime, lat, lng)
  const currentAlt = pos.altitude * 180 / Math.PI

  // Current x position: fraction of UTC day
  const dayStart = new Date(simTime)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayFrac = (simTime - dayStart) / 86400000
  const currentX = dayFrac * ARC_W

  // Build path from arc points above horizon
  // Split into segments at horizon crossings
  const segments = []
  let seg = []
  for (const pt of arcPts) {
    if (pt.alt >= -1) {
      seg.push(pt)
    } else {
      if (seg.length > 1) segments.push(seg)
      seg = []
    }
  }
  if (seg.length > 1) segments.push(seg)

  const pathD = segments.map(s =>
    s.map((pt, i) => {
      const x = pt.frac * ARC_W
      const y = Math.max(1, altToY(Math.max(0, pt.alt)))
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  ).join(' ')

  // Sun dot position
  const sunY = altToY(currentAlt)
  const aboveHorizon = currentAlt >= 0

  return (
    <svg viewBox={`0 0 ${ARC_W} ${ARC_H}`} className="sun-widget-arc" aria-hidden="true">
      {/* Night fill below horizon */}
      <rect x={0} y={HORIZON_Y} width={ARC_W} height={ARC_H - HORIZON_Y} fill="#1a2535" opacity={0.12} />

      {/* Hour gridlines at 6h intervals */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f}
          x1={f * ARC_W} y1={0} x2={f * ARC_W} y2={ARC_H}
          stroke="#e0e0dc" strokeWidth={0.5}
        />
      ))}

      {/* Sun path */}
      {pathD && (
        <path d={pathD} fill="none" stroke="#f0a500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      )}

      {/* Horizon */}
      <line x1={0} y1={HORIZON_Y} x2={ARC_W} y2={HORIZON_Y} stroke="#d0d0cc" strokeWidth={1} />

      {/* Current time vertical */}
      <line x1={currentX} y1={0} x2={currentX} y2={ARC_H}
        stroke="#1a1a1a" strokeWidth={0.75} strokeDasharray="2 2" opacity={0.4} />

      {/* Sun position dot */}
      <circle
        cx={currentX}
        cy={aboveHorizon ? Math.max(3, sunY) : HORIZON_Y + 6}
        r={4}
        fill={aboveHorizon ? '#f0a500' : 'none'}
        stroke="#f0a500"
        strokeWidth={1.5}
        opacity={aboveHorizon ? 1 : 0.35}
      />

      {/* Time labels */}
      <text x={1}          y={ARC_H - 2} fontSize={5.5} fill="#999" fontFamily="inherit">0h</text>
      <text x={ARC_W * 0.25} y={ARC_H - 2} fontSize={5.5} fill="#999" fontFamily="inherit" textAnchor="middle">6h</text>
      <text x={ARC_W * 0.5}  y={ARC_H - 2} fontSize={5.5} fill="#999" fontFamily="inherit" textAnchor="middle">12h</text>
      <text x={ARC_W * 0.75} y={ARC_H - 2} fontSize={5.5} fill="#999" fontFamily="inherit" textAnchor="middle">18h</text>
      <text x={ARC_W - 2}    y={ARC_H - 2} fontSize={5.5} fill="#999" fontFamily="inherit" textAnchor="end">24h</text>

      {/* Altitude label for current position */}
      {aboveHorizon && (
        <text
          x={Math.min(currentX + 6, ARC_W - 22)}
          y={Math.max(8, Math.min(sunY - 4, HORIZON_Y - 6))}
          fontSize={6}
          fill="#d97706"
          fontFamily="inherit"
        >
          {Math.round(currentAlt)}°
        </text>
      )}
    </svg>
  )
}

// ── Main widget ────────────────────────────────────────────────────────────

export default function SunWidget({ lat, lng }) {
  const { simTime } = useSimTime()

  // Sample sun altitude every 15 min over the UTC day (for arc)
  const arcPts = useMemo(() => {
    if (lat == null || lng == null) return []
    const dayStart = new Date(simTime)
    dayStart.setUTCHours(0, 0, 0, 0)
    return Array.from({ length: 97 }, (_, i) => {
      const frac = i / 96
      const t = new Date(dayStart.getTime() + frac * 86400000)
      const p = SunCalc.getPosition(t, lat, lng)
      return { frac, alt: p.altitude * 180 / Math.PI }
    })
  }, [lat, lng, Math.floor(simTime.getTime() / 86400000)])  // recalculate once per day

  if (lat == null || lng == null) return null

  const pos = SunCalc.getPosition(simTime, lat, lng)
  const azDeg = toCompassDeg(pos.azimuth)
  const altDeg = Math.round(pos.altitude * 180 / Math.PI)

  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  const cardinal = dirs[Math.round(azDeg / 45) % 8]

  return (
    <div className="eclipse-sun-widget">
      <p className="eclipse-sun-label">Sun position</p>
      <div className="sun-widget-body">
        <div className="sun-widget-left">
          <Compass azDeg={azDeg} altDeg={altDeg} />
          <p className="eclipse-sun-alt">
            {cardinal} · {Math.round(azDeg)}°<br />
            <span style={{ color: altDeg >= 0 ? '#d97706' : '#888' }}>
              {altDeg >= 0 ? `${altDeg}° alt` : 'below horizon'}
            </span>
          </p>
        </div>
        <SkyArc arcPts={arcPts} simTime={simTime} lat={lat} lng={lng} />
      </div>
    </div>
  )
}
