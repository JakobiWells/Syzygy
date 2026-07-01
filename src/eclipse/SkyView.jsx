import { useState, useMemo, useRef, useEffect } from 'react'
import SunCalc from 'suncalc'
import { useSimTime } from '../time/TimeContext'
import { getMoonSunOffset } from './astroEngine'
import {
  skyColors, toXY, arcSegments, segToPath, hourlyMarkers, edgeArrow, buildDayArc,
} from './skyEngine'
import { useTerrainHorizon, buildTerrainPath } from './terrainHorizon'

function circleIntersectionArea(d, r1, r2) {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = Math.acos(Math.max(-1, Math.min(1, (d*d + r1*r1 - r2*r2) / (2*d*r1))))
  const b = Math.acos(Math.max(-1, Math.min(1, (d*d + r2*r2 - r1*r1) / (2*d*r2))))
  return r1*r1*a + r2*r2*b - r1*r1*Math.sin(2*a)/2 - r2*r2*Math.sin(2*b)/2
}

const W = 400, H = 280
const HORIZON_Y0 = Math.round(H * 0.65)   // default horizon y in viewBox px
const SCALE0 = 4                           // default px per degree

// Choose a "nice" altitude grid step for the current zoom
function niceStep(scale) {
  const raw = 50 / scale  // target ~50 viewBox px between lines
  for (const n of [0.5, 1, 2, 5, 10, 15, 30, 45, 90]) {
    if (n >= raw) return n
  }
  return 90
}

