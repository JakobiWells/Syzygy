import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import * as A from 'astronomy-engine'
import { useSimTime } from '../time/TimeContext'
import { cometPositions } from './cometData'

const DEG = Math.PI / 180
const EPS = 23.4392911 * DEG   // obliquity

// ── Ecliptic projection ───────────────────────────────────────────────────────

function toEclXY(v) {
  return { x: v.x, y: v.y * Math.cos(EPS) + v.z * Math.sin(EPS) }
}

// ── Planet catalogue ─────────────────────────────────────────────────────────

const PLANETS = [
  { body: A.Body.Mercury, name: 'Mercury', a: 0.38710,  e: 0.20563, w: 77.46,  r: 3,   color: '#94a3b8' },
  { body: A.Body.Venus,   name: 'Venus',   a: 0.72333,  e: 0.00677, w: 131.77, r: 4,   color: '#fde68a' },
  { body: A.Body.Earth,   name: 'Earth',   a: 1.00000,  e: 0.01671, w: 102.94, r: 4,   color: '#34d399' },
  { body: A.Body.Mars,    name: 'Mars',    a: 1.52366,  e: 0.09341, w: 336.04, r: 3.5, color: '#f87171' },
  { body: A.Body.Jupiter, name: 'Jupiter', a: 5.20336,  e: 0.04839, w: 14.75,  r: 7,   color: '#fdba74' },
  { body: A.Body.Saturn,  name: 'Saturn',  a: 9.53707,  e: 0.05415, w: 92.43,  r: 6,   color: '#e2d9c5', rings: true },
  { body: A.Body.Uranus,  name: 'Uranus',  a: 19.1913,  e: 0.04717, w: 170.96, r: 5,   color: '#67e8f9' },
  { body: A.Body.Neptune, name: 'Neptune', a: 30.0690,  e: 0.00859, w: 44.97,  r: 5,   color: '#818cf8' },
]

const INNER_PLANETS = PLANETS.slice(0, 4)

// ── Scale functions ───────────────────────────────────────────────────────────

const FULL_MAX_AU = 31
const INNER_MAX_AU = 1.8

function makePxFn(mode, halfSize) {
  if (mode === 'inner') {
    return (au) => (au / INNER_MAX_AU) * halfSize
  }
  return (au) => Math.cbrt(Math.abs(au) / FULL_MAX_AU) * halfSize
}

// ── Orbit path ───────────────────────────────────────────────────────────────

function ellipsePath(a, e, wDeg, auToPx, cx, cy, steps = 100) {
  const wRad = wDeg * DEG
  const segs = []
  for (let k = 0; k <= steps; k++) {
    const nu  = (k / steps) * 2 * Math.PI
    const r   = a * (1 - e * e) / (1 + e * Math.cos(nu))
    const lam = nu + wRad
    const pr  = auToPx(r)
    segs.push(`${k === 0 ? 'M' : 'L'}${(cx + pr * Math.cos(lam)).toFixed(2)},${(cy - pr * Math.sin(lam)).toFixed(2)}`)
  }
  return segs.join(' ') + 'Z'
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ item, x, y }) {
  if (!item) return null
  const lines = item.lines ?? []
  return (
    <div className="orrery-tooltip" style={{ left: x + 14, top: y - 10 }}>
      <div className="orrery-tooltip-name">{item.name}</div>
      {lines.map((l, i) => <div key={i} className="orrery-tooltip-line">{l}</div>)}
    </div>
  )
}

// ── Main OrreryPanel ─────────────────────────────────────────────────────────

