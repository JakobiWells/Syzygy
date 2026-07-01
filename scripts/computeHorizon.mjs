#!/usr/bin/env node
/**
 * computeHorizon.mjs
 *
 * Pre-computes per-pixel terrain horizon angles from AWS Terrarium elevation tiles.
 * Horizon angles are the key primitive for terrain shadow: a pixel is in shadow when
 * the sun's altitude is less than the stored horizon angle toward the sun's azimuth.
 *
 * OUTPUT FORMAT (one gzip-compressed binary file per tile):
 *   - Path:  horizon-tiles/{z}/{x}/{y}.bin.gz
 *   - Data:  256 × 256 pixels × 64 azimuths × 1 byte (uint8)
 *   - Index: (row * 256 + col) * N_AZ + az_idx
 *   - Value: horizon_angle_degrees × (255/90), clamped to [0, 90°]
 *   - az_idx 0 = north (0°), increases clockwise, az_idx 1 = 5.625°, etc.
 *
 * AFTER RUNNING:
 *   aws s3 sync ./horizon-tiles s3://YOUR_BUCKET/horizon \
 *     --content-type application/octet-stream \
 *     --content-encoding gzip \
 *     --cache-control "public, max-age=31536000, immutable"
 *
 * USAGE:
 *   node scripts/computeHorizon.mjs [--workers=N] [--zoom=Z] [--resume]
 *
 * Estimated time: ~2–6 hours for z=6 global on an 8-core machine.
 * Terrain tiles are cached to .terrain-cache/ so reruns are fast.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { existsSync }                                    from 'fs'
import { readFile, writeFile, mkdir }                    from 'fs/promises'
import { cpus }                                          from 'os'
import path                                              from 'path'
import { fileURLToPath }                                 from 'url'
import { gzip }                                          from 'zlib'
import { promisify }                                     from 'util'
import { PNG }                                           from 'pngjs'

const gzipAsync = promisify(gzip)

// ─── Configuration ─────────────────────────────────────────────────────────
// These can be overridden from workerData in worker threads.

const CONFIG = {
  outputZoom:  6,         // horizon tile zoom  → 64×64 = 4096 tiles globally
  terrainZoom: 8,         // Terrarium sample zoom → ~150 m/px at equator (effective ceiling for z=8)
  nAzimuths:  64,         // directions: 360° / 64 = 5.625° per step
  maxDistM:   100_000,    // max ray-march distance (100 km covers any realistic terrain shadow)
  stepM:       300,       // one ray step ≈ one terrain texel at z=8 equator
  outDir:     'horizon-tiles',
  cacheDir:   '.terrain-cache',
}

// ─── Tile / coordinate helpers ──────────────────────────────────────────────

const pow2 = (z) => 1 << z

function lngToTileX(lng, z) {
  return Math.floor((lng + 180) / 360 * pow2(z))
}
function latToTileY(lat, z) {
  const r = lat * Math.PI / 180
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * pow2(z))
}
function tileXToLng(x, z) { return x / pow2(z) * 360 - 180 }
function tileYToLat(y, z) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / pow2(z)))) * 180 / Math.PI
}

// Mercator Y in [0,1] for latitude
function latToMercY(lat) {
  const sin = Math.sin(lat * Math.PI / 180)
  return (1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2
}

// Terrarium RGBA → elevation metres
function terrariumElev(r, g, b) {
  return r * 256 + g + b / 256 - 32768
}

// ─── Terrain tile fetch + disk cache ───────────────────────────────────────

async function fetchTerrainTile(x, y, z, cfg) {
  const cacheFile = path.join(cfg.cacheDir, String(z), `${x}_${y}.raw`)
  if (existsSync(cacheFile)) {
    return new Uint8Array((await readFile(cacheFile)).buffer)
  }

  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  let rgba
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const png = PNG.sync.read(buf)
    rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength)
  } catch {
    // Missing tile (ocean or edge) → fill with sea level (R=128 → 0 m)
    rgba = new Uint8Array(256 * 256 * 4)
    for (let i = 0; i < 256 * 256; i++) { rgba[i * 4] = 128; rgba[i * 4 + 3] = 255 }
  }

  await mkdir(path.dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, rgba)
  return rgba
}

// ─── Elevation grid for one output tile ────────────────────────────────────
// Downloads terrain tiles covering the output tile + ray-march margin.

async function buildElevGrid(latN, latS, lngW, lngE, cfg) {
  const tz = cfg.terrainZoom
  const nz = pow2(tz)

  // Margin in degrees: enough to march maxDistM in any direction
  const marginDeg = (cfg.maxDistM / 111320) * 1.3

  const tx0 = Math.max(0,      lngToTileX(lngW - marginDeg * 1.5, tz))
  const tx1 = Math.min(nz - 1, lngToTileX(lngE + marginDeg * 1.5, tz))
  const ty0 = Math.max(0,      latToTileY(latN + marginDeg,        tz))
  const ty1 = Math.min(nz - 1, latToTileY(latS - marginDeg,        tz))

  const cols = tx1 - tx0 + 1
  const rows = ty1 - ty0 + 1
  const TILE = 256
  const gridW = cols * TILE
  const gridH = rows * TILE
  const elev  = new Float32Array(gridW * gridH)

  // Fetch all needed terrain tiles in parallel
  await Promise.all(
    Array.from({ length: rows * cols }, (_, idx) => {
      const r = Math.floor(idx / cols)
      const c = idx % cols
      return fetchTerrainTile(tx0 + c, ty0 + r, tz, cfg).then(px => {
        for (let py = 0; py < TILE; py++) {
          for (let px_ = 0; px_ < TILE; px_++) {
            const si = (py * TILE + px_) * 4
            const di = (r * TILE + py) * gridW + (c * TILE + px_)
            elev[di] = terrariumElev(px[si], px[si + 1], px[si + 2])
          }
        }
      })
    })
  )

  // Origin: terrain pixel coordinate of the top-left corner of the downloaded grid
  return {
    elev,
    gridW, gridH,
    originPixX: tx0 * TILE,
    originPixY: ty0 * TILE,
    nz, tz,
  }
}

// Bilinear elevation sample at Terrarium pixel coords (absolute, not relative to grid)
function sampleElev(grid, pixX, pixY) {
  const { elev, gridW, gridH, originPixX, originPixY } = grid
  const gx = pixX - originPixX
  const gy = pixY - originPixY
  if (gx < 0 || gy < 0 || gx > gridW - 2 || gy > gridH - 2) return 0

  const ix = gx | 0, iy = gy | 0
  const fx = gx - ix, fy = gy - iy
  const i00 = iy * gridW + ix
  return elev[i00]          * (1 - fx) * (1 - fy) +
         elev[i00 + 1]      * fx       * (1 - fy) +
         elev[i00 + gridW]  * (1 - fx) * fy       +
         elev[i00 + gridW + 1] * fx    * fy
}

// ─── Horizon angles for one output pixel ───────────────────────────────────

function computeHorizonAngles(grid, lat, lng, cfg) {
  const { nz } = grid
  const latRad  = lat * Math.PI / 180
  const cosLat  = Math.cos(latRad)
  const secLat  = 1 / cosLat  // sec(lat) for exact Mercator Y derivative

  // Observer absolute Terrarium pixel position at terrainZoom
  const obsPixX = (lng + 180) / 360 * nz * 256
  const obsPixY = latToMercY(lat) * nz * 256
  const e0      = sampleElev(grid, obsPixX, obsPixY)

  // Per-step pixel displacements for each azimuth (exact Mercator formulas)
  const dxPerAz = new Float64Array(cfg.nAzimuths)
  const dyPerAz = new Float64Array(cfg.nAzimuths)
  const scale   = nz * 256   // terrain pixels per full Mercator unit

  for (let ai = 0; ai < cfg.nAzimuths; ai++) {
    const az    = ai * (2 * Math.PI / cfg.nAzimuths)
    // dLng/dStep: stepM × sin(az) / (111320 × cos(lat))  (degrees per step → Mercator X)
    dxPerAz[ai] = (cfg.stepM * Math.sin(az)) / (111320 * cosLat) / 360 * scale
    // dLat/dStep: stepM × cos(az) / 111320  (degrees per step → Mercator Y, exact)
    // dMercY/dLat = -secLat / 360  (exact derivative)
    dyPerAz[ai] = -(cfg.stepM * Math.cos(az)) / 111320 * (secLat / 360) * scale
  }

  const nSteps  = Math.ceil(cfg.maxDistM / cfg.stepM)
  const angles  = new Uint8Array(cfg.nAzimuths)

  for (let ai = 0; ai < cfg.nAzimuths; ai++) {
    const dx = dxPerAz[ai]
    const dy = dyPerAz[ai]
    let maxSlopeTanTimesStep = 0  // tracks max of (elev - e0) / (step) to avoid atan per iteration

    for (let step = 1; step <= nSteps; step++) {
      const e = sampleElev(grid, obsPixX + step * dx, obsPixY + step * dy)
      // Slope = (e - e0) / (step × stepM); we compare (e - e0) / step to avoid dividing by stepM each time
      const slope = (e - e0) / step
      if (slope > maxSlopeTanTimesStep) maxSlopeTanTimesStep = slope
    }

    // maxSlopeTanTimesStep is tan(horizAngle) × stepM; horizon angle in degrees:
    const horizAngleDeg = Math.atan(maxSlopeTanTimesStep / cfg.stepM) * 180 / Math.PI
    angles[ai] = Math.round(Math.max(0, Math.min(90, horizAngleDeg)) * (255 / 90))
  }

  return angles
}

// ─── Process one output tile ────────────────────────────────────────────────

async function processOutputTile(ox, oy, cfg) {
  const oz      = cfg.outputZoom
  const outFile = path.join(cfg.outDir, String(oz), String(ox), `${oy}.bin.gz`)

  if (existsSync(outFile)) return { ox, oy, skipped: true }

  const latN = tileYToLat(oy,     oz)
  const latS = tileYToLat(oy + 1, oz)
  const lngW = tileXToLng(ox,     oz)
  const lngE = tileXToLng(ox + 1, oz)

  // Clamp to ±85° (Terrarium Mercator limit)
  if (latS > 85 || latN < -85) return { ox, oy, skipped: true }

  const grid = await buildElevGrid(
    Math.min(latN, 85), Math.max(latS, -85), lngW, lngE, cfg
  )

  const TILE = 256
  const out  = new Uint8Array(TILE * TILE * cfg.nAzimuths)

  for (let row = 0; row < TILE; row++) {
    for (let col = 0; col < TILE; col++) {
      // Pixel centre in geographic coordinates
      const lat = latN - (latN - latS) * (row + 0.5) / TILE
      const lng = lngW + (lngE - lngW) * (col + 0.5) / TILE
      const horizAngles = computeHorizonAngles(grid, lat, lng, cfg)
      out.set(horizAngles, (row * TILE + col) * cfg.nAzimuths)
    }
  }

  const compressed = await gzipAsync(out, { level: 9 })
  await mkdir(path.dirname(outFile), { recursive: true })
  await writeFile(outFile, compressed)

  return { ox, oy, skipped: false }
}

// ─── Main thread ────────────────────────────────────────────────────────────

if (isMainThread) {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true] })
  )

  if (args.workers) CONFIG.terrainZoom = Number(args.zoom ?? CONFIG.outputZoom)
  const nWorkers = Number(args.workers ?? Math.max(1, cpus().length - 1))

  const oz       = CONFIG.outputZoom
  const nTiles   = pow2(oz)            // tiles per axis: 64 for z=6
  const total    = nTiles * nTiles     // 4096 tiles

  console.log(`
=== Horizon pre-computation ===
  Output zoom:   ${oz}  (${total} tiles, ${(360 / nTiles).toFixed(2)}°/tile)
  Terrain zoom:  ${CONFIG.terrainZoom}  (~${Math.round(156543 / pow2(CONFIG.terrainZoom))} m/px at equator)
  Azimuths:      ${CONFIG.nAzimuths}  (${(360 / CONFIG.nAzimuths).toFixed(2)}° apart)
  Max distance:  ${CONFIG.maxDistM / 1000} km  →  ${Math.ceil(CONFIG.maxDistM / CONFIG.stepM)} steps of ${CONFIG.stepM} m
  Workers:       ${nWorkers}
  Output dir:    ${CONFIG.outDir}/
  Terrain cache: ${CONFIG.cacheDir}/
`)

  const queue     = []
  for (let y = 0; y < nTiles; y++)
    for (let x = 0; x < nTiles; x++)
      queue.push([x, y])

  let done = 0, skipped = 0, errors = 0
  const startMs = Date.now()

  function fmtEta(s) {
    if (s > 3600) return `${(s/3600).toFixed(1)}h`
    if (s > 60)   return `${Math.round(s/60)}m`
    return `${Math.round(s)}s`
  }

  const workers = []
  let activeWorkers = 0

  function dispatch(worker) {
    const item = queue.shift()
    if (!item) return false
    worker.postMessage({ x: item[0], y: item[1] })
    return true
  }

  for (let i = 0; i < nWorkers; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), {
      workerData: { config: CONFIG }
    })

    w.on('message', ({ ox, oy, skipped: s, err }) => {
      done++
      if (s)   skipped++
      if (err) { errors++; console.error(`\n  ✗ ${oz}/${ox}/${oy}: ${err}`) }

      const elapsed = (Date.now() - startMs) / 1000
      const rate    = (done - skipped) / Math.max(1, elapsed - skipped * 0.01)
      const remain  = total - done
      const eta     = fmtEta(remain / Math.max(0.1, rate))

      process.stdout.write(
        `\r  ${done}/${total}  skipped=${skipped}  errors=${errors}  ` +
        `${(done/total*100).toFixed(1)}%  ETA ${eta}   `
      )

      if (!dispatch(w)) {
        activeWorkers--
        if (activeWorkers === 0) {
          const secs = ((Date.now() - startMs) / 1000).toFixed(0)
          console.log(`\n\nDone in ${fmtEta(Number(secs))}.`)
          console.log(`\nTo upload:\n  aws s3 sync ./${CONFIG.outDir} s3://YOUR_BUCKET/horizon \\`)
          console.log(`    --content-type application/octet-stream \\`)
          console.log(`    --content-encoding gzip \\`)
          console.log(`    --cache-control "public, max-age=31536000, immutable"`)
          process.exit(0)
        }
      }
    })

    w.on('error', e => console.error('\nWorker crashed:', e))
    workers.push(w)
    activeWorkers++
    dispatch(w)
  }
}

// ─── Worker thread ──────────────────────────────────────────────────────────

else {
  const cfg = workerData.config
  parentPort.on('message', async ({ x, y }) => {
    try {
      const result = await processOutputTile(x, y, cfg)
      parentPort.postMessage(result)
    } catch (err) {
      parentPort.postMessage({ ox: x, oy: y, skipped: false, err: err.message })
    }
  })
}
