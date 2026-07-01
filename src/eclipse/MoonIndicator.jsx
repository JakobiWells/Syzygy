import { useState, useEffect, useRef } from 'react'
import { useSimTime } from '../time/TimeContext'
import { getSubLunarPoint } from './daynight'

function MoonSVG({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill="#1e2a3a"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
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
  return cosD >= 0 ? 1 : Math.max(0.25, 1 + cosD * 3)
}

export default function MoonIndicator({ map, onFlyTo }) {
  const { simTime } = useSimTime()
  const [pos, setPos]         = useState(null)
  const [coords, setCoords]   = useState(null)
  const [opacity, setOpacity] = useState(1)
  const [showTip, setShowTip] = useState(false)
  const tipTimer              = useRef(null)

  useEffect(() => {
    if (!map) return

    function update() {
      const [moonLng, moonLat] = getSubLunarPoint(simTime)
      setCoords([moonLng, moonLat])
      setOpacity(backSideOpacity(map, moonLng, moonLat))
      const canvas = map.getCanvas()
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width  / dpr
      const h = canvas.height / dpr

      let pt
      try { pt = map.project([moonLng, moonLat]) } catch { return }

      const MARGIN = 80
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
      <div className="moon-ind" style={{ left: pos.x, top: pos.y, opacity, transform: `translate(-50%, -50%) scale(${scale})`, transition: 'opacity 0.4s, transform 0.4s' }}
        onClick={handleClick} title="Sub-lunar point — click to fly here">
        <MoonSVG size={28} />
        {showTip && <div className="sub-point-tip sub-point-tip--moon">{tipLabel}</div>}
      </div>
    )
  }

  if (opacity <= 0.25) return null

  return (
    <div className="moon-ind moon-ind--edge" style={{ left: pos.x, top: pos.y, opacity, transform: `translate(-50%, -50%) scale(${scale})`, transition: 'opacity 0.4s, transform 0.4s' }}
      onClick={handleClick} title="Sub-lunar point — click to fly here">
      <div className="moon-ind-badge" style={{ transform: `rotate(${pos.angle}rad)` }}>
        <MoonSVG size={13} />
        <svg viewBox="0 0 8 14" width="8" height="14" style={{ display: 'block' }}>
          <polyline points="2,2 6,7 2,12" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showTip && <div className="sub-point-tip sub-point-tip--moon" style={{ transform: 'none', left: 18, top: -10 }}>{tipLabel}</div>}
    </div>
  )
}
