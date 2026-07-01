/**
 * Transit verification script — all sun/moon positions use astronomy-engine
 * so this matches the updated issEngine.js exactly.
 *
 * Run: node scripts/verifyTransits.mjs
 */

import {
  propagate, twoline2satrec, gstime, eciToEcf, eciToGeodetic, ecfToLookAngles,
  geodeticToEcf, degreesToRadians, radiansToDegrees, degreesLong, degreesLat,
} from 'satellite.js'
import * as A from 'astronomy-engine'

const TLE1 = '1 25544U 98067A   26162.96453450  .00008067  00000+0  15344-3 0  9993'
const TLE2 = '2 25544  51.6334 325.9414 0004931 175.6343 184.4689 15.49182446570947'
const rec = twoline2satrec(TLE1, TLE2)

const DEG = Math.PI / 180
const R_EARTH = 6371

function propagateEcf(date) {
  const pv = propagate(rec, date)
  if (!pv?.position) return null
  return eciToEcf(pv.position, gstime(date))
}

function getIssLookAngles(date, lat, lng) {
  const ecf = propagateEcf(date)
  if (!ecf) return null
  const look = ecfToLookAngles(
    { longitude: degreesToRadians(lng), latitude: degreesToRadians(lat), height: 0 },
    ecf,
  )
  return {
    alt: radiansToDegrees(look.elevation),
    az:  ((radiansToDegrees(look.azimuth) % 360) + 360) % 360,
  }
}

function bodyEcefDir(date, body) {
  const astTime = A.MakeTime(date)
  const gv = A.GeoVector(body, astTime, false)
  const gast = gstime(date)
  const cx = Math.cos(gast), sx = Math.sin(gast)
  const x = gv.x * cx + gv.y * sx
  const y = -gv.x * sx + gv.y * cx
  const z = gv.z
  const len = Math.sqrt(x * x + y * y + z * z)
  return { x: x / len, y: y / len, z: z / len }
}

// Same as issEngine.js: convert ECF direction to topocentric alt/az
function ecfDirToAltAz(dir, lat, lng) {
  const latR = lat * DEG, lngR = lng * DEG
  const cLat = Math.cos(latR), sLat = Math.sin(latR)
  const cLng = Math.cos(lngR), sLng = Math.sin(lngR)
  const upX = cLat * cLng,  upY = cLat * sLng,  upZ = sLat
  const noX = -sLat * cLng, noY = -sLat * sLng, noZ = cLat
  const eaX = -sLng,        eaY = cLng,          eaZ = 0
  const alt = Math.asin(Math.max(-1, Math.min(1, dir.x*upX + dir.y*upY + dir.z*upZ))) / DEG
  const az  = (Math.atan2(dir.x*eaX + dir.y*eaY + dir.z*eaZ,
                           dir.x*noX + dir.y*noY + dir.z*noZ) / DEG + 360) % 360
  return { alt, az }
}

function bodyHorizon(date, body, lat, lng) {
  return ecfDirToAltAz(bodyEcefDir(date, body), lat, lng)
}

function angularSep(alt1, az1, alt2, az2) {
  const a1 = alt1 * DEG, z1 = az1 * DEG
  const a2 = alt2 * DEG, z2 = az2 * DEG
  const cos = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(z1 - z2)
  return Math.acos(Math.max(-1, Math.min(1, cos))) / DEG
}

function transitShadowPoint(issEcf, bodyDir) {
  const a = 6378.137, b = 6356.752
  const a2 = a * a, b2 = b * b
  const { x: px, y: py, z: pz } = issEcf
  const { x: dx, y: dy, z: dz } = bodyDir
  const A = (dx * dx + dy * dy) / a2 + dz * dz / b2
  const B = (px * dx + py * dy) / a2 + pz * dz / b2
  const C = (px * px + py * py) / a2 + pz * pz / b2 - 1
  const disc = B * B - A * C
  if (disc < 0) return null
  const t = (B - Math.sqrt(disc)) / A
  if (t <= 0) return null
  const gx = px - t * dx, gy = py - t * dy, gz = pz - t * dz
  // Bowring's iterative geodetic conversion
  const e2 = (a2 - b2) / a2
  const p = Math.sqrt(gx * gx + gy * gy)
  const lng = Math.atan2(gy, gx)
  let lat = Math.atan2(gz, p * (1 - e2))
  for (let i = 0; i < 6; i++) {
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)
    lat = Math.atan2(gz + e2 * N * Math.sin(lat), p)
  }
  return [lng * 180 / Math.PI, lat * 180 / Math.PI]
}

