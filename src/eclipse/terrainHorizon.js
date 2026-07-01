/**
 * Real-time terrain horizon profile for a given lat/lng.
 * Uses AWS Terrarium elevation tiles (public, CORS-enabled) and the same
 * ray-march algorithm as scripts/computeHorizon.mjs, but runs in the browser.
 *
 * Returns a Float32Array[360] of terrain horizon altitude in degrees (above the
 * flat geometric horizon) for every integer azimuth 0–359.
 */

import { useState, useEffect, useRef } from 'react'

const ZOOM      = 9           // ~300 m/px at equator; 3×3 tiles ≈ covers 80 km
const MAX_KM    = 40          // ray-march radius
const STEP_M    = 300         // step size (one terrain texel at z=9 equator)
const N_AZ      = 360         // one sample per degree

const tileCache = new Map()   // "z/x/y" → Float32Array (elevations, 256×256)

// ── Tile helpers ─────────────────────────────────────────────────────────────

function lngToTileX(lng, z) {
  return Math.floor((lng + 180) / 360 * (1 << z))
}
function latToTileY(lat, z) {
  const r = lat * Math.PI / 180
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z))
}
function latToMercY(lat) {
  const sin = Math.sin(lat * Math.PI / 180)
  return (1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2
}

function fetchTile(x, y, z) {
  const key = `${z}/${x}/${y}`
  if (tileCache.has(key)) return Promise.resolve(tileCache.get(key))

  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      let data
      try { data = ctx.getImageData(0, 0, 256, 256).data }
      catch { resolve(null); return }          // CORS blocked — skip
      const elev = new Float32Array(256 * 256)
      for (let i = 0; i < 256 * 256; i++) {
        elev[i] = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768
      }
      tileCache.set(key, elev)
      resolve(elev)
    }
    img.onerror = () => {
      tileCache.set(key, null)   // ocean / missing tile → treat as sea level
      resolve(null)
    }
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  })
}

// ── Elevation grid ────────────────────────────────────────────────────────────

async function buildGrid(lat, lng) {
  const nz = 1 << ZOOM
  const marginDeg = (MAX_KM * 1000 / 111320) * 1.4

  const tx0 = Math.max(0,      lngToTileX(lng - marginDeg * 1.5, ZOOM))
  const tx1 = Math.min(nz - 1, lngToTileX(lng + marginDeg * 1.5, ZOOM))
  const ty0 = Math.max(0,      latToTileY(lat + marginDeg,        ZOOM))
  const ty1 = Math.min(nz - 1, latToTileY(lat - marginDeg,        ZOOM))

  const cols = tx1 - tx0 + 1
  const rows = ty1 - ty0 + 1
  const TILE = 256
  const gridW = cols * TILE
  const gridH = rows * TILE
  const elev  = new Float32Array(gridW * gridH)  // default 0 = sea level

  await Promise.all(
    Array.from({ length: rows * cols }, (_, idx) => {
      const r = Math.floor(idx / cols)
      const c = idx % cols
      return fetchTile(tx0 + c, ty0 + r, ZOOM).then(px => {
        if (!px) return
        for (let py = 0; py < TILE; py++) {
          for (let px_ = 0; px_ < TILE; px_++) {
            const di = (r * TILE + py) * gridW + (c * TILE + px_)
            elev[di] = px[py * TILE + px_]
          }
        }
      })
    })
  )

  return { elev, gridW, gridH, originPixX: tx0 * TILE, originPixY: ty0 * TILE, nz }
}

function sampleElev(grid, pixX, pixY) {
  const { elev, gridW, gridH, originPixX, originPixY } = grid
  const gx = pixX - originPixX, gy = pixY - originPixY
  if (gx < 0 || gy < 0 || gx > gridW - 2 || gy > gridH - 2) return 0
  const ix = gx | 0, iy = gy | 0
  const fx = gx - ix, fy = gy - iy
  const i00 = iy * gridW + ix
  return elev[i00]          * (1 - fx) * (1 - fy) +
         elev[i00 + 1]      * fx       * (1 - fy) +
         elev[i00 + gridW]  * (1 - fx) * fy       +
         elev[i00 + gridW + 1] * fx    * fy
}

// ── Horizon computation ───────────────────────────────────────────────────────