export default function OrreryPanel({ onClose, onJumpToDate }) {
  const { simTime } = useSimTime()
  const svgRef      = useRef(null)

  // View state
  const [mode, setMode]         = useState('full')   // 'full' | 'inner'
  const [vx, setVx]             = useState(0)
  const [vy, setVy]             = useState(0)
  const [scale, setScale]       = useState(1)
  const [hovered, setHovered]   = useState(null)     // { name, lines }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState(null)

  const panRef   = useRef(null)
  const SIZE     = 700   // SVG logical size
  const CX       = SIZE / 2
  const CY       = SIZE / 2

  const auToPx = useMemo(() => makePxFn(mode, CX - 20), [mode])
  const planets = useMemo(() => mode === 'inner' ? INNER_PLANETS : PLANETS, [mode])

  // Reset view when mode changes
  useEffect(() => { setVx(0); setVy(0); setScale(1) }, [mode])

  // Astronomy time
  const astTime = useMemo(() => A.MakeTime(simTime), [simTime])

  // Planet positions
  const planetPts = useMemo(() =>
    planets.map(p => {
      try {
        const hv  = A.HelioVector(p.body, astTime)
        const ecl = toEclXY(hv)
        const r   = Math.sqrt(ecl.x ** 2 + ecl.y ** 2)
        const ang = Math.atan2(ecl.y, ecl.x)
        const pr  = auToPx(r)
        return { ...p, ecl, r, svgX: CX + pr * Math.cos(ang), svgY: CY - pr * Math.sin(ang) }
      } catch { return null }
    }).filter(Boolean),
    [astTime, auToPx, planets]
  )

  // Earth position (always needed for distance calc)
  const earthPos = useMemo(() => {
    try {
      const hv = A.HelioVector(A.Body.Earth, astTime)
      return toEclXY(hv)
    } catch { return { x: 1, y: 0 } }
  }, [astTime])

  // Comet positions
  const cometPts = useMemo(() => {
    const maxAU = mode === 'inner' ? INNER_MAX_AU : FULL_MAX_AU
    return cometPositions(simTime, maxAU).map(c => {
      const ecl = { x: c.pos.x, y: c.pos.y * Math.cos(EPS) + c.pos.z * Math.sin(EPS) }
      const r   = Math.sqrt(ecl.x ** 2 + ecl.y ** 2)
      const ang = Math.atan2(ecl.y, ecl.x)
      const pr  = auToPx(r)
      return { ...c, ecl, r, svgX: CX + pr * Math.cos(ang), svgY: CY - pr * Math.sin(ang) }
    })
  }, [simTime, auToPx, mode])

  // Orbit paths (recomputed when mode changes)
  const orbits = useMemo(() =>
    planets.map(p => ({ ...p, d: ellipsePath(p.a, p.e, p.w, auToPx, CX, CY) })),
    [planets, auToPx]
  )

  // ── Pointer interaction ───────────────────────────────────────────────────

  const toSvgCoords = useCallback((clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { sx: 0, sy: 0 }
    const rx = (clientX - rect.left) / rect.width  * SIZE
    const ry = (clientY - rect.top)  / rect.height * SIZE
    return { sx: (rx - CX - vx) / scale + CX, sy: (ry - CY - vy) / scale + CY }
  }, [vx, vy, scale])

  const hitTest = useCallback((sx, sy) => {
    for (const p of planetPts) {
      if (Math.hypot(p.svgX - sx, p.svgY - sy) < 14) return { type: 'planet', item: p }
    }
    for (const c of cometPts) {
      if (Math.hypot(c.svgX - sx, c.svgY - sy) < 12) return { type: 'comet', item: c }
    }
    return null
  }, [planetPts, cometPts])

  const onPointerMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (panRef.current) {
      const dx = e.clientX - panRef.current.lastX
      const dy = e.clientY - panRef.current.lastY
      setVx(v => v + dx)
      setVy(v => v + dy)
      panRef.current.lastX = e.clientX
      panRef.current.lastY = e.clientY
      return
    }
    const { sx, sy } = toSvgCoords(e.clientX, e.clientY)
    const hit = hitTest(sx, sy)
    if (hit) {
      const it = hit.item
      const distSun  = it.r?.toFixed(3) ?? '?'
      const dx = it.ecl.x - earthPos.x, dy = it.ecl.y - earthPos.y
      const distEarth = Math.sqrt(dx**2 + dy**2).toFixed(3)
      setHovered({ name: it.name, lines: [`${distSun} AU from Sun`, `${distEarth} AU from Earth`] })
    } else {
      setHovered(null)
    }
  }, [toSvgCoords, hitTest, earthPos])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    const { sx, sy } = toSvgCoords(e.clientX, e.clientY)
    const hit = hitTest(sx, sy)
    if (hit) { setSelected(hit.item); return }
    panRef.current = { lastX: e.clientX, lastY: e.clientY }
    svgRef.current?.setPointerCapture(e.pointerId)
  }, [toSvgCoords, hitTest])

  const onPointerUp = useCallback(() => { panRef.current = null }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    setScale(s => Math.max(0.2, Math.min(10, s * factor)))
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const zoom = (dir) => setScale(s => Math.max(0.2, Math.min(10, s * (dir > 0 ? 1.25 : 0.8))))

  // ── Transform ─────────────────────────────────────────────────────────────

  const transform = `translate(${CX + vx},${CY + vy}) scale(${scale}) translate(${-CX},${-CY})`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="orrery-panel" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="orrery-inner">

        {/* Header */}
        <div className="orrery-header">
          <span className="orrery-title">Solar System</span>
          <div className="orrery-header-controls">
            <div className="eclipse-kind-toggle">
              <button className={`eclipse-kind-btn${mode === 'full'  ? ' is-active' : ''}`} onClick={() => setMode('full')}>Full</button>
              <button className={`eclipse-kind-btn${mode === 'inner' ? ' is-active' : ''}`} onClick={() => setMode('inner')}>Inner</button>
            </div>
            <div className="orrery-zoom-btns">
              <button className="orrery-zoom-btn" onClick={() => zoom(1)}>+</button>
              <button className="orrery-zoom-btn" onClick={() => zoom(-1)}>−</button>
            </div>
            <button className="orrery-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* SVG */}
        <svg
          ref={svgRef}
          className="orrery-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { setHovered(null); panRef.current = null }}
        >
          <rect width={SIZE} height={SIZE} fill="transparent" />
          <g transform={transform}>

            {/* Vernal equinox reference */}
            <line x1={CX} y1={CY} x2={CX + (CX - 24)} y2={CY}
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeDasharray="4,4" />

            {/* Orbit ellipses */}
            {orbits.map(p => (
              <path key={p.name} d={p.d} fill="none"
                stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
            ))}

            {/* Sun */}
            <circle cx={CX} cy={CY} r={8} fill="#fbbf24" opacity="0.95" />
            <circle cx={CX} cy={CY} r={14} fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.25" />

            {/* Comets */}
            {cometPts.map(c => (
              <g key={c.id}>
                <circle cx={c.svgX} cy={c.svgY} r={4} fill={c.color} opacity="0.85" />
                <text x={c.svgX + 6} y={c.svgY - 5} fill={c.color} fontSize="9" opacity="0.8">{c.name}</text>
              </g>
            ))}

            {/* Planets */}
            {planetPts.map(p => (
              <g key={p.name} style={{ cursor: 'pointer' }}>
                {p.rings && (
                  <ellipse cx={p.svgX} cy={p.svgY}
                    rx={p.r + 5} ry={p.r + 1.5}
                    fill="none" stroke={p.color} strokeWidth="1.2" opacity="0.5"
                    transform={`rotate(-20,${p.svgX},${p.svgY})`} />
                )}
                <circle cx={p.svgX} cy={p.svgY} r={p.r} fill={p.color} opacity="0.92" />
                {(scale > 0.8 || mode === 'inner') && (
                  <text x={p.svgX} y={p.svgY - p.r - 4}
                    fill={p.color} fontSize="9" textAnchor="middle" opacity="0.8">
                    {p.name}
                  </text>
                )}
                {selected?.name === p.name && (
                  <circle cx={p.svgX} cy={p.svgY} r={p.r + 4}
                    fill="none" stroke={p.color} strokeWidth="1.5" opacity="0.7" />
                )}
              </g>
            ))}

          </g>
        </svg>

        {/* Tooltip */}
        <Tooltip item={hovered} x={mousePos.x} y={mousePos.y} />

        {/* Selected planet info */}
        {selected && (() => {
          const pt = planetPts.find(p => p.name === selected.name)
          if (!pt) return null
          const dx = pt.ecl.x - earthPos.x
          const dy = pt.ecl.y - earthPos.y
          const distEarth = Math.sqrt(dx**2 + dy**2).toFixed(3)
          return (
            <div className="orrery-planet-info">
              <div className="orrery-planet-info-name" style={{ color: pt.color }}>{pt.name}</div>
              <div className="orrery-planet-info-row">{pt.r.toFixed(3)} AU from Sun</div>
              <div className="orrery-planet-info-row">{distEarth} AU from Earth</div>
              <button className="orrery-planet-info-close" onClick={() => setSelected(null)}>✕</button>
            </div>
          )
        })()}

        {/* Date display */}
        <div className="orrery-date">
          {simTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        </div>

      </div>
    </div>
  )
}
