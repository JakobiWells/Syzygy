import { useMemo, useState } from 'react'
import { useSimTime } from '../time/TimeContext'
import * as A from 'astronomy-engine'
import OrreryPanel from './OrreryPanel'

const DEG  = Math.PI / 180
const INCL = 5.145 * DEG

// ── Ecliptic conversion (equatorial heliocentric → ecliptic XY) ──────────────
const EPS = 23.4392911 * DEG
function toEclXY(v) {
  return { x: v.x, y: v.y * Math.cos(EPS) + v.z * Math.sin(EPS) }
}

// ══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 1 — Earth orbit  (restored original)
// ══════════════════════════════════════════════════════════════════════════════

const EARTH_EL = {
  a: 1.00000011, e0: 0.01671022, edot: -3.804e-5,
  L0: 100.46435, Ldot: 35999.37306,
  w0: 102.94719, wdot: 0.31795,
}

function earthElements(T) {
  const e    = EARTH_EL.e0 + EARTH_EL.edot * T
  const L    = ((EARTH_EL.L0 + EARTH_EL.Ldot * T) % 360 + 360) % 360
  const wDeg = EARTH_EL.w0 + EARTH_EL.wdot * T
  const w    = wDeg * DEG
  let M = ((L - wDeg) % 360 + 360) % 360
  if (M > 180) M -= 360
  let E = M * DEG + e * Math.sin(M * DEG)
  for (let i = 0; i < 10; i++) {
    const dE = (M * DEG - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < 1e-12) break
  }
  const xO = EARTH_EL.a * (Math.cos(E) - e)
  const yO = EARTH_EL.a * Math.sqrt(1 - e * e) * Math.sin(E)
  const cosw = Math.cos(w), sinw = Math.sin(w)
  const x = xO * cosw - yO * sinw
  const y = xO * sinw + yO * cosw
  return { e, wDeg, x, y }
}

const S1 = 130, C1 = S1 / 2
const ER = 42, MR = 13
const LEADER = 14

function toScreen1(x, y) { return { x: C1 + ER * x, y: C1 - ER * y } }

