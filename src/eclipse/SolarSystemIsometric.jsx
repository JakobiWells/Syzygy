import { useMemo } from 'react'
import { useSimTime } from '../time/TimeContext'

const DEG    = Math.PI / 180
const INCL   = 5.145 * DEG   // Moon orbital inclination to ecliptic

// ── Earth Keplerian elements (JPL Standish 1992) ─────────────────────────────
const EARTH = { a: 1.00000011, e0: 0.01671022, edot: -3.804e-5, L0: 100.46435, Ldot: 35999.37306, w0: 102.94719, wdot: 0.31795 }

function earthLongitude(T) {
  const e = EARTH.e0 + EARTH.edot * T
  const L = ((EARTH.L0 + EARTH.Ldot * T) % 360 + 360) % 360
  const w = EARTH.w0 + EARTH.wdot * T
  let M = ((L - w) % 360 + 360) % 360
  if (M > 180) M -= 360
  const eDeg = e * 180 / Math.PI
  let E = M + eDeg * Math.sin(M * DEG)
  for (let i = 0; i < 10; i++) {
    const dE = (M - E + eDeg * Math.sin(E * DEG)) / (1 - e * Math.cos(E * DEG))
    E += dE
    if (Math.abs(dE) < 1e-9) break
  }
  const xO = EARTH.a * (Math.cos(E * DEG) - e)
  const yO = EARTH.a * Math.sqrt(1 - e * e) * Math.sin(E * DEG)
  return Math.atan2(yO, xO) + w * DEG
}

function moonLongitude(T) {
  const L  = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360
  const Mm = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360
  const Ms = ((357.5291 +  35999.0503 * T) % 360 + 360) % 360
  const D  = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360
  const λ  = L
    + 6.289 * Math.sin(Mm * DEG)
    - 1.274 * Math.sin((2 * D - Mm) * DEG)
    + 0.658 * Math.sin(2 * D * DEG)
    - 0.186 * Math.sin(Ms * DEG)
  return ((λ % 360) + 360) % 360 * DEG
}

// Argument of latitude: 0° at ascending node, increases with Moon's motion
function moonF(T) {
  return ((93.2721 + 483202.0175 * T) % 360 + 360) % 360
}

// ── Diagram 1 constants ───────────────────────────────────────────────────────
const S1 = 130, C1 = S1 / 2
const ER = 42, MR = 13

// ── Diagram 2: isometric projection of Earth-Moon system ─────────────────────
//
// Axes:  X (ecliptic east) → right-down on screen
//        Y (ecliptic north-ecliptic) → left-down on screen
//        Z (above ecliptic) → straight up on screen (amplified × CZ so 5° is visible)
//
const S2  = 130, C2 = S2 / 2
const OA  = 0.72   // X/Y screen scale
const OB  = 0.32   // depth foreshortening
const CZ  = 8.5    // Z amplification (makes 5.145° clearly visible)
const R2  = 30     // Moon orbit radius in diagram units
const P2  = 37     // ecliptic plane half-extent

function proj(wx, wy, wz) {
  return {
    x: C2 + (wx - wy) * OA,
    y: C2 - (wx + wy) * OB - wz * CZ,
  }
}

