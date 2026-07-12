import {
  propagate,
  twoline2satrec,
  gstime,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  geodeticToEcf,
  degreesToRadians,
  radiansToDegrees,
  degreesLong,
  degreesLat,
} from 'satellite.js'
import * as A from 'astronomy-engine'
import SunCalc from 'suncalc'

// Zarya (first ISS module) launch date — no ISS data exists before this
export const ISS_LAUNCH_MS = Date.UTC(1998, 10, 20) // 1998-11-20

const EARTH_R_KM = 6371

// ── Satellite catalog ─────────────────────────────────────────────────────────
// Every exported function takes an explicit satellite (defaulting to the ISS),
// so multiple satellites can be tracked and rendered concurrently.
// discRadiusDeg ≈ apparent angular radius at typical range (drives the transit
// visibility-band width); baseMag anchors the brightness estimate. Only the
// ISS has a historical TLE archive; the others fall back to the live TLE.

export const SATELLITES = [
  {
    id: 'iss', name: 'ISS', catnr: 25544,
    launchMs: ISS_LAUNCH_MS,
    discRadiusDeg: 0.009, baseMag: -1.3,
    color: '#0ea5e9', darkColor: '#0369a1',
    overlayKey: 'satIss',
  },
  {
    id: 'tiangong', name: 'Tiangong', catnr: 48274,
    launchMs: Date.UTC(2021, 3, 29),   // Tianhe core module
    discRadiusDeg: 0.004, baseMag: 0.2,
    color: '#f472b6', darkColor: '#be185d',
    overlayKey: 'satTiangong',
  },
  {
    id: 'hst', name: 'Hubble', catnr: 20580,
    launchMs: Date.UTC(1990, 3, 24),
    discRadiusDeg: 0.0015, baseMag: 2.0,
    color: '#a78bfa', darkColor: '#6d28d9',
    overlayKey: 'satHst',
  },
]

export const DEFAULT_SAT = SATELLITES[0]

export function satById(id) {
  return SATELLITES.find(s => s.id === id) ?? DEFAULT_SAT
}

