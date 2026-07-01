import { useMemo } from 'react'
import { useSimTime } from '../time/TimeContext'
import { getMoonSunOffset } from './astroEngine'

// SVG layout
const W = 240, H = 96
const CX = W / 2, CY = H / 2 - 4
// Fix display radius of sun at mean distance — same reference scale as SkyDiscWidget
const R_SUN_REF_PX  = 22
const R_SUN_REF_DEG = 0.2667
const SCALE = R_SUN_REF_PX / R_SUN_REF_DEG  // px per degree ≈ 82.5

function circleIntersectionArea(d, r1, r2) {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = Math.acos(Math.max(-1, Math.min(1, (d*d + r1*r1 - r2*r2) / (2*d*r1))))
  const b = Math.acos(Math.max(-1, Math.min(1, (d*d + r2*r2 - r1*r1) / (2*d*r2))))
  return r1*r1*a + r2*r2*b - r1*r1*Math.sin(2*a)/2 - r2*r2*Math.sin(2*b)/2
}

export default function SolarDiscView({ lat, lng }) {
  const { simTime } = useSimTime()
  const offset = useMemo(
    () => lat != null && lng != null ? getMoonSunOffset(simTime, lat, lng) : null,
    [simTime, lat, lng]
  )

  if (lat == null || lng == null) return null

  const { dEast, dNorth, sep, sun, moon } = offset

  const sunAlt   = sun.alt
  const sunBelow = sunAlt < -0.5

  const rSunDeg  = sun.angularRadius
  const rMoonDeg = moon.angularRadius
  const rSunPx   = rSunDeg  * SCALE
  const rMoonPx  = rMoonDeg * SCALE

  // Sky-observation convention: east is LEFT (looking up). Negate dEast.
  const moonDx = -dEast  * SCALE
  const moonDy = -dNorth * SCALE
  const sepPx  =  sep    * SCALE

  const mx = CX + moonDx
  const my = CY + moonDy

  // Eclipse classification — identical logic to SkyDiscWidget / SkyView
  const overlapping  = sepPx < rSunPx + rMoonPx
  const innerContact = sepPx < Math.abs(rSunPx - rMoonPx)
  const isTotal   = innerContact && rMoonPx >= rSunPx
  const isAnnular = innerContact && rMoonPx <  rSunPx

  const intersect  = overlapping ? circleIntersectionArea(sepPx, rSunPx, rMoonPx) : 0
  const coverage   = Math.min(1, intersect / (Math.PI * rSunPx ** 2))
  const pct        = Math.round(coverage * 100)
  const darkField  = isTotal || pct >= 100   // matches SkyDiscWidget / SkyView exactly

  const moonVisible = sep < rSunDeg + rMoonDeg + 0.12

  let statusText = ''
  if (!sunBelow && overlapping) {
    if (darkField)       statusText = 'Total eclipse'
    else if (isAnnular)  statusText = 'Annular eclipse'
    else                 statusText = `${pct}% obscured`
  }

  // Corona radius: 2.8× moon disc for realistic extent
  const coronaR = rMoonPx * 2.8

  return (
    <div className="eclipse-sun-widget">
      <p className="eclipse-sun-label">Solar disc</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="solar-disc-svg" aria-hidden="true"
        style={{ display: 'block', width: '100%', height: 'auto' }}>

        <defs>
          {/* Dynamic corona gradient centered at moon position */}
          {darkField && moonVisible && (
            <radialGradient id="sdvCorona" cx={mx} cy={my} r={coronaR}
              gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="white" stopOpacity={0.95} />
              <stop offset="18%"  stopColor="white" stopOpacity={0.65} />
              <stop offset="38%"  stopColor="white" stopOpacity={0.28} />
              <stop offset="62%"  stopColor="white" stopOpacity={0.10} />
              <stop offset="85%"  stopColor="white" stopOpacity={0.03} />
              <stop offset="100%" stopColor="white" stopOpacity={0}    />
            </radialGradient>
          )}
        </defs>

        {/* Field background */}
        <ellipse cx={CX} cy={CY} rx={W / 2 - 4} ry={CY - 2}
          fill={darkField ? '#04030a' : '#f0ede8'}
          stroke={darkField ? '#1a1830' : '#e0ddd8'} strokeWidth={0.5} />

        {sunBelow ? (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#aaa" fontFamily="inherit">
            Sun below horizon
          </text>
        ) : (
          <>
            {/* Orientation labels — sky convention: E left, W right */}
            <text x={CX}    y={8}      textAnchor="middle" fontSize={5.5} fill={darkField ? '#554' : '#c0b8a8'} fontFamily="inherit">N</text>
            <text x={W - 7} y={CY + 2} textAnchor="middle" fontSize={5.5} fill={darkField ? '#554' : '#c0b8a8'} fontFamily="inherit">W</text>
            <text x={7}     y={CY + 2} textAnchor="middle" fontSize={5.5} fill={darkField ? '#554' : '#c0b8a8'} fontFamily="inherit">E</text>

            {/* Corona glow — drawn first so moon disc clips it */}
            {darkField && moonVisible && (
              <circle cx={mx} cy={my} r={coronaR}
                fill="url(#sdvCorona)" />
            )}

            {/* Sun glow (suppressed during totality) */}
            {!darkField && (
              <>
                <circle cx={CX} cy={CY} r={rSunPx + 10}
                  fill="none" stroke="#f0a500" strokeWidth={6} strokeOpacity={0.08} />
                <circle cx={CX} cy={CY} r={rSunPx + 4}
                  fill="none" stroke="#f0a500" strokeWidth={4} strokeOpacity={0.13} />
              </>
            )}

            {/* Sun disc — hidden during totality (moon covers it) */}
            {!darkField && (
              <circle cx={CX} cy={CY} r={rSunPx} fill="#fbbf24" />
            )}

            {/* Moon disc — drawn on top; masks corona interior */}
            {moonVisible && (
              <>
                <circle cx={mx} cy={my} r={rMoonPx}
                  fill={darkField ? '#000' : '#1a1a1c'}
                  stroke={darkField ? '#111' : '#2d2d30'} strokeWidth={0.5} />
                {!darkField && (
                  <circle cx={mx} cy={my} r={Math.max(1, rMoonPx - 2)}
                    fill="none" stroke="#3a3a3c" strokeWidth={1.5} strokeOpacity={0.4} />
                )}
              </>
            )}

            {/* Chromosphere flash ring right at moon limb during totality */}
            {darkField && moonVisible && (
              <circle cx={mx} cy={my} r={rMoonPx + 1.5}
                fill="none" stroke="white" strokeWidth={2} strokeOpacity={0.88} />
            )}

            {/* Annular ring highlight */}
            {isAnnular && moonVisible && (
              <circle cx={mx} cy={my} r={rMoonPx + 1}
                fill="none" stroke="#f59e0b" strokeWidth={1} strokeOpacity={0.4} />
            )}
          </>
        )}

        {/* Status */}
        {statusText && (
          <text x={CX} y={H - 3} textAnchor="middle"
            fontSize={7.5} fontFamily="inherit" fontWeight="500"
            fill={darkField ? '#e8e4ff' : isAnnular ? '#f59e0b' : '#92400e'}>
            {statusText}
          </text>
        )}
      </svg>
    </div>
  )
}