function transitShadowPathTimed(midTime) {
  const body = A.Body.Sun
  const out = []
  let nullCount = 0
  for (let dt = -90_000; dt <= 90_000; dt += 5_000) {
    const t = new Date(midTime.getTime() + dt)
    const ecf = propagateEcf(t)
    if (!ecf) { nullCount++; continue }
    const dir = bodyEcefDir(t, body)
    const pt = transitShadowPoint(ecf, dir)
    if (pt) out.push({ pt, t, dt })
    else nullCount++
  }
  return { points: out, nullCount }
}

const SUN_R = 0.267
const ISS_R = 0.009
const HIT   = SUN_R + ISS_R

function findTransits(lat, lng, start, hoursAhead) {
  const COARSE = 30, FINE = 0.5
  const startMs = start.getTime()
  const endMs   = startMs + hoursAhead * 3_600_000
  const transits = []
  let ms = startMs

  while (ms < endMs) {
    const t = new Date(ms)
    const look = getIssLookAngles(t, lat, lng)
    if (!look || look.alt < 0.5) { ms += COARSE * 1000; continue }
    const sun = bodyHorizon(t, A.Body.Sun, lat, lng)  // astronomy-engine, not SunCalc
    if (sun.alt < 0.5) { ms += COARSE * 1000; continue }
    const sep = angularSep(look.alt, look.az, sun.alt, sun.az)
    if (sep > 8) { ms += COARSE * 1000; continue }

    const windowEnd = Math.min(ms + COARSE * 1000, endMs)
    let inContact = false, contactStart = null, minSep = Infinity, midTime = null
    let midIssAlt = null, midSunAlt = null

    for (let fms = ms; fms < windowEnd; fms += FINE * 1000) {
      const ft  = new Date(fms)
      const fl  = getIssLookAngles(ft, lat, lng)
      if (!fl || fl.alt < 0) continue
      const fs  = bodyHorizon(ft, A.Body.Sun, lat, lng)
      if (fs.alt < 0) continue
      const fsep = angularSep(fl.alt, fl.az, fs.alt, fs.az)
      if (fsep <= HIT) {
        if (!inContact) { inContact = true; contactStart = ft }
        if (fsep < minSep) { minSep = fsep; midTime = ft; midIssAlt = fl.alt; midSunAlt = fs.alt }
      } else if (inContact) {
        transits.push({ start: contactStart, end: ft, midTime, minSepDeg: minSep,
          durationMs: ft - contactStart, issAlt: midIssAlt, sunAlt: midSunAlt })
        inContact = false
      }
    }
    ms = windowEnd
  }
  return transits
}

// ── Geometric unit tests ─────────────────────────────────────────────────────