// TLE sources tried in order. ivanstanojevic returns JSON; celestrak returns plain text.
function tleSources(catnr) {
  return [
    { url: `https://tle.ivanstanojevic.me/api/tle/${catnr}`, format: 'json' },
    { url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`, format: 'text' },
  ]
}
const FETCH_TIMEOUT_MS = 5000
const CACHE_MS = 6 * 60 * 60 * 1000
const PASS_SCAN_STEP_SEC = 30
const PASS_REFINE_STEPS = 12

// Per-satellite live TLE state (current + recent future)
const satStates = new Map()   // catnr → { liveSatrec, lastFetch, loadPromise }

function satState(sat = DEFAULT_SAT) {
  let s = satStates.get(sat.catnr)
  if (!s) {
    s = { liveSatrec: null, lastFetch: 0, loadPromise: null }
    satStates.set(sat.catnr, s)
  }
  return s
}

// Updated: 2026-06-12 (ISS only — other satellites have no offline fallback)
const FALLBACK_TLE = `ISS (ZARYA)
1 25544U 98067A   26162.96453450  .00008067  00000+0  15344-3 0  9993
2 25544  51.6334 325.9414 0004931 175.6343 184.4689 15.49182446570947`

// ── TLE parsing ───────────────────────────────────────────────────────────────

function parseTleParts(line1, line2) {
  return twoline2satrec(line1.trim(), line2.trim())
}

function parseTleText(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 3) throw new Error('Invalid TLE text')
  return parseTleParts(lines[1], lines[2])
}

function parseTleJson(json) {
  if (!json.line1 || !json.line2) throw new Error('Invalid TLE JSON')
  return parseTleParts(json.line1, json.line2)
}

async function fetchTleSource({ url, format }) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (format === 'json') return parseTleJson(await res.json())
    return parseTleText(await res.text())
  } finally {
    clearTimeout(id)
  }
}

// Bumped whenever the underlying TLE data changes (live fetch, archive load).
// Memo caches below include it so paused-clock results don't go stale.
let dataVersion = 0

// Historical TLE archive — loaded lazily so its ~950 KB doesn't block the
// eclipse page. Until it arrives, getSatrecInfo falls back to the live TLE.
let ARCHIVE = []
let archivePromise = null

export function loadIssArchive() {
  if (!archivePromise) {
    archivePromise = import('./issArchive.json')
      .then(m => { ARCHIVE = m.default ?? m; dataVersion++ })
      .catch(e => { console.warn('[issEngine] archive load failed:', e.message); archivePromise = null })
  }
  return archivePromise
}

/** Fetch (or refresh) a satellite's live TLE. Tries multiple sources;
 *  the ISS falls back to a hardcoded TLE if every source fails.
 *  maxCacheMs: how fresh the cached TLE must be before we skip a re-fetch (default 6 h). */
export function loadIssTle({ maxCacheMs = CACHE_MS, sat = DEFAULT_SAT } = {}) {
  if (sat.id === 'iss') loadIssArchive()   // kick off the archive fetch in parallel; never blocks
  const state = satState(sat)
  const now = Date.now()
  if (state.liveSatrec && now - state.lastFetch < maxCacheMs) return Promise.resolve(state.liveSatrec)
  if (state.loadPromise) return state.loadPromise

  state.loadPromise = (async () => {
    for (const source of tleSources(sat.catnr)) {
      try {
        state.liveSatrec = await fetchTleSource(source)
        state.lastFetch  = Date.now()
        state.loadPromise = null
        dataVersion++
        return state.liveSatrec
      } catch (e) {
        console.warn(`[issEngine] TLE source failed (${source.url}):`, e.name === 'AbortError' ? 'timeout' : e.message)
      }
    }
    if (sat.id === 'iss' && !state.liveSatrec) {
      console.warn('[issEngine] All TLE sources failed — using hardcoded ISS fallback')
      state.liveSatrec = parseTleText(FALLBACK_TLE)
      dataVersion++
    }
    state.loadPromise = null
    return state.liveSatrec
  })()

  return state.loadPromise
}

// ── Archive TLE lookup ────────────────────────────────────────────────────────
// ARCHIVE: Array<[epochMs, line1, line2]> sorted ascending by epochMs.
// Populated by scripts/fetchIssArchive.mjs.

const archiveCache = new Map() // epochMs → parsed satrec

function getArchiveSatrec(epochMs, l1, l2) {
  if (!archiveCache.has(epochMs)) {
    try { archiveCache.set(epochMs, parseTleParts(l1, l2)) } catch { return null }
  }
  return archiveCache.get(epochMs)
}

// Live TLE is preferred over the archive for dates within this window before now (or future).
// The live TLE is always the freshest available; the archive is weekly at best.
const LIVE_PREFER_MS = 7 * 24 * 3600 * 1000

/**
 * Returns the best satrec for a given date:
 *   - Near-current / future (within last 7 days or any future) → live TLE (freshest)
 *   - Historical             → archive entry within ±7 days
 *   - Fallback               → live TLE regardless
 */
function getSatrecInfo(date, sat = DEFAULT_SAT) {
  const t   = date.getTime()
  const now = Date.now()
  const live = satState(sat).liveSatrec

  function liveResult() {
    if (!live) return { rec: null, source: null, epochMs: null, ageDays: null }
    const epochMs = (live.jdsatepoch - 2440587.5) * 86400000
    return {
      rec:      live,
      source:   t > now ? 'predicted' : 'live',
      epochMs,
      ageDays:  Math.abs(t - epochMs) / 86400000,
    }
  }

  // For near-current / future dates, the live TLE is always fresher than any archive entry
  if (t >= now - LIVE_PREFER_MS) {
    const r = liveResult()
    if (r.rec) return r
    // live TLE not yet loaded — fall through to archive as backup
  }

  // Historical archive exists for the ISS only
  if (sat.id === 'iss' && ARCHIVE.length > 0) {
    // Binary search for the closest archive entry
    let lo = 0, hi = ARCHIVE.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (ARCHIVE[mid][0] < t) lo = mid + 1
      else hi = mid
    }
    const candidates = [ARCHIVE[lo]]
    if (lo > 0) candidates.push(ARCHIVE[lo - 1])
    const best = candidates.reduce((a, b) =>
      Math.abs(a[0] - t) < Math.abs(b[0] - t) ? a : b
    )
    const ageDays = Math.abs(best[0] - t) / 86400000
    // Accept any archive TLE within 14 days — with tiered density (6h recent, daily mid,
    // weekly old) the closest entry is usually within hours for recent dates.
    if (ageDays <= 14) {
      const rec = getArchiveSatrec(best[0], best[1], best[2])
      if (rec) return { rec, source: 'archive', epochMs: best[0], ageDays }
    }
  }

  return liveResult()
}

/**
 * Returns info about the data source for a given date.
 * Useful for showing accuracy badges in the UI.
 *   source: 'archive' | 'live' | 'predicted' | 'unavailable'
 *   ageDays: days between the date and the TLE epoch (lower = more accurate)
 *   epochDate: Date of the TLE epoch used
 */
export function getIssDataSource(date, sat = DEFAULT_SAT) {
  const info = getSatrecInfo(date, sat)
  if (!info.rec) return { source: 'unavailable', ageDays: null, epochDate: null }
  return {
    source:    info.source,
    ageDays:   info.ageDays,
    epochDate: info.epochMs != null ? new Date(info.epochMs) : null,
  }
}

// ── Low-level propagation helpers ─────────────────────────────────────────────

function propagatePos(date, rec) {
  if (!rec) return null
  const pv = propagate(rec, date)
  if (!pv?.position) return null
  return pv
}

function propagateEcf(date, rec) {
  const pv = propagatePos(date, rec)
  if (!pv) return null
  return eciToEcf(pv.position, gstime(date))
}

// ── Exported position / look-angle functions ──────────────────────────────────

/** Sub-satellite point [lng, lat] and altitude (km). Returns null if TLE not loaded or propagation fails.
 *  Memoized on exact time — called several times per render pass with the same simTime. */
let _posCache = null

export function getIssPosition(date, sat = DEFAULT_SAT) {
  const t = date.getTime()
  if (_posCache && _posCache.t === t && _posCache.sat === sat.id && _posCache.v === dataVersion) return _posCache.result
  const { rec } = getSatrecInfo(date, sat)
  let result = null
  if (rec) {
    const pv = propagatePos(date, rec)
    if (pv) {
      const gd = eciToGeodetic(pv.position, gstime(date))
      const lng = degreesLong(gd.longitude)
      const lat = degreesLat(gd.latitude)
      if (isFinite(lng) && isFinite(lat) && isFinite(gd.height)) result = { lng, lat, altKm: gd.height }
    }
  }
  _posCache = { t, sat: sat.id, result, v: dataVersion }
  return result
}

/** Observer-relative ISS look angles. Returns altitude/elevation, azimuth, and range. */
export function getIssLookAngles(date, lat, lng, heightKm = 0, sat = DEFAULT_SAT) {
  const { rec } = getSatrecInfo(date, sat)
  const ecf = propagateEcf(date, rec)
  if (!ecf) return null
  const look = ecfToLookAngles({
    longitude: degreesToRadians(lng),
    latitude:  degreesToRadians(lat),
    height:    heightKm,
  }, ecf)
  return {
    alt:     radiansToDegrees(look.elevation),
    az:      ((radiansToDegrees(look.azimuth) % 360) + 360) % 360,
    rangeKm: look.rangeSat,
  }
}

export function getIssSubPoint(date, sat = DEFAULT_SAT) {
  const pos = getIssPosition(date, sat)
  return pos ? [pos.lng, pos.lat] : null
}

// ── TLE metadata ──────────────────────────────────────────────────────────────

export function getIssTleEpochDate(sat = DEFAULT_SAT) {
  const live = satState(sat).liveSatrec
  if (!live?.jdsatepoch) return null
  return new Date((live.jdsatepoch - 2440587.5) * 86400000)
}

export function getIssTleAgeDays(date = new Date(), sat = DEFAULT_SAT) {
  const epoch = getIssTleEpochDate(sat)
  if (!epoch) return null
  return Math.abs(date.getTime() - epoch.getTime()) / 86400000
}

// ── Ground track ──────────────────────────────────────────────────────────────

function recOrbitMinutes(rec) {
  if (!rec?.no) return 93
  return (2 * Math.PI) / rec.no
}

export function getIssOrbitMinutes(sat = DEFAULT_SAT) {
  return recOrbitMinutes(satState(sat).liveSatrec)
}

function splitAtAntimeridian(coords) {
  if (coords.length < 2) return coords.length ? [coords] : []
  const segments = []
  let seg = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const lng0 = coords[i - 1][0]
    const lng1 = coords[i][0]
    if (Math.abs(lng1 - lng0) > 180) {
      if (seg.length > 1) segments.push(seg)
      seg = [coords[i]]
    } else {
      seg.push(coords[i])
    }
  }
  if (seg.length > 1) segments.push(seg)
  return segments
}

// Ground-track point cache. Points are propagated on a globally aligned time
// grid, so as the rolling window advances only the handful of newly exposed
// grid points need an SGP4 propagation — everything else is a Map hit. This
// turns the per-frame cost (while the sim clock plays) from ~370 propagations
// into ~zero.
const TRACK_STEP_SEC = 15
const trackCache = new Map()   // `${satrecId}:${gridMs}` → [lng, lat] | null

function recId(rec) {
  return `${rec.satnum}:${rec.jdsatepoch}`
}

function trackPointAt(gridMs, rec, id) {
  const key = `${id}:${gridMs}`
  if (trackCache.has(key)) return trackCache.get(key)
  let coord = null
  const t  = new Date(gridMs)
  const pv = propagatePos(t, rec)
  if (pv) {
    const gd  = eciToGeodetic(pv.position, gstime(t))
    const lng = degreesLong(gd.longitude)
    const lat = degreesLat(gd.latitude)
    if (isFinite(lng) && isFinite(lat) && isFinite(gd.height)) coord = [lng, lat]
  }
  if (trackCache.size > 50000) trackCache.clear()
  trackCache.set(key, coord)
  return coord
}

/**
 * Ground track split into past and future segments.
 * Rolling window centered on `atDate` (half an orbit behind, half ahead) so the
 * track is always connected through the current ISS position and never snaps
 * when a revolution completes.
 */
export function getIssGroundTrackPhases(atDate, stepSec = TRACK_STEP_SEC, sat = DEFAULT_SAT) {
  const { rec } = getSatrecInfo(atDate, sat)
  if (!rec) return { past: [], future: [] }

  const id        = recId(rec)
  const periodMs  = recOrbitMinutes(rec) * 60 * 1000
  const stepMs    = stepSec * 1000
  const t         = atDate.getTime()
  const startMs   = Math.ceil((t - periodMs / 2) / stepMs) * stepMs   // grid-aligned
  const endMs     = t + periodMs / 2

  const past = [], future = []
  for (let ms = startMs; ms <= endMs; ms += stepMs) {
    const coord = trackPointAt(ms, rec, id)
    if (!coord) continue
    if (ms <= t) past.push(coord)
    else future.push(coord)
  }

  // Insert current position at boundary so past and future connect smoothly
  const current = getIssPosition(atDate, sat)
  if (current) {
    const c = [current.lng, current.lat]
    const lastPast = past[past.length - 1]
    if (!lastPast || lastPast[0] !== c[0] || lastPast[1] !== c[1]) past.push(c)
    future.unshift(c)
  }

  return { past: splitAtAntimeridian(past), future: splitAtAntimeridian(future) }
}

export function issPathGeoJSON(segments) {
  if (!segments?.length) {
    return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] } }
  }
  return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segments } }
}

// ── Visibility calculations ───────────────────────────────────────────────────

/** Ground radius (km) where ISS is at least `minElevDeg` above the horizon. */
export function getIssVisibilityRadiusKm(altKm, minElevDeg = 0) {
  const h   = Math.max(altKm, 0)
  const e   = (minElevDeg * Math.PI) / 180
  const arg = Math.max(-1, Math.min(1, (EARTH_R_KM / (EARTH_R_KM + h)) * Math.cos(e)))
  return EARTH_R_KM * Math.max(0, Math.acos(arg) - e)
}

/** True when the satellite is sunlit (not in Earth's shadow). */
export function isIssSunlit(date, sat = DEFAULT_SAT) {
  const { rec } = getSatrecInfo(date, sat)
  if (!rec) return false
  const pv = propagatePos(date, rec)
  if (!pv) return false

  const { x: px, y: py, z: pz } = pv.position
  const r = Math.hypot(px, py, pz)
  if (r < 1) return false

  const sun  = A.GeoVector(A.Body.Sun, date, true)
  const sLen = Math.hypot(sun.x, sun.y, sun.z)
  if (sLen < 1e-6) return true

  const cosAngle      = (px * sun.x + py * sun.y + pz * sun.z) / (r * sLen)
  const angleToAntiSun = Math.acos(Math.max(-1, Math.min(1, -cosAngle)))
  const earthAngular   = Math.asin(Math.max(-1, Math.min(1, EARTH_R_KM / r)))
  return angleToAntiSun > earthAngular
}

export function isObserverDark(date, lat, lng, maxSunAltDeg = -6) {
  const sun = SunCalc.getPosition(date, lat, lng)
  return sun.altitude * 180 / Math.PI <= maxSunAltDeg
}

function visibilityState(date, lat, lng, minElevDeg, sat) {
  const look  = getIssLookAngles(date, lat, lng, 0, sat)
  const above = (look?.alt ?? -90) >= minElevDeg
  if (!look || !above) return { look, sunlit: false, dark: false, visible: false }
  const sunlit = isIssSunlit(date, sat)
  const dark   = isObserverDark(date, lat, lng)
  return { look, sunlit, dark, visible: Boolean(sunlit && dark) }
}

// Memoized on exact (time, lat, lng, minElev) — the map layer effect and the
// IssIndicator both call this with identical args in the same render pass.
let _visCache = null

export function getIssVisibilityStatus(date, lat, lng, minElevDeg = 10, sat = DEFAULT_SAT) {
  const t = date.getTime()
  if (_visCache && _visCache.t === t && _visCache.sat === sat.id && _visCache.lat === lat && _visCache.lng === lng && _visCache.minElevDeg === minElevDeg && _visCache.v === dataVersion)
    return _visCache.result
  const result = computeIssVisibilityStatus(date, lat, lng, minElevDeg, sat)
  _visCache = { t, sat: sat.id, lat, lng, minElevDeg, result, v: dataVersion }
  return result
}

function computeIssVisibilityStatus(date, lat, lng, minElevDeg, sat) {
  const pos = getIssPosition(date, sat)
  if (!pos) return { status: 'unavailable', label: `${sat.name} position unavailable`, pos: null }

  const { source, ageDays } = getIssDataSource(date, sat)
  if (source === 'predicted' && ageDays > 14) {
    return { status: 'predicted', label: `Predicted position (~${Math.round(ageDays)}d from TLE)`, pos, ageDays }
  }

  const sunlit = isIssSunlit(date, sat)
  if (!sunlit) return { status: 'not-sunlit', label: `${sat.name} in Earth shadow`, pos, sunlit }

  if (lat == null || lng == null) return { status: 'sunlit', label: `${sat.name} sunlit`, pos, sunlit }

  const look = getIssLookAngles(date, lat, lng, 0, sat)
  const dark = isObserverDark(date, lat, lng)
  if (!look || look.alt < minElevDeg) {
    return { status: 'out-of-range', label: 'Below local viewing angle', pos, sunlit, dark, look }
  }
  if (!dark) {
    return { status: 'daylight', label: 'Daylight at selected location', pos, sunlit, dark, look }
  }
  return { status: 'visible', label: 'Visible from selected location', pos, sunlit, dark, look }
}

// ── Pass finder ───────────────────────────────────────────────────────────────

function refineBoundary(loMs, hiMs, lat, lng, thresholdDeg, sat) {
  let lo = loMs, hi = hiMs
  const loAbove = (getIssLookAngles(new Date(lo), lat, lng, 0, sat)?.alt ?? -90) >= thresholdDeg
  for (let i = 0; i < PASS_REFINE_STEPS; i++) {
    const mid     = (lo + hi) / 2
    const midAbove = (getIssLookAngles(new Date(mid), lat, lng, 0, sat)?.alt ?? -90) >= thresholdDeg
    if (midAbove === loAbove) lo = mid; else hi = mid
  }
  return new Date((lo + hi) / 2)
}

function refineMax(startMs, endMs, lat, lng, sat) {
  let best = null
  const span = endMs - startMs
  for (let i = 0; i <= 80; i++) {
    const t    = new Date(startMs + span * i / 80)
    const look = getIssLookAngles(t, lat, lng, 0, sat)
    if (!look) continue
    if (!best || look.alt > best.look.alt) best = { time: t, look }
  }
  return best
}

function cardinalFromAz(az) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return labels[Math.round((((az % 360) + 360) % 360) / 45) % 8]
}

function estimateIssMagnitude(look, sat) {
  if (!look) return null
  const rangeTerm     = 5 * Math.log10(Math.max(look.rangeKm, 1) / 1000)
  const elevationBoost = -0.012 * Math.max(0, look.alt - 10)
  return sat.baseMag + rangeTerm + elevationBoost
}

function samplePassPath(startMs, endMs, lat, lng, sat, samples = 7) {
  const pts = [], span = endMs - startMs
  for (let i = 0; i < samples; i++) {
    const t    = new Date(startMs + span * (samples === 1 ? 0 : i / (samples - 1)))
    const look = getIssLookAngles(t, lat, lng, 0, sat)
    if (!look) continue
    pts.push({ time: t, alt: look.alt, az: look.az, dir: cardinalFromAz(look.az) })
  }
  return pts
}

export function findIssVisiblePasses(lat, lng, {
  start     = new Date(),
  hoursAhead = 36,
  minElevDeg = 10,
  maxPasses  = 8,
  sat        = DEFAULT_SAT,
} = {}) {
  if (!getSatrecInfo(start, sat).rec || lat == null || lng == null) return []

  const passes = []
  const startMs = start.getTime()
  const endMs   = startMs + hoursAhead * 60 * 60 * 1000
  const stepMs  = PASS_SCAN_STEP_SEC * 1000
  let inPass = false, passStart = null
  let prevMs    = startMs
  let prevState = visibilityState(new Date(prevMs), lat, lng, minElevDeg, sat)

  for (let ms = startMs + stepMs; ms <= endMs && passes.length < maxPasses; ms += stepMs) {
    const state = visibilityState(new Date(ms), lat, lng, minElevDeg, sat)
    if (!inPass && !prevState.visible && state.visible) {
      passStart = refineBoundary(prevMs, ms, lat, lng, minElevDeg, sat)
      inPass = true
    }
    if (inPass && prevState.visible && !state.visible) {
      const passEnd = refineBoundary(prevMs, ms, lat, lng, minElevDeg, sat)
      const max     = refineMax(passStart.getTime(), passEnd.getTime(), lat, lng, sat)
      if (max) {
        const startLook = getIssLookAngles(passStart, lat, lng, 0, sat)
        const endLook   = getIssLookAngles(passEnd,   lat, lng, 0, sat)
        passes.push({
          id: `${sat.id}-${passStart.getTime()}-${passEnd.getTime()}`,
          satId: sat.id, satName: sat.name,
          start: passStart, end: passEnd,
          maxTime: max.time, maxAlt: max.look.alt, maxAz: max.look.az,
          startAz: startLook?.az ?? null, endAz: endLook?.az ?? null,
          startDir: startLook ? cardinalFromAz(startLook.az) : '',
          maxDir:   cardinalFromAz(max.look.az),
          endDir:   endLook   ? cardinalFromAz(endLook.az)   : '',
          durationSec: Math.max(0, Math.round((passEnd - passStart) / 1000)),
          magnitude:   estimateIssMagnitude(max.look, sat),
          path:        samplePassPath(passStart.getTime(), passEnd.getTime(), lat, lng, sat),
        })
      }
      inPass = false; passStart = null
    }
    prevMs = ms; prevState = state
  }

  return passes
}

// ── Transit calculators ───────────────────────────────────────────────────────

const DEG = Math.PI / 180

// Return the ECF unit vector pointing from Earth's center toward the given body (Sun or Moon).
// Uses astronomy-engine for the geocentric equatorial position, then rotates to ECF
// with satellite.js's gstime so both frames stay consistent.
function bodyEcefDir(date, body) {
  const astTime = A.MakeTime(date)
  const gv = A.GeoVector(body, astTime, false)  // geocentric equatorial (ECI), in AU
  const gast = gstime(date)                      // GAST in radians (same convention as satellite.js ECF)
  const cx = Math.cos(gast), sx = Math.sin(gast)
  const x = gv.x * cx + gv.y * sx
  const y = -gv.x * sx + gv.y * cx
  const z = gv.z
  const len = Math.sqrt(x * x + y * y + z * z)
  return { x: x / len, y: y / len, z: z / len }
}

// Find the ground point from which the ISS appears directly in front of `bodyDir`.
// Solves the ray-WGS84-ellipsoid intersection so the returned [lng, lat] are
// geodetic — consistent with satellite.js's ecfToLookAngles which also uses WGS84.
// Returns [lng, lat] or null if the geometry is degenerate.
function transitShadowPoint(issEcf, bodyDir) {
  const a  = 6378.137   // WGS84 semi-major axis (km)
  const b  = 6356.752   // WGS84 semi-minor axis (km)
  const a2 = a * a, b2 = b * b
  const { x: px, y: py, z: pz } = issEcf
  const { x: dx, y: dy, z: dz } = bodyDir

  // Quadratic: A*t^2 - 2B*t + C = 0  (intersection of ray with ellipsoid)
  const A = (dx * dx + dy * dy) / a2 + dz * dz / b2
  const B = (px * dx + py * dy) / a2 + pz * dz / b2
  const C = (px * px + py * py) / a2 + pz * pz / b2 - 1
  const disc = B * B - A * C
  if (disc < 0) return null
  const t = (B - Math.sqrt(disc)) / A   // smaller root = near-side intersection
  if (t <= 0) return null

  const gx = px - t * dx, gy = py - t * dy, gz = pz - t * dz

  // ECF → geodetic via Bowring's iterative method (converges in 4-6 iterations)
  const e2  = (a2 - b2) / a2   // first eccentricity squared (WGS84 ≈ 0.00669438)
  const p   = Math.sqrt(gx * gx + gy * gy)
  const lng = Math.atan2(gy, gx)
  let lat = Math.atan2(gz, p * (1 - e2))   // geocentric starting estimate
  for (let i = 0; i < 6; i++) {
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)
    lat = Math.atan2(gz + e2 * N * Math.sin(lat), p)
  }
  return [lng * 180 / Math.PI, lat * 180 / Math.PI]
}

// Ground shadow path ±90 s around a transit midTime.
// Each point is where an observer would need to stand to see the ISS cross the body at that instant.
function transitShadowPath(startTime, endTime, type, sat) {
  const body = type === 'solar' ? A.Body.Sun : A.Body.Moon
  const dMs = Math.max(endTime - startTime, 1)
  const steps = Math.max(4, Math.round(dMs / 50))
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const t = new Date(startTime.getTime() + (i / steps) * dMs)
    const { rec } = getSatrecInfo(t, sat)
    const ecf = propagateEcf(t, rec)
    if (!ecf) continue
    const dir = bodyEcefDir(t, body)
    const pt = transitShadowPoint(ecf, dir)
    if (pt) coords.push(pt)
  }
  return coords
}

// Compute the visibility band polygon — the ground corridor where the ISS is at least
// partially overlapping the solar/lunar disc (angular sep < disc_r + ISS_r).
// Returns a GeoJSON ring (array of [lng, lat]) or null if too few samples.
function transitBandPolygon(startTime, endTime, type, sat) {
  const body = type === 'solar' ? A.Body.Sun : A.Body.Moon
  const DISC_R = type === 'solar' ? SUN_R : MOON_R
  const halfAngRad = (DISC_R + sat.discRadiusDeg) * DEG
  const a = 6378.137, b = 6356.752, a2 = a * a, b2 = b * b, e2 = (a2 - b2) / a2

  const dMs = Math.max(endTime - startTime, 1)
  const steps = Math.max(4, Math.round(dMs / 50))
  const samples = []

  for (let i = 0; i <= steps; i++) {
    const t = new Date(startTime.getTime() + (i / steps) * dMs)
    const { rec } = getSatrecInfo(t, sat)
    const ecf = propagateEcf(t, rec)
    if (!ecf) continue
    const dir = bodyEcefDir(t, body)
    const pt = transitShadowPoint(ecf, dir)
    if (!pt) continue

    const [lng_c, lat_c] = pt
    const latR = lat_c * DEG, lngR = lng_c * DEG
    const sinLat = Math.sin(latR), cosLat = Math.cos(latR)
    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat)
    const ox = N * cosLat * Math.cos(lngR)
    const oy = N * cosLat * Math.sin(lngR)
    const oz = N * (1 - e2) * sinLat
    const range = Math.sqrt((ecf.x - ox) ** 2 + (ecf.y - oy) ** 2 + (ecf.z - oz) ** 2)
    samples.push({ lng: lng_c, lat: lat_c, halfWidthKm: range * Math.sin(halfAngRad) })
  }

  if (samples.length < 2) return null

  const left = [], right = []
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const prev = samples[Math.max(0, i - 1)]
    const next = samples[Math.min(samples.length - 1, i + 1)]

    // Path direction in km-space (EW scaled by cos(lat))
    const dlng = (next.lng - prev.lng) * Math.cos(s.lat * DEG)
    const dlat = next.lat - prev.lat
    const dlen = Math.sqrt(dlng * dlng + dlat * dlat)
    if (dlen < 1e-10) { left.push([s.lng, s.lat]); right.push([s.lng, s.lat]); continue }

    // Perpendicular direction (90° clockwise from path direction, in km-space)
    const perpE =  dlat / dlen
    const perpN = -dlng / dlen

    const dLat = s.halfWidthKm / 111.0 * perpN
    const dLng = s.halfWidthKm / (111.0 * Math.cos(s.lat * DEG)) * perpE

    left.push([s.lng + dLng, s.lat + dLat])
    right.push([s.lng - dLng, s.lat - dLat])
  }

  return [...left, ...right.slice().reverse(), left[0]]
}

// Compute the ISS track across the solar/lunar disc as seen from (lat, lng, altM).
// Returns an array of {x, y} in disc-radius units — (0,0) = disc center, ±1 = disc edge.
// x = rightward (increasing azimuth), y = upward (increasing altitude).
function transitDiscPath(startTime, endTime, type, lat, lng, altM = 0, sat = DEFAULT_SAT) {
  const body = type === 'solar' ? A.Body.Sun : A.Body.Moon
  const DISC_R = type === 'solar' ? SUN_R : MOON_R
  const dMs = Math.max(endTime - startTime, 1)
  const steps = Math.max(10, Math.round(dMs / 20))
  const heightKm = (altM || 0) / 1000
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = new Date(startTime.getTime() + (i / steps) * dMs)
    const issLook = getIssLookAngles(t, lat, lng, heightKm, sat)
    if (!issLook) continue
    const bodyLook = ecfDirToAltAz(bodyEcefDir(t, body), lat, lng)
    const dAz = ((issLook.az - bodyLook.az + 540) % 360) - 180
    const x = dAz * Math.cos(bodyLook.alt * DEG) / DISC_R
    const y = (issLook.alt - bodyLook.alt) / DISC_R
    pts.push({ x, y })
  }
  return pts
}

// Convert an ECF unit vector to topocentric altitude and azimuth (degrees).
// Uses the observer's geodetic lat/lng to define the local horizontal frame (east-north-up).
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

const SUN_R  = 0.267
const MOON_R = 0.259

// ── Shadow-path transit scanner ───────────────────────────────────────────────
//
// Approach: scan every 5 s (coarse). When the transit shadow falls within 50 km
// of the observer, switch to 50 ms fine scan and check whether the observer lies
// inside the visibility band (shadow ± halfWidth). At 7 km/s shadow speed a 5 s
// step can close at most 35 km, so 50 km trigger guarantees no missed transits.

function observerEcf(lat, lng, altM = 0) {
  return geodeticToEcf({
    latitude:  degreesToRadians(lat),
    longitude: degreesToRadians(lng),
    height:    (altM || 0) / 1000,
  })
}

function shadowToEcf(lngDeg, latDeg) {
  return geodeticToEcf({ latitude: latDeg * DEG, longitude: lngDeg * DEG, height: 0 })
}

function findIssTransits(lat, lng, target, { start = new Date(), hoursAhead = 24 * 30, altM = 0, searchRadiusKm = 300, sat = DEFAULT_SAT } = {}) {
  if (!getSatrecInfo(start, sat).rec || lat == null || lng == null) return []
  if (!isFinite(lat) || !isFinite(lng)) return []

  const body     = target === 'solar' ? A.Body.Sun  : A.Body.Moon
  const DISC_R   = target === 'solar' ? SUN_R       : MOON_R
  const halfAngR = (DISC_R + sat.discRadiusDeg) * DEG

  const obsEcf = observerEcf(lat, lng, altM)
  const latR = lat * DEG, lngR = lng * DEG
  const cosLat = Math.cos(latR), sinLat = Math.sin(latR)
  const upX = cosLat * Math.cos(lngR), upY = cosLat * Math.sin(lngR), upZ = sinLat

  // Find all transits whose shadow centerline passes within searchRadiusKm of
  // the observer (how far you're willing to travel). The visibility band is
  // only ~3-5 km wide, so requiring the observer to be inside the band would
  // miss transits passing nearby; the band renders on the map for judging.
  const SEARCH_RADIUS = Math.max(2, searchRadiusKm)
  const COARSE_MS  = 5_000  // shadow moves ≤ 35 km per coarse step
  const FINE_MS    = 50     // 50 ms fine scan
  const TRIGGER_KM = SEARCH_RADIUS + 50  // switch to fine scan before entering search radius

  const startMs = start.getTime()
  const endMs   = startMs + hoursAhead * 3_600_000

  let ms   = startMs
  let step = COARSE_MS
  let inContact = false, contactStart = null
  let minDist = Infinity, midTime = null, midIssRange = 400, midHalfWidth = 0
  const raw = []

  const flush = (endT) => {
    if (inContact && midTime) {
      raw.push(closeTransit(midTime, minDist, midIssRange, midHalfWidth, DISC_R, target, sat))
    }
    inContact = false; contactStart = null
    minDist = Infinity; midTime = null; midIssRange = 400; midHalfWidth = 0
  }

  while (ms < endMs) {
    const t = new Date(ms)
    const { rec } = getSatrecInfo(t, sat)
    if (!rec) { flush(t); ms += COARSE_MS; step = COARSE_MS; continue }

    const ecf = propagateEcf(t, rec)
    if (!ecf) { ms += step; continue }

    const issUp = (ecf.x - obsEcf.x) * upX + (ecf.y - obsEcf.y) * upY + (ecf.z - obsEcf.z) * upZ
    if (issUp <= 0) { flush(t); ms += COARSE_MS; step = COARSE_MS; continue }

    const bDir = bodyEcefDir(t, body)
    if (bDir.x * upX + bDir.y * upY + bDir.z * upZ <= 0) { flush(t); ms += COARSE_MS; step = COARSE_MS; continue }

    const sh = transitShadowPoint(ecf, bDir)
    if (!sh) { ms += step; continue }

    const shEcf = shadowToEcf(sh[0], sh[1])
    const dx = obsEcf.x - shEcf.x, dy = obsEcf.y - shEcf.y, dz = obsEcf.z - shEcf.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    const rx = ecf.x - shEcf.x, ry = ecf.y - shEcf.y, rz = ecf.z - shEcf.z
    const issRange = Math.sqrt(rx * rx + ry * ry + rz * rz)
    const halfWidth = issRange * Math.sin(halfAngR)

    if (dist < TRIGGER_KM) {
      step = FINE_MS
      if (dist < SEARCH_RADIUS) {
        if (!inContact) { inContact = true; contactStart = t }
        if (dist < minDist) { minDist = dist; midTime = t; midIssRange = issRange; midHalfWidth = halfWidth }
      } else if (inContact) {
        flush(t)
      }
    } else {
      flush(t)
      step = COARSE_MS
    }

    ms += step
  }

  flush(new Date(ms))

  // ±3 s around midTime gives ~46 km of shadow path — matches transit-finder's visible band scale.
  const PATH_HALF_MS = 3_000

  const seen = new Set()
  return raw
    .filter(tr => {
      const key = Math.round(tr.midTime.getTime() / 5000)
      if (seen.has(key)) return false
      seen.add(key); return true
    })
    .map(tr => {
      const pathStart = new Date(tr.midTime.getTime() - PATH_HALF_MS)
      const pathEnd   = new Date(tr.midTime.getTime() + PATH_HALF_MS)
      return {
        ...tr,
        path:     transitShadowPath(pathStart, pathEnd, target, sat),
        band:     transitBandPolygon(pathStart, pathEnd, target, sat),
        discPath: transitDiscPath(pathStart, pathEnd, target, lat, lng, altM, sat),
      }
    })
}

function closeTransit(midTime, minDist, issRange, halfWidth, discR, type, sat) {
  const minSepDeg = Math.asin(Math.min(1, minDist / Math.max(issRange, 1))) / DEG
  const inBand = minDist <= halfWidth
  return {
    type, midTime,
    satId: sat.id, satName: sat.name,
    minSepDeg:    +minSepDeg.toFixed(4),
    minDistKm:    +minDist.toFixed(3),
    discRadiusDeg: discR,
    inBand,  // true when observer is inside the ~3-5 km visibility band
  }
}

export function findIssSolarTransits(lat, lng, options) {
  return findIssTransits(lat, lng, 'solar', options)
}

export function findIssLunarTransits(lat, lng, options) {
  return findIssTransits(lat, lng, 'lunar', options)
}
