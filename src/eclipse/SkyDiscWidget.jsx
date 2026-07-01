import { useMemo } from 'react'
import SunCalc from 'suncalc'
import { useSimTime } from '../time/TimeContext'
import { getMoonSunOffset } from './astroEngine'
import { skyColors, toXY, edgeArrow } from './skyEngine'
import { useTerrainHorizon, buildTerrainPath } from './terrainHorizon'

function circleIntersectionArea(d, r1, r2) {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = Math.acos(Math.max(-1, Math.min(1, (d*d + r1*r1 - r2*r2) / (2*d*r1))))
  const b = Math.acos(Math.max(-1, Math.min(1, (d*d + r2*r2 - r1*r1) / (2*d*r2))))
  return r1*r1*a + r2*r2*b - r1*r1*Math.sin(2*a)/2 - r2*r2*Math.sin(2*b)/2
}

// SVG layout — terrain-focused wide-angle preview
const W = 264, H = 124
const HORIZON_FRAC = 0.72   // horizon sits 72% down the frame
const HORIZON_Y    = Math.round(H * HORIZON_FRAC)

export default function SkyDiscWidget({ lat, lng, onOpen, initialFocus = 'sun' }) {
  const { simTime } = useSimTime()
  const terrainProfile = useTerrainHorizon(lat, lng)
  const offset = useMemo(
    () => lat != null && lng != null ? getMoonSunOffset(simTime, lat, lng) : null,
    [simTime, lat, lng]
  )
  const moonPhase = useMemo(() => {
    if (lat == null || lng == null) return { cycle: 0, rotDeg: 0 }
    const illum = SunCalc.getMoonIllumination(simTime)
    const pos   = SunCalc.getMoonPosition(simTime, lat, lng)
    return { cycle: illum.phase, rotDeg: (illum.angle - pos.parallacticAngle) * (180 / Math.PI) }
  }, [simTime, lat, lng])

  if (lat == null || lng == null) return null

  const { sep, sun, moon } = offset

  const sunBelow  = sun.alt  < -0.5
  const moonBelow = moon.alt < -0.5
  const colors    = skyColors(sun.alt)

  // Center on sun or moon depending on eclipse type
  const centerAz = (initialFocus === 'moon' ? moon.az : sun.az)

  // Adaptive scale: zoom out enough that the focused body fits in frame
  const focusedAlt = initialFocus === 'moon' ? moon.alt : sun.alt
  const TOP_PAD    = 12
  const MAX_SCALE  = W / 40   // never zoom in tighter than 40° FOV
  const MIN_SCALE  = W / 120  // never zoom out past 120° FOV
  const scaleForBody = focusedAlt > 1 ? (HORIZON_Y - TOP_PAD) / focusedAlt : MAX_SCALE
  const SCALE = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleForBody))

  // Scale uniformly so sun is always at least 5px, preserving sun/moon ratio
  const MIN_SUN_PX  = 5
  const rawSunPx    = sun.angularRadius * SCALE
  const discScale   = rawSunPx > 0 ? Math.max(1, MIN_SUN_PX / rawSunPx) : 1
  const rSunPx  = sun.angularRadius  * SCALE * discScale
  const rMoonPx = moon.angularRadius * SCALE * discScale
  const sepPx   = sep * SCALE * discScale

  const sunXY  = toXY(sun.alt,  sun.az,  centerAz, W, HORIZON_Y, SCALE)
  const moonXY = toXY(moon.alt, moon.az, centerAz, W, HORIZON_Y, SCALE)

  // Eclipse classification
  const overlapping  = sepPx < rSunPx + rMoonPx
  const innerContact = sepPx < Math.abs(rSunPx - rMoonPx)
  const isTotal   = innerContact && rMoonPx >= rSunPx
  const isAnnular = innerContact && rMoonPx <  rSunPx

  const intersect = overlapping ? circleIntersectionArea(sepPx, rSunPx, rMoonPx) : 0
  const coverage  = Math.min(1, intersect / (Math.PI * rSunPx ** 2))
  const pct       = Math.round(coverage * 100)
  const darkField = isTotal || pct >= 100

  function offScreen(xy) { return xy.x < -10 || xy.x > W + 10 || xy.y < -10 || xy.y > H + 10 }

  // Phase disc paths
  const phaseKx      = Math.cos(moonPhase.cycle * 2 * Math.PI) * rMoonPx
  const phaseLit     = moonPhase.cycle < 0.5 ? 1 : 0
  const phaseStTerm  = phaseKx > 0 ? 1 : 0
  const phaseIsNew   = moonPhase.cycle < 0.005 || moonPhase.cycle > 0.995
  const phaseIsFull  = moonPhase.cycle > 0.495 && moonPhase.cycle < 0.505
  // Suppress lit path during any eclipse overlap — the moon is in new-moon orientation
  // (dark near-side facing Earth) regardless of the exact SunCalc cycle value.
  const phaseLitPath = (phaseIsNew || phaseIsFull || overlapping) ? null
    : `M 0,${-rMoonPx} A ${rMoonPx},${rMoonPx} 0 1 ${phaseLit} 0,${rMoonPx} A ${Math.abs(phaseKx).toFixed(2)},${rMoonPx} 0 0 ${phaseStTerm} 0,${-rMoonPx} Z`

  // Arrows track each body independently of the other
  const sunArrow  = (!sunBelow  && offScreen(sunXY))  ? edgeArrow(W/2, H/2, sunXY.x,  sunXY.y,  W, H, 12) : null
  const moonArrow = (!moonBelow && offScreen(moonXY)) ? edgeArrow(W/2, H/2, moonXY.x, moonXY.y, W, H, 12) : null

  let statusText = ''
  if (!sunBelow && overlapping) {
    if (isTotal || pct >= 100) statusText = 'Total eclipse'
    else if (isAnnular)        statusText = 'Annular eclipse'
    else                       statusText = `${pct}% obscured`
  }

  const terrainPath = buildTerrainPath(terrainProfile, centerAz, W, H, HORIZON_Y, SCALE)

  // Cardinal labels
  const cardinals = ['N','NE','E','SE','S','SW','W','NW'].map((label, i) => {
    const az = i * 45
    const x  = W / 2 + (((az - centerAz + 540) % 360) - 180) * SCALE
    return { label, x }
  }).filter(({ x }) => x > 8 && x < W - 8)

  return (
    <div className="sky-disc-widget">
      <div className="sky-disc-header">
        <span className="eclipse-sun-label" style={{ margin: 0 }}>Sky view</span>
        <button className="sky-disc-expand" onClick={() => onOpen('sun')} title="Full sky view">⤢</button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="sky-disc-svg"
        onClick={() => onOpen('sun')} aria-label="Click to expand sky view">

        <defs>
          <linearGradient id="sdwGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor={darkField ? '#08060f' : colors.top} />
            <stop offset={`${(HORIZON_Y / H * 100).toFixed(1)}%`} stopColor={darkField ? '#0d0a1a' : colors.bot} />
            <stop offset={`${(HORIZON_Y / H * 100).toFixed(1)}%`} stopColor="#3d2b1f" />
            <stop offset="100%" stopColor="#2a1f15" />
          </linearGradient>
          <clipPath id="sdwClip">
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>

        <rect x={0} y={0} width={W} height={H} fill="url(#sdwGrad)" />

        <g clipPath="url(#sdwClip)">
          {/* Terrain silhouette */}
          {terrainPath
            ? <path d={terrainPath} fill="#2c2018" opacity={0.92} />
            : <rect x={0} y={HORIZON_Y} width={W} height={H - HORIZON_Y} fill="#3d2b1f" />
          }

          {/* Flat horizon line */}
          <line x1={0} y1={HORIZON_Y} x2={W} y2={HORIZON_Y}
            stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />

          {/* Cardinal labels */}
          {cardinals.map(({ label, x }) => (
            <text key={label} x={x} y={HORIZON_Y + 11}
              textAnchor="middle" fontSize={6.5}
              fill="rgba(255,255,255,0.45)" fontFamily="inherit" fontWeight="500">
              {label}
            </text>
          ))}

          {/* "Below horizon" label — only for the focused body */}
          {initialFocus === 'sun'  && sunBelow  && (
            <text x={W / 2} y={HORIZON_Y / 2 + 4} textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="rgba(255,255,255,0.45)" fontFamily="inherit">
              Sun below horizon
            </text>
          )}
          {initialFocus === 'moon' && moonBelow && (
            <text x={W / 2} y={HORIZON_Y / 2 + 4} textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="rgba(255,255,255,0.45)" fontFamily="inherit">
              Moon below horizon
            </text>
          )}

          {/* Sun disc (only when above horizon) */}
          {!sunBelow && (
            <>
              {!darkField && !offScreen(sunXY) && (
                <>
                  <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx + 14}
                    fill="#f0a500" fillOpacity={0.06} />
                  <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx + 7}
                    fill="#f0a500" fillOpacity={0.12} />
                  <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx + 3}
                    fill="#f0a500" fillOpacity={0.18} />
                </>
              )}
              {!offScreen(sunXY) && (
                <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx}
                  fill={darkField ? '#110800' : '#fbbf24'} />
              )}
            </>
          )}

          {/* Moon disc with current phase */}
          {!moonBelow && !offScreen(moonXY) && (
            <g transform={`translate(${moonXY.x},${moonXY.y}) rotate(${moonPhase.rotDeg.toFixed(1)})`}>
              <circle r={rMoonPx} fill="#141422" />
              {!darkField && phaseLitPath && <path d={phaseLitPath} fill="white" />}
              <circle r={rMoonPx} fill="none" stroke="rgba(150,150,180,0.55)" strokeWidth={0.8} />
            </g>
          )}
          {/* Corona during solar totality — only while sun is still above horizon */}
          {darkField && !sunBelow && !moonBelow && !offScreen(moonXY) && (
            <>
              <circle cx={moonXY.x} cy={moonXY.y} r={rMoonPx + 1}
                fill="none" stroke="white" strokeWidth={1.5} strokeOpacity={0.85} />
              <circle cx={moonXY.x} cy={moonXY.y} r={rMoonPx + 5}
                fill="none" stroke="white" strokeWidth={4}   strokeOpacity={0.20} />
              <circle cx={moonXY.x} cy={moonXY.y} r={rMoonPx + 11}
                fill="none" stroke="white" strokeWidth={5}   strokeOpacity={0.09} />
            </>
          )}
        </g>

        {/* Edge arrows */}
        {sunArrow && (
          <polygon points="-4,0 4,0 0,7" fill="#f0a500"
            transform={`translate(${sunArrow.x},${sunArrow.y}) rotate(${sunArrow.angle})`}
            opacity={0.85} />
        )}
        {moonArrow && (
          <polygon points="-4,0 4,0 0,7" fill="#9090b0"
            transform={`translate(${moonArrow.x},${moonArrow.y}) rotate(${moonArrow.angle})`}
            opacity={0.85} />
        )}

        {/* Eclipse status overlay */}
        {statusText && (
          <text x={W / 2} y={H - 5} textAnchor="middle" fontSize={7.5}
            fontFamily="inherit" fontWeight="500"
            fill={darkField ? '#fde68a' : isAnnular ? '#f59e0b' : 'rgba(255,255,255,0.9)'}>
            {statusText}
          </text>
        )}
      </svg>
    </div>
  )
}