// Orbit parametric segment: F in degrees, returns SVG path string
function orbitPath(Fstart, Fend, steps = 60) {
  const segs = []
  for (let k = 0; k <= steps; k++) {
    const F = (Fstart + (Fend - Fstart) * k / steps) * DEG
    const p = proj(
      R2 * Math.cos(F),
      R2 * Math.sin(F) * Math.cos(INCL),
      R2 * Math.sin(F) * Math.sin(INCL),
    )
    segs.push(`${k === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  }
  return segs.join(' ')
}

// ── Module-level constants (don't depend on time) ─────────────────────────────
const PATH_ABOVE = orbitPath(0, 180)    // Moon above ecliptic (F 0→180)
const PATH_BELOW = orbitPath(180, 360)  // Moon below ecliptic (F 180→360)

// Ecliptic plane: square in the world XY plane (z=0), drawn as a diamond in screen space
const PC = [proj(P2,P2,0), proj(-P2,P2,0), proj(-P2,-P2,0), proj(P2,-P2,0)]
const PLANE_D = PC.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + 'Z'

// Grid cross on the ecliptic plane (x-axis and y-axis lines)
const GX = [proj(-P2, 0, 0), proj(P2,  0, 0)]
const GY = [proj(0, -P2, 0), proj(0,  P2, 0)]

const EARTH2 = proj(0, 0, 0)
const NODE_A = proj( R2, 0, 0)   // ascending node  (F = 0°)
const NODE_D = proj(-R2, 0, 0)   // descending node (F = 180°)

export default function SolarSystem() {
  const { simTime } = useSimTime()

  const d = useMemo(() => {
    const T   = (simTime.getTime() / 86400000 - 10957.5) / 36525

    // Diagram 1
    const eλ  = earthLongitude(T)
    const mλ  = moonLongitude(T)
    const ex  = C1 + ER * Math.cos(eλ)
    const ey  = C1 - ER * Math.sin(eλ)

    // Diagram 2
    const F   = moonF(T) * DEG
    const wx  = R2 * Math.cos(F)
    const wy  = R2 * Math.sin(F) * Math.cos(INCL)
    const wz  = R2 * Math.sin(F) * Math.sin(INCL)

    return {
      ex, ey,
      mx:      ex + MR * Math.cos(mλ),
      my:      ey - MR * Math.sin(mλ),
      moonPt:  proj(wx, wy, wz),   // Moon's actual 3D position
      moonEcl: proj(wx, wy, 0),    // Moon's shadow on the ecliptic plane
    }
  }, [simTime])

  return (
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

      {/* Diagram 1 — heliocentric top-down: Sun · Earth · Moon */}
      <svg width={S1} height={S1} viewBox={`0 0 ${S1} ${S1}`}>
        <circle cx={C1} cy={C1} r={ER} fill="none" stroke="black" strokeWidth="0.6" />
        <circle cx={C1} cy={C1} r={3.5} fill="black" />
        <circle cx={d.ex} cy={d.ey} r={MR} fill="none" stroke="black" strokeWidth="0.6" />
        <circle cx={d.ex} cy={d.ey} r={2.5} fill="black" />
        <circle cx={d.mx} cy={d.my} r={1.8} fill="black" />
      </svg>

      {/* Diagram 2 — Earth-Moon isometric tilt view */}
      <svg width={S2} height={S2} viewBox={`0 0 ${S2} ${S2}`}>

        {/* Below-ecliptic orbit — rendered first so the plane occludes it */}
        <path d={PATH_BELOW} fill="none" stroke="black" strokeWidth="0.7"
          strokeDasharray="2,2" strokeOpacity="0.35" />

        {/* Ecliptic plane diamond */}
        <path d={PLANE_D} fill="rgba(0,0,0,0.06)" stroke="black" strokeWidth="0.7" />

        {/* Grid cross on the plane */}
        <line x1={GX[0].x} y1={GX[0].y} x2={GX[1].x} y2={GX[1].y}
          stroke="black" strokeWidth="0.4" strokeOpacity="0.25" />
        <line x1={GY[0].x} y1={GY[0].y} x2={GY[1].x} y2={GY[1].y}
          stroke="black" strokeWidth="0.4" strokeOpacity="0.25" />

        {/* Above-ecliptic orbit — rendered on top of plane */}
        <path d={PATH_ABOVE} fill="none" stroke="black" strokeWidth="0.8" />

        {/* Node marks × at ecliptic crossings */}
        {[NODE_A, NODE_D].map((n, i) => (
          <g key={i}>
            <line x1={n.x-2} y1={n.y-2} x2={n.x+2} y2={n.y+2} stroke="black" strokeWidth="0.8" />
            <line x1={n.x-2} y1={n.y+2} x2={n.x+2} y2={n.y-2} stroke="black" strokeWidth="0.8" />
          </g>
        ))}

        {/* Earth at ecliptic plane center */}
        <circle cx={EARTH2.x} cy={EARTH2.y} r={2.5} fill="black" />

        {/* Drop line: Moon → its ecliptic projection (shows depth clearly) */}
        <line
          x1={d.moonPt.x}  y1={d.moonPt.y}
          x2={d.moonEcl.x} y2={d.moonEcl.y}
          stroke="black" strokeWidth="0.5" strokeOpacity="0.35" strokeDasharray="1.5,1.5"
        />

        {/* Shadow dot on ecliptic plane */}
        <circle cx={d.moonEcl.x} cy={d.moonEcl.y} r={1.2} fill="black" fillOpacity="0.25" />

        {/* Moon */}
        <circle cx={d.moonPt.x} cy={d.moonPt.y} r={1.8} fill="black" />

      </svg>
    </div>
  )
}
