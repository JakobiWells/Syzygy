import { useRef } from 'react'
import SunCalc from 'suncalc'
import { useSimTime } from '../time/TimeContext'

const PHASE_NAMES = [
  [0.033, 'New Moon'],
  [0.183, 'Waxing Crescent'],
  [0.316, 'First Quarter'],
  [0.433, 'Waxing Gibbous'],
  [0.566, 'Full Moon'],
  [0.683, 'Waning Gibbous'],
  [0.816, 'Last Quarter'],
  [0.966, 'Waning Crescent'],
  [1,     'New Moon'],
]

function phaseName(phase) {
  for (const [limit, name] of PHASE_NAMES) if (phase < limit) return name
  return 'New Moon'
}

export default function MoonPhaseView({ lat, lng, size = 72 }) {
  const { simTime } = useSimTime()


  const illum = SunCalc.getMoonIllumination(simTime)
  const pos   = SunCalc.getMoonPosition(simTime, lat, lng)

  const { fraction, phase, angle } = illum
  const rotateDeg    = (angle - pos.parallacticAngle) * (180 / Math.PI)
  const belowHorizon = pos.altitude < 0

  const R  = Math.floor((size - 4) / 2)
  const cx = size / 2
  const cy = size / 2

  // Lit-area path centred at (0,0): large-arc limb + small-arc terminator.
  const isNew  = phase < 0.005 || phase > 0.995
  const isFull = phase > 0.495 && phase < 0.505
  const lit    = phase < 0.5 ? 1 : 0
  const kx     = Math.cos(phase * 2 * Math.PI) * R
  const stTerm = kx > 0 ? 1 : 0
  const litD   = (isNew || isFull) ? null
    : `M 0 ${-R} A ${R} ${R} 0 1 ${lit} 0 ${R} A ${Math.abs(kx).toFixed(2)} ${R} 0 0 ${stTerm} 0 ${-R} Z`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ position: 'relative', width: size, height: size }}>

        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          style={{ display: 'block', opacity: belowHorizon ? 0.3 : 1 }}>

          {/* Dark base — always rendered first so new moon is never white */}
          <circle cx={cx} cy={cy} r={R} fill={isFull ? 'white' : '#111827'} />

          {/* Lit region drawn on top — only for phases between new and full */}
          {litD && (
            <g transform={`translate(${cx} ${cy}) rotate(${rotateDeg.toFixed(1)})`}>
              <path d={litD} fill="white" />
            </g>
          )}

          {/* Rim */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#374151" strokeWidth="0.8" />
        </svg>

      </div>

      <span style={{ fontSize: 11, fontWeight: 500, color: '#111827', lineHeight: 1 }}>
        {phaseName(phase)}
      </span>
      <span style={{ fontSize: 10, color: '#6b7280', lineHeight: 1 }}>
        {belowHorizon ? 'Below horizon' : `${Math.round(fraction * 100)}% illuminated`}
      </span>
    </div>
  )
}
