import { useState, useEffect, useRef, useCallback } from 'react'
import { useSimTime } from '../time/TimeContext'
import { loadIssTle, getIssPosition, getIssVisibilityStatus, DEFAULT_SAT } from './issEngine'

const STATUS_META = {
  visible:      { label: 'Visible',       color: '#22c55e' },
  daylight:     { label: 'Daylight',      color: '#f59e0b' },
  'not-sunlit': { label: 'In shadow',     color: '#94a3b8' },
  'out-of-range':{ label: 'Below horizon',color: '#0ea5e9' },
  sunlit:       { label: 'Sunlit',        color: '#38bdf8' },
  predicted:    { label: 'Predicted',     color: '#a78bfa' },
}

function IssSVG({ size, color = '#0ea5e9', darkColor = '#0369a1' }) {
  const c = size / 2
  const w = size * 0.22
  const h = size * 0.14
  const arm = size * 0.34
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <line x1={c - arm} y1={c} x2={c - w} y2={c} stroke={darkColor} strokeWidth={size * 0.07} strokeLinecap="round" />
      <line x1={c + w} y1={c} x2={c + arm} y2={c} stroke={darkColor} strokeWidth={size * 0.07} strokeLinecap="round" />
      <rect x={c - w} y={c - h} width={w * 2} height={h * 2} rx={size * 0.03} fill={color} stroke={darkColor} strokeWidth={size * 0.05} />
    </svg>
  )
}

function fmt(n, dir) {
  return `${Math.abs(n).toFixed(3)}° ${dir}`
}

function backSideOpacity(map, lng, lat) {
  const center = map.getCenter()
  const phi1 = center.lat * Math.PI / 180
  const phi2 = lat        * Math.PI / 180
  const dLambda = (lng - center.lng) * Math.PI / 180
  const cosD = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  return cosD >= 0 ? 1 : Math.max(0.25, 1 + cosD * 3)
}

function computeScreenPos(map, lng, lat) {
  const canvas = map.getCanvas()
  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr

  let pt
  try { pt = map.project([lng, lat]) } catch { return null }
  if (!pt) return null

  const MARGIN = 80
  const cx = w / 2, cy = h / 2
  const dx = pt.x - cx
  const dy = pt.y - cy
  const angle = Math.atan2(dy, dx)

  const onScreen =
    pt.x >= MARGIN && pt.x <= w - MARGIN &&
    pt.y >= MARGIN && pt.y <= h - MARGIN

  if (onScreen) return { x: pt.x, y: pt.y, angle, onScreen: true }

  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null
  const nx = dx / len, ny = dy / len

  const t = Math.min(
    ...[
      nx >  0.001 ? (w - MARGIN - cx) / nx : Infinity,
      nx < -0.001 ? (MARGIN - cx)     / nx : Infinity,
      ny >  0.001 ? (h - MARGIN - cy) / ny : Infinity,
      ny < -0.001 ? (MARGIN - cy)     / ny : Infinity,
    ].filter(v => v > 0 && isFinite(v))
  )
  if (!isFinite(t)) return null
  return { x: cx + nx * t, y: cy + ny * t, angle, onScreen: false }
}

export default function IssIndicator({ map, onFlyTo, lat, lng, sat = DEFAULT_SAT }) {
  const { simTime } = useSimTime()
  const simTimeRef = useRef(simTime)
  const latRef     = useRef(lat)
  const lngRef     = useRef(lng)
  const [ready, setReady] = useState(false)
  const [pos, setPos] = useState(null)
  const [coords, setCoords] = useState(null)
  const [altKm, setAltKm] = useState(null)
  const [status, setStatus] = useState(null)
  const [opacity, setOpacity] = useState(1)
  const [showTip, setShowTip] = useState(false)
  const tipTimer = useRef(null)

  // Keep refs current every render so event listeners always read latest values
  simTimeRef.current = simTime
  latRef.current     = lat
  lngRef.current     = lng

  useEffect(() => {
    let cancelled = false
    loadIssTle({ sat }).then(() => {
      if (!cancelled) setReady(true)
    }).catch(() => {
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true }
  }, [sat])

  // Stable update fn — reads all time/location values via refs so it never needs to be recreated
  const update = useCallback(() => {
    if (!map) return
    const satPos = getIssPosition(simTimeRef.current, sat)
    if (!satPos) { setPos(null); setStatus(null); return }

    const { lng: satLng, lat: satLat, altKm: alt } = satPos
    setCoords([satLng, satLat])
    setAltKm(alt)
    setPos(computeScreenPos(map, satLng, satLat))
    setOpacity(backSideOpacity(map, satLng, satLat))
    const vis = getIssVisibilityStatus(simTimeRef.current, latRef.current, lngRef.current, 10, sat)
    setStatus(vis.status)
  }, [map, sat]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register map listeners once when map/ready changes
  useEffect(() => {
    if (!map || !ready) return
    update()
    map.on('move', update)
    map.on('resize', update)
    return () => {
      map.off('move', update)
      map.off('resize', update)
    }
  }, [map, ready, update])

  // Drive ISS position forward with simTime without re-registering listeners
  useEffect(() => {
    if (ready) update()
  }, [simTime, ready, update])

  function handleClick() {
    if (!coords) return
    onFlyTo?.(coords)
    clearTimeout(tipTimer.current)
    setShowTip(true)
    tipTimer.current = setTimeout(() => setShowTip(false), 3000)
  }

  if (!ready || !pos) return null

  const tipLabel = coords
    ? `${fmt(coords[1], coords[1] >= 0 ? 'N' : 'S')}  ${fmt(coords[0], coords[0] >= 0 ? 'E' : 'W')}${altKm != null ? `  ·  ${Math.round(altKm)} km` : ''}`
    : ''

  const statusMeta = status ? STATUS_META[status] : null

  const scale = 0.55 + 0.45 * opacity

  if (pos.onScreen) {
    return (
      <div className={`iss-ind${showTip ? ' tip-open' : ''}`} style={{ left: pos.x, top: pos.y, opacity, transform: `translate(-50%, -50%) scale(${scale})`, transition: 'opacity 0.4s, transform 0.4s' }}
        onClick={handleClick} title={`${sat.name} — click to fly here`}>
        <IssSVG size={28} color={sat.color} darkColor={sat.darkColor} />
        {statusMeta && (
          <div className="iss-status-label" style={{ color: statusMeta.color }}>
            <span className="iss-status-dot" style={{ background: statusMeta.color }} />
            {statusMeta.label}
          </div>
        )}
        {showTip && <div className="sub-point-tip sub-point-tip--iss">{tipLabel}</div>}
      </div>
    )
  }

  if (opacity <= 0.25) return null

  return (
    <div className="iss-ind iss-ind--edge" style={{ left: pos.x, top: pos.y, opacity, transform: `translate(-50%, -50%) scale(${scale})`, transition: 'opacity 0.4s, transform 0.4s' }}
      onClick={handleClick} title={`${sat.name} — click to fly here`}>
      <div className="iss-ind-badge" style={{ transform: `rotate(${pos.angle}rad)` }}>
        <IssSVG size={13} color={sat.color} darkColor={sat.darkColor} />
        <svg viewBox="0 0 8 14" width="8" height="14" style={{ display: 'block' }}>
          <polyline points="2,2 6,7 2,12" fill="none" stroke={sat.darkColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showTip && <div className="sub-point-tip sub-point-tip--iss" style={{ transform: 'none', left: 18, top: -10 }}>{tipLabel}</div>}
    </div>
  )
}
