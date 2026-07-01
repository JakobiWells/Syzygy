import { useEffect, useRef } from 'react'
import { useSimTime } from '../time/TimeContext'

// 5×5 global grid — one Open-Meteo call per point (25 total)
const LNGS = [-144, -72, 0, 72, 144]
const LATS = [-60, -30, 0, 30, 60]

const N          = 2500    // particle count
const SPD_SCALE  = 0.005   // degrees/frame per m/s
const TAIL       = 5       // trail length multiplier (screen pixels per m/s)
const MAX_AGE    = 120     // frames before respawn
const FETCH_DEBOUNCE = 600 // ms

function uvFromDirSpd(dir, spd) {
  const r = (dir * Math.PI) / 180
  return [-spd * Math.sin(r), -spd * Math.cos(r)]
}

function windAt(grid, lng, lat) {
  if (!grid) return [0, 0]
  lng = ((lng % 360) + 360) % 360 - 180

  const lngSpan = LNGS[LNGS.length - 1] - LNGS[0]
  const latSpan = LATS[LATS.length - 1] - LATS[0]
  let lngT = (lng - LNGS[0]) / lngSpan * (LNGS.length - 1)
  let latT = (lat - LATS[0]) / latSpan * (LATS.length - 1)
  lngT = Math.max(0, Math.min(LNGS.length - 1.001, lngT))
  latT = Math.max(0, Math.min(LATS.length - 1.001, latT))

  const li0 = Math.floor(lngT), li1 = li0 + 1
  const la0 = Math.floor(latT), la1 = la0 + 1
  const lt = lngT - li0, ll = latT - la0

  const g = (la, li) => grid[la]?.[li] ?? [0, 0]
  const lerp = ([u0, v0], [u1, v1], t) => [u0 + (u1 - u0) * t, v0 + (v1 - v0) * t]

  return lerp(lerp(g(la0, li0), g(la0, li1), lt), lerp(g(la1, li0), g(la1, li1), lt), ll)
}

async function fetchGrid(ms) {
  const d      = new Date(ms)
  const date   = d.toISOString().slice(0, 10)
  const hour   = d.getUTCHours()
  const isPast = ms < Date.now() - 3 * 86400_000

  const grid = LATS.map(() => new Array(LNGS.length).fill([0, 0]))

  await Promise.all(
    LATS.flatMap((lat, lti) =>
      LNGS.map(async (lng, li) => {
        try {
          const base = isPast
            ? 'https://archive-api.open-meteo.com/v1/archive'
            : 'https://api.open-meteo.com/v1/forecast'
          const end = isPast ? date : new Date(ms + 86400_000).toISOString().slice(0, 10)
          const url = `${base}?latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${end}&hourly=wind_speed_10m,wind_direction_10m&timezone=UTC`
          const data = await fetch(url).then(r => r.json())
          const h    = Math.min(hour, (data.hourly?.wind_speed_10m?.length ?? 1) - 1)
          const spd  = data.hourly.wind_speed_10m?.[h]  ?? 0
          const dir  = data.hourly.wind_direction_10m?.[h] ?? 0
          grid[lti][li] = uvFromDirSpd(dir, spd)
        } catch {}
      })
    )
  )
  return grid
}

function mkParticle() {
  return { lng: Math.random() * 360 - 180, lat: Math.random() * 140 - 70, age: (Math.random() * MAX_AGE) | 0 }
}

export default function WindParticles({ map, mapLoaded, visible }) {
  const { simTime } = useSimTime()
  const canvasRef  = useRef(null)
  const gridRef    = useRef(null)
  const gridKeyRef = useRef(null)
  const rafRef     = useRef(null)
  const ptcls      = useRef(Array.from({ length: N }, mkParticle))
  const timerRef   = useRef(null)

  // Debounced wind grid fetch when 3-hour window changes
  useEffect(() => {
    if (!visible) return
    const key = Math.floor(simTime.getTime() / (3 * 3_600_000))
    if (key === gridKeyRef.current) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      gridKeyRef.current = key
      gridRef.current    = null
      fetchGrid(simTime.getTime()).then(g => { gridRef.current = g })
    }, FETCH_DEBOUNCE)
  }, [simTime, visible])

  // Canvas animation loop
  useEffect(() => {
    if (!mapLoaded || !map || !visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      const c      = map.getContainer()
      canvas.width  = c.clientWidth
      canvas.height = c.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(map.getContainer())
    map.on('resize', resize)

    let running = true

    function frame() {
      if (!running) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const grid = gridRef.current
      const W = canvas.width, H = canvas.height
      ctx.lineWidth = 1.3

      for (const p of ptcls.current) {
        const [u, v] = windAt(grid, p.lng, p.lat)
        const spd    = Math.sqrt(u * u + v * v)

        const dLng = u * SPD_SCALE
        const dLat = v * SPD_SCALE

        // Tail end is behind the particle
        const tail = map.project([p.lng - dLng * TAIL, Math.max(-85, Math.min(85, p.lat - dLat * TAIL))])
        const head = map.project([p.lng + dLng,        Math.max(-85, Math.min(85, p.lat + dLat))])

        if (tail && head) {
          const tx = tail.x, ty = tail.y, hx = head.x, hy = head.y
          // Skip particles projecting wildly off screen (globe backside)
          if (Math.abs(tx) < W * 2 && Math.abs(ty) < H * 2) {
            const alpha = Math.min(0.9, 0.25 + spd / 20)
            const hue   = 220 - spd * 5          // calm = blue, fast = warm
            const light = 55 + Math.min(spd, 20) // faster = brighter
            ctx.strokeStyle = `hsla(${hue}, 75%, ${light}%, ${alpha})`
            ctx.beginPath()
            ctx.moveTo(tx, ty)
            ctx.lineTo(hx, hy)
            ctx.stroke()
          }
        }

        // Advance
        p.lng += dLng
        p.lat  = Math.max(-85, Math.min(85, p.lat + dLat))
        p.age++

        if (p.age > MAX_AGE || !grid || Math.abs(p.lat) >= 84) {
          const np = mkParticle(); p.lng = np.lng; p.lat = np.lat; p.age = np.age
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    frame()

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      map.off('resize', resize)
    }
  }, [map, mapLoaded, visible])

  if (!visible) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    />
  )
}
