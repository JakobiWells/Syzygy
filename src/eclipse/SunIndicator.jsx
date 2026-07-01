import { useState, useEffect, useRef } from 'react'
import { useSimTime } from '../time/TimeContext'
import { getSubSolarPoint } from './daynight'

function SunSVG({ size }) {
  const c = size / 2
  const inner = c * 0.38
  const outer = c * 0.72
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const r = a * Math.PI / 180
        return (
          <line key={a}
            x1={c + Math.cos(r) * (inner + 1)} y1={c + Math.sin(r) * (inner + 1)}
            x2={c + Math.cos(r) * outer}        y2={c + Math.sin(r) * outer}
            stroke="#f59e0b" strokeWidth={size * 0.09} strokeLinecap="round"
          />
        )
      })}
      <circle cx={c} cy={c} r={inner} fill="#fbbf24" />
    </svg>
  )
}

function fmt(n, dir) {
  return `${Math.abs(n).toFixed(3)}° ${dir}`
}

function backSideOpacity(map, lng, lat) {
  const center = map.getCenter()
  const φ1 = center.lat * Math.PI / 180
  const φ2 = lat        * Math.PI / 180
  const Δλ = (lng - center.lng) * Math.PI / 180
  const cosD = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  // fade starts at the limb (cosD=0) and reaches 0.25 opacity well behind (cosD=-0.25)
  return cosD >= 0 ? 1 : Math.max(0.25, 1 + cosD * 3)
}

export default function SunIndicator({ map, onFlyTo }) {
  const { simTime } = useSimTime()
  const [pos, setPos]         = useState(null)
  const [coords, setCoords]   = useState(null)
  const [opacity, setOpacity] = useState(1)
  const [showTip, setShowTip] = useState(false)
  const tipTimer              = useRef(null)

  useEffect(() => {
    if (!map) return

    function update() {
      const [sunLng, sunLat] = getSubSolarPoint(simTime)
      setCoords([sunLng, sunLat])
      setOpacity(backSideOpacity(map, sunLng, sunLat))
      const canvas = map.getCanvas()
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width  / dpr
      const h = canvas.height / dpr

      let pt
      try { pt = map.project([sunLng, sunLat]) } catch { return }

      const MARGIN = 44
      const cx = w / 2, cy = h / 2
      const dx = pt.x - cx
      const dy = pt.y - cy
      const angle = Math.atan2(dy, dx)

      const onScreen =
        pt.x >= MARGIN && pt.x <= w - MARGIN &&
        pt.y >= MARGIN && pt.y <= h - MARGIN

      if (onScreen) {
        setPos({ x: pt.x, y: pt.y, angle, onScreen: true })
        return
      }

      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) return
      const nx = dx / len, ny = dy / len

      const t = Math.min(
        ...[
          nx >  0.001 ? (w - MARGIN - cx) / nx : Infinity,
          nx < -0.001 ? (MARGIN - cx)     / nx : Infinity,
          ny >  0.001 ? (h - MARGIN - cy) / ny : Infinity,
          ny < -0.001 ? (MARGIN - cy)     / ny : Infinity,
        ].filter(v => v > 0 && isFinite(v))
      )
      if (!isFinite(t)) return

      setPos({ x: cx + nx * t, y: cy + ny * t, angle, onScreen: false })
    }

    update()
    map.on('move', update)
    map.on('resize', update)
    return () => { map.off('move', update); map.off('resize', update) }
  }, [map, simTime])

  function handleClick() {
    if (!coords) return
    onFlyTo?.(coords)
    clearTimeout(tipTimer.current)
    setShowTip(true)
    tipTimer.current = setTimeout(() => setShowTip(false), 3000)
  }

  if (!pos) return null

  const tipLabel = coords
    ? `${fmt(coords[1], coords[1] >= 0 ? 'N' : 'S')}  ${fmt(coords[0], coords[0] >= 0 ? 'E' : 'W')}`
    : ''

  const scale = 0.55 + 0.45 * opacity

  if (pos.onScreen) {
    return (
      <div className="sun-ind" style={{ left: pos.x, top: pos.y, opacity, transform: `translate(-50%, -50%) scale(${scale})`, transition: 'opacity 0.4s, transform 0.4s' }}
        onClick={handleClick} title="Sub-solar point — click to fly here">
        <SunSVG size={28} />
        {showTip && <div className="sub-point-tip">{tipLabel}</div>}
      </div>
    )
  }

  if (opacity <= 0.25) return null

  return (
    <div className="sun-ind sun-ind--edge" style={{ left: pos.x, top: pos.y, opacity, transform: `translate(-50%, -50%) scale(${scale})`, transition: 'opacity 0.4s, transform 0.4s' }}
      onClick={handleClick} title="Sub-solar point — click to fly here">
      <div className="sun-ind-badge" style={{ transform: `rotate(${pos.angle}rad)` }}>
        <SunSVG size={13} />
        <svg viewBox="0 0 8 14" width="8" height="14" style={{ display: 'block' }}>
          <polyline points="2,2 6,7 2,12" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showTip && <div className="sub-point-tip" style={{ transform: 'none', left: 18, top: -10 }}>{tipLabel}</div>}
    </div>
  )
}
