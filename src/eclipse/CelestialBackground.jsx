import { useEffect, useRef } from 'react'

// Estimate the globe's screen radius by projecting a point 88° east of centre.
// Orthographic approximation: projected distance ≈ R·sin(88°), so R = d/sin(88°).
// At the low zoom levels where the full globe is visible this is accurate enough.
function getGlobeRadius(map) {
  try {
    const center = map.getCenter()
    const cPt = map.project([center.lng, center.lat])
    const ePt = map.project([center.lng + 88, center.lat])
    const d = Math.hypot(ePt.x - cPt.x, ePt.y - cPt.y)
    const r = d / Math.sin(88 * Math.PI / 180)
    return isFinite(r) && r > 0 ? r : null
  } catch {
    return null
  }
}

export default function CelestialBackground({ map, projection }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!map || projection !== 'globe') return

    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      if (map.getZoom() > 3) {
        // Globe fills screen — nothing to show in surrounding space
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      const mapCanvas = map.getCanvas()
      const dpr = window.devicePixelRatio || 1
      const w = mapCanvas.width / dpr
      const h = mapCanvas.height / dpr

      // Resizing the canvas resets its state, so set size first
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'

      const r = getGlobeRadius(map)
      if (!r) return

      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.scale(dpr, dpr)

      // Evenodd fill: rectangle (outer) + circle (inner hole) = donut shape.
      // The globe is always centred in the viewport in globe projection mode.
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 220, 60, 1.0)'
      ctx.fill('evenodd')

      ctx.restore()
    }

    draw()
    map.on('move',   draw)
    map.on('zoom',   draw)
    map.on('rotate', draw)
    map.on('pitch',  draw)
    map.on('resize', draw)

    return () => {
      map.off('move',   draw)
      map.off('zoom',   draw)
      map.off('rotate', draw)
      map.off('pitch',  draw)
      map.off('resize', draw)
    }
  }, [map, projection])

  if (projection !== 'globe') return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