function earthEllipsePath(T) {
  const e    = EARTH_EL.e0 + EARTH_EL.edot * T
  const w    = (EARTH_EL.w0 + EARTH_EL.wdot * T) * DEG
  const cosw = Math.cos(w), sinw = Math.sin(w)
  const segs = []
  for (let k = 0; k <= 120; k++) {
    const E  = (k / 120) * 2 * Math.PI
    const xO = EARTH_EL.a * (Math.cos(E) - e)
    const yO = EARTH_EL.a * Math.sqrt(1 - e * e) * Math.sin(E)
    const p  = toScreen1(xO * cosw - yO * sinw, xO * sinw + yO * cosw)
    segs.push(`${k === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  }
  return segs.join(' ')
}

function orbitPointAtLon(lonDeg, T) {
  const e   = EARTH_EL.e0 + EARTH_EL.edot * T
  const w   = (EARTH_EL.w0 + EARTH_EL.wdot * T) * DEG
  const lam = lonDeg * DEG
  const nu  = lam - w
  const r   = EARTH_EL.a * (1 - e * e) / (1 + e * Math.cos(nu))
  return toScreen1(r * Math.cos(lam), r * Math.sin(lam))
}

function moonLongitude(T) {
  const L  = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360
  const Mm = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360
  const Ms = ((357.5291 +  35999.0503 * T) % 360 + 360) % 360
  const D  = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360
  const λ  = L + 6.289 * Math.sin(Mm * DEG) - 1.274 * Math.sin((2*D - Mm) * DEG)
             + 0.658 * Math.sin(2*D * DEG) - 0.186 * Math.sin(Ms * DEG)
  return ((λ % 360) + 360) % 360 * DEG
}

function radialDirs(p) {
  const dx = p.x - C1, dy = p.y - C1, len = Math.hypot(dx, dy) || 1
  return { ox: dx/len, oy: dy/len, nx: -dy/len, ny: dx/len }
}

function OrbitLabel({ p, label, tick, dotFilled }) {
  const { ox, oy, nx, ny } = radialDirs(p)
  const lx = p.x + ox * LEADER, ly = p.y + oy * LEADER
  const tx = p.x + ox * (LEADER + 4), ty = p.y + oy * (LEADER + 4)
  return (
    <g>
      {tick && <line x1={p.x - nx*5} y1={p.y - ny*5} x2={p.x + nx*5} y2={p.y + ny*5}
        stroke="black" strokeWidth="1.6" />}
      {dotFilled != null && <circle cx={p.x} cy={p.y} r={3.2}
        fill={dotFilled ? 'black' : 'none'} stroke="black" strokeWidth={dotFilled ? 0 : 1.2} />}
      <line x1={p.x} y1={p.y} x2={lx} y2={ly} stroke="black" strokeWidth="0.6" />
      <text x={tx} y={ty} fontSize="7" textAnchor="middle" dominantBaseline="central"
        fill="black" opacity="0.85">{label}</text>
    </g>
  )
}

function EarthOrbitDiagram({ T }) {
  const d = useMemo(() => {
    const earth = earthElements(T)
    const mλ    = moonLongitude(T)
    const ep    = toScreen1(earth.x, earth.y)
    return {
      earthPt:     ep,
      earthPath:   earthEllipsePath(T),
      perihelion:  orbitPointAtLon(earth.wDeg,       T),
      aphelion:    orbitPointAtLon(earth.wDeg + 180, T),
      marEquinox:  orbitPointAtLon(0,   T),
      sepEquinox:  orbitPointAtLon(180, T),
      junSolstice: orbitPointAtLon(90,  T),
      decSolstice: orbitPointAtLon(270, T),
      mx: ep.x + MR * Math.cos(mλ),
      my: ep.y - MR * Math.sin(mλ),
    }
  }, [T])

  return (
    <svg width={S1} height={S1} viewBox={`0 0 ${S1} ${S1}`} aria-label="Earth orbit around the Sun">
      <path d={d.earthPath} fill="none" stroke="black" strokeWidth="0.6" />
      <circle cx={C1} cy={C1} r={3.5} fill="black" />
      <circle cx={d.earthPt.x} cy={d.earthPt.y} r={MR} fill="none" stroke="black" strokeWidth="0.6" />
      <circle cx={d.earthPt.x} cy={d.earthPt.y} r={2.5} fill="black" />
      <circle cx={d.mx} cy={d.my} r={1.8} fill="black" />
      <OrbitLabel p={d.marEquinox}  label="Vernal"    tick />
      <OrbitLabel p={d.sepEquinox}  label="Equinox"   tick />
      <OrbitLabel p={d.junSolstice} label="June"      tick />
      <OrbitLabel p={d.decSolstice} label="December"  tick />
      <OrbitLabel p={d.perihelion}  label="P" dotFilled />
      <OrbitLabel p={d.aphelion}    label="A" dotFilled={false} />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 2 — Full solar system  (new, accurate elliptical orbits)
// ══════════════════════════════════════════════════════════════════════════════

// J2000 Keplerian elements: [a (AU), e, w̃ (longitude of perihelion, deg)]
// w̃ = argument of perihelion + longitude of ascending node
const PLANET_EL = [
  { body: A.Body.Mercury, a: 0.38710,  e: 0.20563, w: 77.46,  dot: 1.4 },
  { body: A.Body.Venus,   a: 0.72333,  e: 0.00677, w: 131.77, dot: 1.6 },
  { body: A.Body.Earth,   a: 1.00000,  e: 0.01671, w: 102.94, dot: 1.6 },
  { body: A.Body.Mars,    a: 1.52366,  e: 0.09341, w: 336.04, dot: 1.4 },
  { body: A.Body.Jupiter, a: 5.20336,  e: 0.04839, w: 14.75,  dot: 2.6 },
  { body: A.Body.Saturn,  a: 9.53707,  e: 0.05415, w: 92.43,  dot: 2.3, rings: true },
  { body: A.Body.Uranus,  a: 19.1913,  e: 0.04717, w: 170.96, dot: 2.0 },
  { body: A.Body.Neptune, a: 30.0690,  e: 0.00859, w: 44.97,  dot: 2.0 },
]

const MAX_AU = 31
const S2 = 130, C2 = S2 / 2, R2 = C2 - 4

// Cube-root radial scale keeps inner planets readable while fitting all 8
function auToPx(au) { return Math.cbrt(Math.abs(au) / MAX_AU) * R2 }

// SVG path for true elliptical orbit projected onto ecliptic plane
function ellipsePath(a, e, wDeg, steps = 80) {
  const wRad = wDeg * DEG
  const segs = []
  for (let k = 0; k <= steps; k++) {
    const nu  = (k / steps) * 2 * Math.PI
    const r   = a * (1 - e * e) / (1 + e * Math.cos(nu))
    const lam = nu + wRad
    const pr  = auToPx(r)
    const px  = C2 + pr * Math.cos(lam)
    const py  = C2 - pr * Math.sin(lam)
    segs.push(`${k === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`)
  }
  return segs.join(' ') + 'Z'
}

function SolarSystemDiagram({ astTime }) {
  const pts = useMemo(() => PLANET_EL.map(p => {
    try {
      const hv  = A.HelioVector(p.body, astTime)
      const ecl = toEclXY(hv)
      const r   = Math.sqrt(ecl.x * ecl.x + ecl.y * ecl.y)
      const ang = Math.atan2(ecl.y, ecl.x)
      const pr  = auToPx(r)
      return { ...p, px: C2 + pr * Math.cos(ang), py: C2 - pr * Math.sin(ang) }
    } catch { return null }
  }).filter(Boolean), [astTime])

  // Pre-compute ellipse paths (static — orbital elements don't change noticeably in human timescales)
  const orbits = useMemo(() => PLANET_EL.map(p => ellipsePath(p.a, p.e, p.w)), [])

  return (
    <svg width={S2} height={S2} viewBox={`0 0 ${S2} ${S2}`} aria-label="Solar system top-down view">
      {/* Elliptical orbit paths */}
      {orbits.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="black" strokeWidth="0.5" opacity="0.3" />
      ))}

      {/* Sun */}
      <circle cx={C2} cy={C2} r={3.5} fill="black" />

      {/* Planets */}
      {pts.map((p, i) => (
        <g key={i}>
          {p.rings && (
            <ellipse cx={p.px} cy={p.py} rx={p.dot + 3} ry={p.dot + 0.8}
              fill="none" stroke="black" strokeWidth="0.7" opacity="0.55"
              transform={`rotate(-25,${p.px},${p.py})`} />
          )}
          <circle cx={p.px} cy={p.py} r={p.dot} fill="black" />
        </g>
      ))}
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 3 — Earth–Moon isometric  (restored original)
// ══════════════════════════════════════════════════════════════════════════════

const S3 = 130, C3 = S3 / 2
const OA = 0.72, OB = 0.32, CZ = 8.5
const R3 = 30,   P3 = 37

function proj(wx, wy, wz) {
  return { x: C3 + (wx - wy) * OA, y: C3 - (wx + wy) * OB - wz * CZ }
}

function orbitSeg(Fstart, Fend, steps = 60) {
  const segs = []
  for (let k = 0; k <= steps; k++) {
    const F = (Fstart + (Fend - Fstart) * k / steps) * DEG
    const p = proj(R3 * Math.cos(F), R3 * Math.sin(F) * Math.cos(INCL), R3 * Math.sin(F) * Math.sin(INCL))
    segs.push(`${k === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  }
  return segs.join(' ')
}

const PATH_ABOVE = orbitSeg(0, 180)
const PATH_BELOW = orbitSeg(180, 360)
const PC = [proj(P3,P3,0), proj(-P3,P3,0), proj(-P3,-P3,0), proj(P3,-P3,0)]
const PLANE_D = PC.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + 'Z'
const GX = [proj(-P3,0,0), proj(P3,0,0)]
const GY = [proj(0,-P3,0), proj(0,P3,0)]
const EARTH3 = proj(0,  0, 0)
const NODE_A  = proj( R3, 0, 0)
const NODE_D  = proj(-R3, 0, 0)

function moonF(T) { return ((93.2721 + 483202.0175 * T) % 360 + 360) % 360 }

function EarthMoonDiagram({ T }) {
  const d = useMemo(() => {
    const F = moonF(T) * DEG
    return {
      moonPt:  proj(R3 * Math.cos(F), R3 * Math.sin(F) * Math.cos(INCL), R3 * Math.sin(F) * Math.sin(INCL)),
      moonEcl: proj(R3 * Math.cos(F), R3 * Math.sin(F) * Math.cos(INCL), 0),
    }
  }, [T])

  return (
    <svg width={S3} height={S3} viewBox={`0 0 ${S3} ${S3}`} aria-label="Earth–Moon orbital inclination">
      <path d={PATH_BELOW} fill="none" stroke="black" strokeWidth="0.7"
        strokeDasharray="2,2" strokeOpacity="0.35" />
      <path d={PLANE_D} fill="rgba(0,0,0,0.06)" stroke="black" strokeWidth="0.7" />
      <line x1={GX[0].x} y1={GX[0].y} x2={GX[1].x} y2={GX[1].y}
        stroke="black" strokeWidth="0.4" strokeOpacity="0.25" />
      <line x1={GY[0].x} y1={GY[0].y} x2={GY[1].x} y2={GY[1].y}
        stroke="black" strokeWidth="0.4" strokeOpacity="0.25" />
      <path d={PATH_ABOVE} fill="none" stroke="black" strokeWidth="0.8" />
      {[NODE_A, NODE_D].map((n, i) => (
        <g key={i}>
          <line x1={n.x-2} y1={n.y-2} x2={n.x+2} y2={n.y+2} stroke="black" strokeWidth="0.8" />
          <line x1={n.x-2} y1={n.y+2} x2={n.x+2} y2={n.y-2} stroke="black" strokeWidth="0.8" />
        </g>
      ))}
      <circle cx={EARTH3.x} cy={EARTH3.y} r={2.5} fill="black" />
      <line x1={d.moonPt.x} y1={d.moonPt.y} x2={d.moonEcl.x} y2={d.moonEcl.y}
        stroke="black" strokeWidth="0.5" strokeOpacity="0.35" strokeDasharray="1.5,1.5" />
      <circle cx={d.moonEcl.x} cy={d.moonEcl.y} r={1.2} fill="black" fillOpacity="0.25" />
      <circle cx={d.moonPt.x} cy={d.moonPt.y} r={1.8} fill="black" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Combined widget
// ══════════════════════════════════════════════════════════════════════════════
export default function SolarSystem() {
  const { simTime } = useSimTime()
  const [expanded, setExpanded] = useState(false)
  const T       = (simTime.getTime() / 86400000 - 10957.5) / 36525
  const astTime = useMemo(() => A.MakeTime(simTime), [simTime])

  return (
    <>
      {expanded && <OrreryPanel onClose={() => setExpanded(false)} />}
      <div style={{
        position: 'absolute',
        bottom: 14,
        right: 14,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
      }}>
        <EarthOrbitDiagram T={T} />
        <div style={{ position: 'relative' }}>
          <SolarSystemDiagram astTime={astTime} />
          <button
            className="orrery-expand-btn"
            onClick={() => setExpanded(true)}
            title="Open solar system orrery"
          >⤢</button>
        </div>
        <EarthMoonDiagram T={T} />
      </div>
    </>
  )
}