function unitTests() {
  console.log('── Unit tests (analytic geometry) ───────────────────────────────────')
  const r = R_EARTH + 400

  // For ISS at [r,0,0] (sub-point 0°N,0°E), local "up" = [1,0,0].
  // Sun at E° elevation toward north: D_sun = [sin(E), 0, cos(E)]

  {
    const issEcf = { x: r, y: 0, z: 0 }
    const dir    = { x: 1, y: 0, z: 0 }
    const pt = transitShadowPoint(issEcf, dir)
    const ok = pt && Math.abs(pt[0]) < 0.001 && Math.abs(pt[1]) < 0.001
    console.log(`Case 1 (sun at zenith):    shadow=${pt ? `[${pt.map(v=>v.toFixed(4)).join(', ')}]` : 'null'}  ${ok ? '✓ = sub-sat point' : '✗'}`)
  }
  {
    const issEcf = { x: r, y: 0, z: 0 }
    const dir    = { x: Math.sin(45*DEG), y: 0, z: Math.cos(45*DEG) }
    const pt = transitShadowPoint(issEcf, dir)
    const expectKm = 400 / Math.tan(45*DEG)
    const actualKm = pt ? Math.abs(pt[1]) * 111 : NaN
    const ok = pt && Math.abs(actualKm - expectKm) < 50
    console.log(`Case 2 (sun at 45° north): shadow=${pt ? `[${pt.map(v=>v.toFixed(3)).join(', ')}]` : 'null'}  dist_south≈${actualKm.toFixed(0)} km  expected≈${expectKm.toFixed(0)} km  ${ok ? '✓' : '✗'}`)
  }
  {
    const issEcf = { x: r, y: 0, z: 0 }
    const dir    = { x: Math.sin(10*DEG), y: 0, z: Math.cos(10*DEG) }
    const pt = transitShadowPoint(issEcf, dir)
    console.log(`Case 3 (sun at 10° elev):  shadow=${pt ? `[${pt.map(v=>v.toFixed(3)).join(', ')}]` : 'null'}  ${pt === null ? '✓ (shadow misses Earth)' : '✗'}`)
  }
  {
    const issEcf = { x: r, y: 0, z: 0 }
    const dir    = { x: Math.sin(50*DEG), y: 0, z: Math.cos(50*DEG) }
    const pt = transitShadowPoint(issEcf, dir)
    if (pt) {
      const [lng, lat] = pt
      // Use WGS84 observer position (same as satellite.js geodeticToEcf)
      const obsEcf = geodeticToEcf({ latitude: degreesToRadians(lat), longitude: degreesToRadians(lng), height: 0 })
      const dx=issEcf.x-obsEcf.x, dy=issEcf.y-obsEcf.y, dz=issEcf.z-obsEcf.z
      const dd=Math.sqrt(dx**2+dy**2+dz**2)
      const issLook = ecfDirToAltAz({ x:dx/dd, y:dy/dd, z:dz/dd }, lat, lng)
      const sunLook = ecfDirToAltAz(dir, lat, lng)
      const sep = angularSep(issLook.alt, issLook.az, sunLook.alt, sunLook.az)
      const ok = sep < 0.0001
      console.log(`Case 4 (back-verify sep):  shadow=[${pt.map(v=>v.toFixed(3)).join(', ')}]  ISS-sun sep=${sep.toFixed(6)}°  ${ok ? '✓ (formula correct)' : '✗'}`)
    }
  }
  console.log()
}

// ── Real transit verification ────────────────────────────────────────────────

function verifyTransit(obs, tr) {
  const { points, nullCount } = transitShadowPathTimed(tr.midTime)
  const total = 37
  const pathKm = (() => {
    if (points.length < 2) return 0
    const [lng1, lat1] = points[0].pt, [lng2, lat2] = points[points.length-1].pt
    const dLat = (lat2-lat1)*DEG, dLng = (lng2-lng1)*DEG
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*DEG)*Math.cos(lat2*DEG)*Math.sin(dLng/2)**2
    return 2*R_EARTH*Math.asin(Math.sqrt(a))
  })()

  console.log(`\n  ${obs.name} transit at ${tr.midTime.toISOString()}`)
  console.log(`  Duration: ${(tr.durationMs/1000).toFixed(1)}s  MinSep: ${tr.minSepDeg.toFixed(4)}°  ISS_alt: ${tr.issAlt?.toFixed(1)}°  Sun_alt: ${tr.sunAlt?.toFixed(1)}°`)
  console.log(`  Path: ${points.length}/${total} pts  (${nullCount} null = sun<20° from ISS, shadow misses Earth)  length≈${pathKm.toFixed(0)} km`)

  if (points.length === 0) {
    console.log(`  ⚠  No shadow path — sun too low, ISS shadow misses Earth at all moments`)
    return 'no-path'
  }

  const stride = Math.max(1, Math.floor(points.length / 5))
  const indices = []
  for (let i = 0; i < points.length; i += stride) indices.push(i)
  if (!indices.includes(points.length - 1)) indices.push(points.length - 1)

  let passed = 0, failed = 0
  for (const i of indices) {
    const { pt, t, dt } = points[i]
    const [lng, lat] = pt
    // Use astronomy-engine for both ISS look angles and sun direction
    const issLook = getIssLookAngles(t, lat, lng)
    const sunDir  = bodyEcefDir(t, A.Body.Sun)
    const sunLook = ecfDirToAltAz(sunDir, lat, lng)
    if (!issLook) { console.log(`    pt[${i}]: compute failed`); continue }
    const sep = angularSep(issLook.alt, issLook.az, sunLook.alt, sunLook.az)
    const ok = sep < 0.05
    if (ok) passed++; else failed++
    console.log(`    pt[${i}] dt=${(dt/1000).toFixed(0).padStart(4)}s  [${lng.toFixed(2)},${lat.toFixed(2)}]  iss_alt=${issLook.alt.toFixed(1)}°  sun_alt=${sunLook.alt.toFixed(1)}°  ISS-sun sep=${sep.toFixed(4)}°  ${ok ? '✓' : '✗'}`)
  }
  return failed === 0 ? 'pass' : 'fail'
}