export default function SkyView({ lat, lng, initialFocus = 'sun', onClose }) {
  const { simTime, speed } = useSimTime()
  const [focus, setFocus] = useState(initialFocus)

  // View state: azimuth offset (deg), horizon y position (viewBox px), scale (px/deg).
  // On first open, shift the horizon down so the focused body (esp. a high-altitude moon
  // during a lunar eclipse) is visible with ~30px top padding instead of off-screen.
  const [view, setView] = useState(() => {
    const { moon, sun } = getMoonSunOffset(simTime, lat, lng)
    const bodyAlt = (initialFocus === 'moon' ? moon.alt : sun.alt) ?? 0
    const needHy  = 30 + Math.max(0, bodyAlt) * SCALE0   // hy that puts body 30px from top
    const hy      = needHy > HORIZON_Y0 ? Math.min(H + SCALE0 * 85, needHy) : HORIZON_Y0
    return { azOff: 0, hy, scale: SCALE0 }
  })

  const svgRef  = useRef(null)
  const dragRef = useRef(null)

  const terrainProfile = useTerrainHorizon(lat, lng)

  // Non-passive wheel → zoom around viewport center (H/2)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18
      setView(v => {
        const s2 = Math.max(H / 100, Math.min(80, v.scale * factor))  // min scale → 100° vertical FOV
        // Keep the altitude at screen centre fixed during zoom
        const altAtCenter = (v.hy - H / 2) / v.scale
        const hy2 = H / 2 + altAtCenter * s2
        return { ...v, scale: s2, hy: hy2 }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Day arcs use SunCalc (fast, ~10ms) rather than VSOP87 (slow, ~600ms).
  // SunCalc is accurate to ~1° which is more than sufficient for a visual path.
  const fastForward = Math.abs(speed) > 86400
  const dayKey = simTime && !fastForward ? Math.floor(simTime.getTime() / 86400000) : 0

  const sunArc  = useMemo(() => {
    if (lat == null || lng == null || fastForward) return []
    return buildDayArc(simTime, lat, lng, 'sun',  5)
  }, [lat, lng, dayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const moonArc = useMemo(() => {
    if (lat == null || lng == null || fastForward) return []
    return buildDayArc(simTime, lat, lng, 'moon', 5)
  }, [lat, lng, dayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep off the synchronous render path — bodyPos calls A.InverseRefraction which
  // has a zenith singularity (hang) if the altitude guard is ever bypassed.
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

  const { azOff, hy: horizonY, scale } = view
  const centerAz = ((focus === 'sun' ? sun.az : moon.az) + azOff + 720) % 360
  const colors   = skyColors(sun.alt)

  // Disc sizes — scale uniformly so the sun is always at least 5px,
  // preserving sun/moon ratio so eclipse overlap renders correctly
  const MIN_SUN_PX = 5
  const rawSunPx   = sun.angularRadius * scale
  const discScale  = rawSunPx > 0 ? Math.max(1, MIN_SUN_PX / rawSunPx) : 1
  const rSunPx  = sun.angularRadius  * scale * discScale
  const rMoonPx = moon.angularRadius * scale * discScale
  const sepPx   = sep * scale * discScale

  // Screen positions
  const sunXY  = toXY(sun.alt,  sun.az,  centerAz, W, horizonY, scale)
  const moonXY = toXY(moon.alt, moon.az, centerAz, W, horizonY, scale)

  // Eclipse
  const overlapping  = sepPx < rSunPx + rMoonPx
  const innerContact = sepPx < Math.abs(rSunPx - rMoonPx)
  const isTotal   = innerContact && rMoonPx >= rSunPx
  const isAnnular = innerContact && rMoonPx <  rSunPx

  const intersect = overlapping ? circleIntersectionArea(sepPx, rSunPx, rMoonPx) : 0
  const coverage  = Math.min(1, intersect / (Math.PI * rSunPx ** 2))
  const pct       = Math.round(coverage * 100)
  const darkField = isTotal || pct >= 100

  // Adaptive altitude gridlines
  const gridStep  = niceStep(scale)
  const altAtTop  = horizonY / scale                 // alt at y=0
  const altAtBot  = (horizonY - H) / scale           // alt at y=H
  const gridLines = []
  for (let a = Math.ceil(altAtBot / gridStep) * gridStep; a <= altAtTop; a += gridStep) {
    gridLines.push(a)
  }

  // Arc segments
  const sunSegs  = arcSegments(sunArc,  centerAz, W, horizonY, scale)
  const moonSegs = arcSegments(moonArc, centerAz, W, horizonY, scale)
  const sunHours  = hourlyMarkers(sunArc)
  const moonHours = hourlyMarkers(moonArc)

  // Arc alignment correction: SunCalc arcs (~1° accuracy) vs astronomy-engine discs (~0.001°).
  // At high zoom the positional difference becomes visible; translate arc groups to match disc positions.
  const _sunSC  = SunCalc.getPosition(simTime, lat, lng)
  const _moonSC = SunCalc.getMoonPosition(simTime, lat, lng)
  function _scAz(rad) { return ((rad * 180 / Math.PI) + 180 + 360) % 360 }
  const _sunArcXY  = toXY(_sunSC.altitude  * 180 / Math.PI, _scAz(_sunSC.azimuth),  centerAz, W, horizonY, scale)
  const _moonArcXY = toXY(_moonSC.altitude * 180 / Math.PI, _scAz(_moonSC.azimuth), centerAz, W, horizonY, scale)
  const sunArcDx  = (sunXY.x  - _sunArcXY.x).toFixed(2)
  const sunArcDy  = (sunXY.y  - _sunArcXY.y).toFixed(2)
  const moonArcDx = (moonXY.x - _moonArcXY.x).toFixed(2)
  const moonArcDy = (moonXY.y - _moonArcXY.y).toFixed(2)

  // Cardinal labels at horizon
  const cardinals = ['N','NE','E','SE','S','SW','W','NW'].map((label, i) => {
    const az = i * 45
    const x  = W / 2 + (((az - centerAz + 540) % 360) - 180) * scale
    return { label, x }
  }).filter(({ x }) => x > 8 && x < W - 8)

  // Edge arrows
  function offScreen(xy) { return xy.x < 0 || xy.x > W || xy.y < 0 || xy.y > H }
  const sunBelow  = sun.alt  < -0.5
  const moonBelow = moon.alt < -0.5

  // Phase disc paths
  const phaseKx      = Math.cos(moonPhase.cycle * 2 * Math.PI) * rMoonPx
  const phaseLit     = moonPhase.cycle < 0.5 ? 1 : 0
  const phaseStTerm  = phaseKx > 0 ? 1 : 0
  const phaseIsNew   = moonPhase.cycle < 0.005 || moonPhase.cycle > 0.995
  const phaseIsFull  = moonPhase.cycle > 0.495 && moonPhase.cycle < 0.505
  // Suppress lit path during eclipse overlap — moon is in new-moon orientation
  const phaseLitPath = (phaseIsNew || phaseIsFull || overlapping) ? null
    : `M 0,${-rMoonPx} A ${rMoonPx},${rMoonPx} 0 1 ${phaseLit} 0,${rMoonPx} A ${Math.abs(phaseKx).toFixed(2)},${rMoonPx} 0 0 ${phaseStTerm} 0,${-rMoonPx} Z`
  const sunArrow  = (!sunBelow  && offScreen(sunXY))  ? edgeArrow(W/2, H/2, sunXY.x,  sunXY.y,  W, H) : null
  const moonArrow = (!moonBelow && offScreen(moonXY)) ? edgeArrow(W/2, H/2, moonXY.x, moonXY.y, W, H) : null

  let statusText = ''
  if (!sunBelow && overlapping) {
    if (isTotal || pct >= 100) statusText = 'Total eclipse'
    else if (isAnnular)        statusText = 'Annular eclipse'
    else                       statusText = `${pct}% obscured`
  }

  // ── Pointer drag ─────────────────────────────────────────────────────────────
  function cssToVB() {
    if (!svgRef.current) return 1
    return W / svgRef.current.getBoundingClientRect().width
  }

  function onPointerDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = { sx: e.clientX, sy: e.clientY, azOff, horizonY, scale }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.style.cursor = 'grabbing'
  }

  function onPointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    const r  = cssToVB()
    const dx = (e.clientX - drag.sx) * r   // viewBox px
    const dy = (e.clientY - drag.sy) * r   // viewBox px
    // Capture drag values before setView runs asynchronously
    const { azOff: startAz, horizonY: startHY, scale: dragScale } = drag
    setView(v => ({
      ...v,
      azOff: startAz - dx / dragScale,
      hy:    startHY + dy,
    }))
  }

  function onPointerUp(e) {
    dragRef.current = null
    e.currentTarget.style.cursor = 'grab'
  }

  // Sun/Moon snap buttons reset pan offsets
  function snapTo(body) {
    setFocus(body)
    setView(v => ({ ...v, azOff: 0, hy: HORIZON_Y0 }))
  }

  return (
    <div className="sky-view-panel">
      <div className="sky-view-header">
        <span className="sky-view-title">Sky view</span>
        <div className="sky-disc-focus-btns">
          <button className={`sky-focus-btn${focus === 'sun'  ? ' active' : ''}`}
            onClick={() => snapTo('sun')}>Sun</button>
          <button className={`sky-focus-btn${focus === 'moon' ? ' active' : ''}`}
            onClick={() => snapTo('moon')}>Moon</button>
        </div>
        {statusText && <span className="sky-view-status">{statusText}</span>}
        <button className="lp-close" onClick={onClose}>✕</button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: '100%', height: 'auto', cursor: 'grab', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          {/* Gradient tracks the actual horizon position (userSpaceOnUse so we can use px coords) */}
          <linearGradient id="svGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={darkField ? '#08060f' : colors.top} />
            <stop offset={`${Math.min(100, (horizonY / H) * 100).toFixed(2)}%`} stopColor={darkField ? '#0d0a1a' : colors.bot} />
            <stop offset={`${Math.min(100, (horizonY / H) * 100).toFixed(2)}%`} stopColor="#3d2b1f" />
            <stop offset="100%" stopColor="#2a1f15" />
          </linearGradient>
          <clipPath id="svClip">
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>

        <rect x={0} y={0} width={W} height={H} fill="url(#svGrad)" />

        <g clipPath="url(#svClip)">
          {/* Terrain silhouette — drawn first so gridlines/discs render on top */}
          {(() => {
            const d = buildTerrainPath(terrainProfile, centerAz, W, H, horizonY, scale)
            return d ? <path d={d} fill="#2c2018" opacity={0.92} /> : null
          })()}

          {/* Adaptive altitude gridlines */}
          {gridLines.map(alt => {
            const y = horizonY - alt * scale
            const isHorizon = alt === 0
            return (
              <g key={alt}>
                <line x1={0} y1={y} x2={W} y2={y}
                  stroke={isHorizon ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}
                  strokeWidth={isHorizon ? 1 : 0.5} />
                {!isHorizon && (
                  <text x={4} y={y - 2} fontSize={7}
                    fill="rgba(255,255,255,0.30)" fontFamily="inherit">{alt}°</text>
                )}
              </g>
            )
          })}

          {/* Cardinal labels at the horizon */}
          {cardinals.map(({ label, x }) => (
            <text key={label} x={x} y={horizonY + 13}
              textAnchor="middle" fontSize={8.5}
              fill="rgba(255,255,255,0.50)" fontFamily="inherit" fontWeight="500">
              {label}
            </text>
          ))}

          {/* Day arc paths — translated to align SunCalc arcs with astronomy-engine disc positions */}
          <g transform={`translate(${sunArcDx},${sunArcDy})`}>
            {sunSegs.map((seg, i) => (
              <path key={i} d={segToPath(seg)}
                fill="none" stroke="#f0a500" strokeWidth={1.5} strokeOpacity={0.45}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {sunHours.map(pt => {
              const xy = toXY(pt.alt, pt.az, centerAz, W, horizonY, scale)
              if (xy.x < 0 || xy.x > W || xy.y < 0 || xy.y > H) return null
              return (
                <g key={pt.t.getTime()}>
                  <circle cx={xy.x} cy={xy.y} r={2.5} fill="#f0a500" opacity={0.65} />
                  <text x={xy.x + 4} y={xy.y - 3} fontSize={6.5}
                    fill="rgba(240,165,0,0.65)" fontFamily="inherit">
                    {pt.t.getUTCHours()}h
                  </text>
                </g>
              )
            })}
          </g>
          <g transform={`translate(${moonArcDx},${moonArcDy})`}>
            {moonSegs.map((seg, i) => (
              <path key={i} d={segToPath(seg)}
                fill="none" stroke="#b0b0c0" strokeWidth={1.5} strokeOpacity={0.45}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {moonHours.map(pt => {
              const xy = toXY(pt.alt, pt.az, centerAz, W, horizonY, scale)
              if (xy.x < 0 || xy.x > W || xy.y < 0 || xy.y > H) return null
              return (
                <g key={pt.t.getTime()}>
                  <circle cx={xy.x} cy={xy.y} r={2.5} fill="#b0b0c0" opacity={0.65} />
                </g>
              )
            })}
          </g>

          {/* Sun disc */}
          {!sunBelow && !offScreen(sunXY) && (
            <>
              {!darkField && (
                <>
                  <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx + 14}
                    fill="#f0a500" fillOpacity={0.06} />
                  <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx + 7}
                    fill="#f0a500" fillOpacity={0.12} />
                  <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx + 3}
                    fill="#f0a500" fillOpacity={0.18} />
                </>
              )}
              <circle cx={sunXY.x} cy={sunXY.y} r={rSunPx}
                fill={darkField ? '#110800' : '#fbbf24'} />
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

          {/* Corona during totality — only while sun is still above horizon */}
          {darkField && !sunBelow && !offScreen(moonXY) && (
            <>
              <circle cx={moonXY.x} cy={moonXY.y} r={rMoonPx + 1}
                fill="none" stroke="white" strokeWidth={2} strokeOpacity={0.85} />
              <circle cx={moonXY.x} cy={moonXY.y} r={rMoonPx + 7}
                fill="none" stroke="white" strokeWidth={6} strokeOpacity={0.20} />
              <circle cx={moonXY.x} cy={moonXY.y} r={rMoonPx + 16}
                fill="none" stroke="white" strokeWidth={8} strokeOpacity={0.09} />
            </>
          )}
        </g>

        {/* Edge arrows (outside clip so always visible at boundary) */}
        {sunArrow && (
          <polygon points="-5,0 5,0 0,9" fill="#f0a500"
            transform={`translate(${sunArrow.x},${sunArrow.y}) rotate(${sunArrow.angle})`}
            opacity={0.85} />
        )}
        {moonArrow && (
          <polygon points="-5,0 5,0 0,9" fill="#9090b0"
            transform={`translate(${moonArrow.x},${moonArrow.y}) rotate(${moonArrow.angle})`}
            opacity={0.85} />
        )}

        <text x={W - 4} y={H - 4} textAnchor="end" fontSize={6}
          fill="rgba(255,255,255,0.18)" fontFamily="inherit">
          scroll to zoom · drag to pan
        </text>
      </svg>
    </div>
  )
}
