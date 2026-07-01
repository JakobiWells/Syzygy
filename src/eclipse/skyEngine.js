import SunCalc from 'suncalc'

// SunCalc azimuth: 0=south, positive=west → convert to compass (0=north, CW)
export function toCompassAz(azRad) {
  return ((azRad * 180 / Math.PI) + 180 + 360) % 360
}

export function getSunPos(time, lat, lng) {
  const p = SunCalc.getPosition(time, lat, lng)
  return { alt: p.altitude * 180 / Math.PI, az: toCompassAz(p.azimuth) }
}

export function getMoonPos(time, lat, lng) {
  const p = SunCalc.getMoonPosition(time, lat, lng)
  return { alt: p.altitude * 180 / Math.PI, az: toCompassAz(p.azimuth) }
}

// Sample body position every stepMin over the UTC day containing `time`
export function buildDayArc(time, lat, lng, body, stepMin = 10) {
  const dayStart = new Date(time)
  dayStart.setUTCHours(0, 0, 0, 0)
  const fn = body === 'sun' ? SunCalc.getPosition : SunCalc.getMoonPosition
  const count = Math.floor(1440 / stepMin) + 1
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(dayStart.getTime() + i * stepMin * 60000)
    const p = fn(t, lat, lng)
    return { alt: p.altitude * 180 / Math.PI, az: toCompassAz(p.azimuth), t }
  })
}

// Sky gradient stop colors based on sun altitude (degrees)
export function skyColors(sunAlt) {
  if (sunAlt > 20)  return { top: '#0e4d8c', bot: '#5aa8d4' }
  if (sunAlt > 10)  return { top: '#103a6e', bot: '#7cc0e0' }
  if (sunAlt > 4)   return { top: '#1a3050', bot: '#d4854a' }
  if (sunAlt > 0)   return { top: '#0e2040', bot: '#c05020' }
  if (sunAlt > -6)  return { top: '#080f1c', bot: '#601808' }
  if (sunAlt > -12) return { top: '#040810', bot: '#101828' }
  return { top: '#010305', bot: '#050c14' }
}

// Convert alt/az to SVG screen coordinates
// centerAz: azimuth mapped to x = W/2
// alt = 0 → y = H (horizon at bottom)
// Azimuth increases clockwise (N→E→S→W). Higher az = more westward = more rightward
// when facing south, matching the sky-observation convention (east left, west right).
export function toXY(alt, az, centerAz, W, H, scale) {
  let dAz = ((az - centerAz + 540) % 360) - 180
  return { x: W / 2 + dAz * scale, y: H - alt * scale }
}

// Given a ray from (cx,cy) toward (tx,ty), find where it hits the viewport boundary
// Returns the edge point and rotation angle for an arrow pointing toward the target
export function edgeArrow(cx, cy, tx, ty, W, H, margin = 14) {
  const dx = tx - cx, dy = ty - cy
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.01) return null
  const nx = dx / len, ny = dy / len
  let t = Infinity
  if (nx > 0)  t = Math.min(t, (W - margin - cx) / nx)
  else if (nx < 0) t = Math.min(t, (margin - cx) / nx)
  if (ny > 0)  t = Math.min(t, (H - margin - cy) / ny)
  else if (ny < 0) t = Math.min(t, (margin - cy) / ny)
  return {
    x: cx + nx * t,
    y: cy + ny * t,
    angle: Math.atan2(dy, dx) * 180 / Math.PI + 90,
  }
}

// Split arc into continuous above-horizon segments, converted to screen coords
// Splits also when consecutive points jump (azimuth wraps across viewport)
export function arcSegments(arcPts, centerAz, W, H, scale, minAlt = -1) {
  const segs = []
  let seg = []
  let prevX = null
  for (const pt of arcPts) {
    if (pt.alt < minAlt) {
      if (seg.length > 1) segs.push(seg)
      seg = []; prevX = null
      continue
    }
    const { x, y } = toXY(pt.alt, pt.az, centerAz, W, H, scale)
    if (prevX !== null && Math.abs(x - prevX) > W * 0.65) {
      if (seg.length > 1) segs.push(seg)
      seg = []
    }
    seg.push({ x, y, t: pt.t, alt: pt.alt, az: pt.az })
    prevX = x
  }
  if (seg.length > 1) segs.push(seg)
  return segs
}

export function segToPath(seg) {
  return seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

// Pull one representative point per UTC hour that's above the horizon
export function hourlyMarkers(arcPts) {
  const seen = new Set()
  return arcPts.filter(pt => {
    if (pt.alt <= 0) return false
    const h = pt.t.getUTCHours()
    const m = pt.t.getUTCMinutes()
    if (m < 10 && !seen.has(h)) { seen.add(h); return true }
    return false
  })
}