// ── Main ──────────────────────────────────────────────────────────────────────

unitTests()

const observers = [
  { name: 'New York',     lat: 40.71, lng: -74.01 },
  { name: 'Chicago',      lat: 41.88, lng: -87.63 },
  { name: 'Houston',      lat: 29.76, lng: -95.37 },
  { name: 'Los Angeles',  lat: 34.05, lng: -118.24 },
  { name: 'Denver',       lat: 39.74, lng: -104.98 },
  { name: 'Miami',        lat: 25.77, lng: -80.19 },
  { name: 'Seattle',      lat: 47.61, lng: -122.33 },
  { name: 'London',       lat: 51.51, lng: -0.13 },
  { name: 'Paris',        lat: 48.85, lng: 2.35 },
  { name: 'Berlin',       lat: 52.52, lng: 13.40 },
  { name: 'Madrid',       lat: 40.42, lng: -3.70 },
  { name: 'Rome',         lat: 41.90, lng: 12.50 },
  { name: 'Cairo',        lat: 30.04, lng: 31.24 },
  { name: 'Mumbai',       lat: 19.08, lng: 72.88 },
  { name: 'Tokyo',        lat: 35.68, lng: 139.69 },
  { name: 'Beijing',      lat: 39.91, lng: 116.39 },
  { name: 'Sydney',       lat: -33.87, lng: 151.21 },
  { name: 'Buenos Aires', lat: -34.60, lng: -58.38 },
  { name: 'São Paulo',    lat: -23.55, lng: -46.63 },
  { name: 'Nairobi',      lat: -1.29, lng: 36.82 },
]

const start = new Date()
console.log('── Real transit scan (30 days, 20 cities) ────────────────────────────')
console.log(`TLE epoch: ${new Date((rec.jdsatepoch - 2440587.5) * 86400000).toISOString()}`)
console.log()

let found = 0, passed = 0, noPath = 0, failed = 0

for (const obs of observers) {
  const transits = findTransits(obs.lat, obs.lng, start, 24 * 30)
  if (transits.length === 0) { process.stdout.write('.'); continue }
  for (const tr of transits) {
    found++
    const result = verifyTransit(obs, tr)
    if (result === 'pass') passed++
    else if (result === 'no-path') noPath++
    else failed++
  }
}

console.log(`\n${'─'.repeat(65)}`)
console.log(`Found: ${found}  |  Path correct: ${passed}  |  No shadow path: ${noPath}  |  Incorrect: ${failed}`)
console.log()
if (found > 0 && passed === found - noPath) {
  console.log('✓ All paths with valid shadow geometry are geometrically verified.')
}
console.log()
console.log('Detection and path computation now both use astronomy-engine.')
console.log('Shadow path: for each moment ±90s, finds the Earth surface point from')
console.log('which looking toward the sun you would see the ISS exactly at disc center.')
console.log('Path is null when sun elevation < ~20° from ISS sub-point (shadow misses Earth).')