async function computeProfile(lat, lng) {
  const t0 = performance.now()
  const grid = await buildGrid(lat, lng)
  console.debug(`[terrain] tile fetch ${(performance.now() - t0).toFixed(0)} ms  (${lat.toFixed(3)}, ${lng.toFixed(3)})`)

  const t1 = performance.now()
  const { nz } = grid
  const cosLat  = Math.cos(lat * Math.PI / 180)
  const secLat  = 1 / cosLat
  const scale   = nz * 256

  const obsPixX = (lng + 180) / 360 * scale
  const obsPixY = latToMercY(lat) * scale
  const e0      = sampleElev(grid, obsPixX, obsPixY)

  const nSteps = Math.ceil((MAX_KM * 1000) / STEP_M)
  const profile = new Float32Array(N_AZ)

  // Process in 8 chunks of 45° with a yield between each to keep the UI responsive.
  const CHUNK = 45
  for (let azStart = 0; azStart < N_AZ; azStart += CHUNK) {
    await new Promise(r => setTimeout(r, 0))
    const azEnd = Math.min(azStart + CHUNK, N_AZ)
    for (let az = azStart; az < azEnd; az++) {
      const azRad = az * Math.PI / 180
      const dx = (STEP_M * Math.sin(azRad)) / (111320 * cosLat) / 360 * scale
      const dy = -(STEP_M * Math.cos(azRad)) / 111320 * (secLat / 360) * scale

      let maxSlope = 0
      for (let s = 1; s <= nSteps; s++) {
        const e = sampleElev(grid, obsPixX + s * dx, obsPixY + s * dy)
        const slope = (e - e0) / s
        if (slope > maxSlope) maxSlope = slope
      }
      profile[az] = Math.max(0, Math.atan(maxSlope / STEP_M) * 180 / Math.PI)
    }
  }

  console.debug(`[terrain] ray-march ${(performance.now() - t1).toFixed(0)} ms`)
  return profile
}

// ── Profile cache (rounded to ~1 km) ─────────────────────────────────────────

const profileCache = new Map()
const inFlight     = new Set()   // module-level: shared across all hook instances

function cacheKey(lat, lng) {
  return `${(lat * 100) | 0},${(lng * 100) | 0}`
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useTerrainHorizon(lat, lng) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (lat == null || lng == null) return
    const key = cacheKey(lat, lng)
    if (profileCache.has(key)) { setProfile(profileCache.get(key)); return }
    if (inFlight.has(key)) return

    inFlight.add(key)
    computeProfile(lat, lng)
      .then(p => { profileCache.set(key, p); setProfile(p) })
      .catch(() => {})
      .finally(() => inFlight.delete(key))
  }, [lat == null ? null : (lat * 100 | 0), lng == null ? null : (lng * 100 | 0)]) // eslint-disable-line react-hooks/exhaustive-deps

  return profile
}

// ── SVG path builder (used by SkyView) ───────────────────────────────────────

function gaussianSmooth(profile, sigma) {
  const N = profile.length
  const radius = Math.ceil(sigma * 3)
  const kernel = []
  let ksum = 0
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel.push(w)
    ksum += w
  }
  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    let val = 0
    for (let j = 0; j < kernel.length; j++) {
      val += profile[(i + j - radius + N) % N] * kernel[j]
    }
    out[i] = val / ksum
  }
  return out
}

/**
 * Build an SVG path for the terrain silhouette.
 * The path traces the terrain top edge (above flat horizon) then closes at the
 * bottom of the frame, ready to be filled with a ground/rock colour.
 */
export function buildTerrainPath(profile, centerAz, W, H, horizonY, scale) {
  if (!profile) return null

  const smooth = gaussianSmooth(profile, 2.5)

  const halfFov = Math.min(90, W / (2 * scale) + 3)   // cap at 90° half-FOV (180° total) to prevent wrap-around
  const N = Math.max(120, Math.ceil(W))  // one point per ~1px

  // Build xy point list
  const pts = []
  for (let i = 0; i <= N; i++) {
    const dAz = (i / N * 2 - 1) * halfFov
    const x   = W / 2 + dAz * scale
    const az  = ((centerAz + dAz) % 360 + 360) % 360
    const idx = Math.round(az) % 360
    // bilinear between adjacent smoothed samples for sub-degree az
    const az0 = Math.floor(az) % 360
    const az1 = (az0 + 1) % 360
    const t   = az - Math.floor(az)
    const alt = smooth[az0] * (1 - t) + smooth[az1] * t
    const y   = Math.min(H, horizonY - Math.max(0, alt) * scale)
    pts.push([x, y])
  }

  // Catmull-Rom → cubic bezier
  function cr2bez(p0, p1, p2, p3) {
    return [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    ]
  }

  let d = `M 0,${H} L ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const [cx1, cy1, cx2, cy2, ex, ey] = cr2bez(p0, p1, p2, p3)
    d += ` C ${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`
  }
  d += ` L ${W},${H} Z`
  return d
}
