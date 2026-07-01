/**
 * Astronomical position engine — backed by astronomy-engine (MIT)
 * which implements the full VSOP87 (Sun) and ELP-2000/82 (Moon) series.
 *
 * Accuracy: Sun ~0.001°, Moon ~0.001°, contact times within a few seconds.
 * Topocentric parallax and atmospheric refraction are applied automatically.
 */

import * as A from 'astronomy-engine'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// ── Utilities ──────────────────────────────────────────────────────────────────

/** Julian Day (UTC) — kept for any callers that import it directly. */
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5
}

// ── Internal body position helper ──────────────────────────────────────────────

const FALLBACK_POS = {
  alt: 0, altGeometric: 0, az: 0, ra: 0, dec: 0,
  distAU: 1, distKm: 149597870.7, angularRadius: 0.267,
}

function bodyPos(body, date, latDeg, lngDeg) {
  try {
    const obs = new A.Observer(latDeg, lngDeg, 0)
    // topocentric=true, ofdate=true → best apparent position with full parallax
    const eq = A.Equator(body, date, obs, true, true)
    const h  = A.Horizon(date, obs, eq.ra, eq.dec, 'normal')

    // Geometric (pre-refraction) altitude via inverse refraction.
    //
    // A.InverseRefraction uses for(;;) with no iteration cap. It converges
    // within 3–4 iterations for all altitudes we actually pass, but any NaN
    // input causes the loop to never exit (NaN comparisons are always false).
    //
    // We guard against NaN, then use our own iteration-capped reimplementation
    // of InverseRefraction. A.Refraction (the forward formula) is a direct
    // expression with no loop, so it is safe to call inside our bounded loop.
    // 50 iterations is vastly more than required; it exists purely as a safety
    // net against any unforeseen edge case.
    const safeAlt = isFinite(h.altitude) ? Math.min(89.0, Math.max(-89.9999, h.altitude)) : 0
    let altGeometric = safeAlt
    {
      // Inline InverseRefraction with iteration cap — mirrors astronomy-engine
      // logic but guarantees termination.
      let x = safeAlt
      for (let _i = 0; _i < 50; _i++) {
        const diff = (x + A.Refraction('normal', x)) - safeAlt
        if (Math.abs(diff) < 1e-10) { x -= diff; break }
        x -= diff
      }
      altGeometric = x
    }

    // Azimuth is mathematically undefined at the zenith (cos(alt) = 0 → 0/0).
    // astronomy-engine returns NaN for azimuth when the body is exactly overhead;
    // fall back to 0° so downstream azimuth arithmetic stays finite.
    const az = isFinite(h.azimuth) ? h.azimuth : 0

    const distKm       = eq.dist * 149597870.7                    // AU → km
    const radiusKm     = body === 'Sun' ? 696000 : 1737.4
    const angularRadius = Math.atan(radiusKm / distKm) * R2D

    return {
      alt:          safeAlt,
      altGeometric,
      az,
      ra:           eq.ra,
      dec:          eq.dec,
      distAU:       eq.dist,
      distKm,
      angularRadius,
    }
  } catch (e) {
    console.warn(`[astroEngine] bodyPos(${body}) failed for date ${date}:`, e)
    return { ...FALLBACK_POS }
  }
}

// ── Per-frame result cache ────────────────────────────────────────────────────
// React 18 batches all renders triggered by a single state update into one
// synchronous pass. Many components call getSunPosition / getMoonPosition /
// getMoonSunOffset with the same (time, lat, lng) in that pass. Caching the
// last call avoids redundant VSOP87/ELP evaluations and prevents hangs on
// slower hardware where each call costs 1–2 ms.

let _sunCache  = null   // { t, lat, lng, result }
let _moonCache = null
let _offsetCache = null

// ── Public API ─────────────────────────────────────────────────────────────────

export function getSunPosition(date, latDeg, lngDeg) {
  const t = date?.getTime?.() ?? 0
  if (_sunCache && _sunCache.t === t && _sunCache.lat === latDeg && _sunCache.lng === lngDeg)
    return _sunCache.result
  const result = bodyPos('Sun', date, latDeg, lngDeg)
  _sunCache = { t, lat: latDeg, lng: lngDeg, result }
  return result
}

export function getMoonPosition(date, latDeg, lngDeg) {
  const t = date?.getTime?.() ?? 0
  if (_moonCache && _moonCache.t === t && _moonCache.lat === latDeg && _moonCache.lng === lngDeg)
    return _moonCache.result
  const pos = bodyPos('Moon', date, latDeg, lngDeg)
  let result
  try {
    const illum = A.Illumination('Moon', date)
    result = { ...pos, phase: illum.phase_fraction }
  } catch (e) {
    console.warn('[astroEngine] Illumination failed:', e)
    result = { ...pos, phase: 0 }
  }
  _moonCache = { t, lat: latDeg, lng: lngDeg, result }
  return result
}

export function getMoonSunOffset(date, latDeg, lngDeg) {
  const ts = date?.getTime?.() ?? 0
  if (_offsetCache && _offsetCache.ts === ts && _offsetCache.lat === latDeg && _offsetCache.lng === lngDeg)
    return _offsetCache.result

  const sun  = getSunPosition(date, latDeg, lngDeg)
  const moon = getMoonPosition(date, latDeg, lngDeg)

  function toVec(altDeg, azDeg) {
    const a = D2R * altDeg, z = D2R * azDeg
    return [
      Math.cos(a) * Math.sin(z),
      Math.cos(a) * Math.cos(z),
      Math.sin(a),
    ]
  }

  const S = toVec(sun.altGeometric,  sun.az)
  const M = toVec(moon.altGeometric, moon.az)

  const dot = Math.max(-1, Math.min(1, S[0]*M[0] + S[1]*M[1] + S[2]*M[2]))
  const sep = Math.acos(dot) * R2D

  const cosAlt = Math.cos(D2R * sun.altGeometric)
  let eHat, nHat
  if (cosAlt > 0.01) {
    eHat = [-S[1] / cosAlt, S[0] / cosAlt, 0]
    nHat = [
      S[1]*eHat[2] - S[2]*eHat[1],
      S[2]*eHat[0] - S[0]*eHat[2],
      S[0]*eHat[1] - S[1]*eHat[0],
    ]
  } else {
    eHat = [1, 0, 0]
    nHat = [0, 1, 0]
  }

  const tv = [M[0] - dot*S[0], M[1] - dot*S[1], M[2] - dot*S[2]]
  const dEast  = (tv[0]*eHat[0] + tv[1]*eHat[1] + tv[2]*eHat[2]) * R2D
  const dNorth = (tv[0]*nHat[0] + tv[1]*nHat[1] + tv[2]*nHat[2]) * R2D

  const result = { dEast, dNorth, sep, sun, moon }
  _offsetCache = { ts, lat: latDeg, lng: lngDeg, result }
  return result
}

/**
 * For each center-line coordinate, compute the UTC millisecond at which the
 * Moon-Sun angular separation (topocentric) is minimised at that location.
 * This corrects the catalog's equal-time-spacing assumption, which drifts
 * by up to ~90 s across the path.
 *
 * @param coords       - array of [lon, lat] center-line points
 * @param roughTimes   - array of rough UTC ms for each point (catalog estimate)
 * @returns            - array of corrected UTC ms, same length as coords
 */
export function computeAnimationTimestamps(coords, roughTimes) {
  const PHI = (1 + Math.sqrt(5)) / 2

  function moonSunSep(date, obs) {
    const sunEq  = A.Equator('Sun',  date, obs, true, true)
    const moonEq = A.Equator('Moon', date, obs, true, true)
    const dRa    = (sunEq.ra  - moonEq.ra)  * D2R
    const dDec   = (sunEq.dec - moonEq.dec) * D2R
    const a = Math.sin(dDec / 2) ** 2
            + Math.cos(moonEq.dec * D2R) * Math.cos(sunEq.dec * D2R) * Math.sin(dRa / 2) ** 2
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R2D
  }

  const t0 = performance.now()
  const result = coords.map(([lon, lat], i) => {
    const obs = new A.Observer(lat, lon, 0)
    const rough = roughTimes[i]
    const window = 1800000  // ±30 min search window — handles catalog peakFrac errors up to ~21 min (2024)

    let lo = rough - window, hi = rough + window
    for (let k = 0; k < 40; k++) {
      const m1 = hi - (hi - lo) / PHI
      const m2 = lo + (hi - lo) / PHI
      if (moonSunSep(new Date(m1), obs) < moonSunSep(new Date(m2), obs)) hi = m2
      else lo = m1
    }
    return (lo + hi) / 2
  })
  console.debug(`[timestamps] ${coords.length} pts ${(performance.now() - t0).toFixed(0)} ms`)
  return result
}

/**
 * Sample body position every stepMin over the UTC day containing `date`.
 * Returns array of { alt, az, altGeometric, t }.
 * body: 'sun' | 'moon'
 */
export function buildDayArcAccurate(date, latDeg, lngDeg, body, stepMin = 10) {
  const t0 = performance.now()
  const dayStart = new Date(date)
  dayStart.setUTCHours(0, 0, 0, 0)
  const count = Math.floor(1440 / stepMin) + 1
  const fn    = body === 'sun' ? getSunPosition : getMoonPosition
  const result = Array.from({ length: count }, (_, i) => {
    const t = new Date(dayStart.getTime() + i * stepMin * 60000)
    return { ...fn(t, latDeg, lngDeg), t }
  })
  console.debug(`[arc] ${body} ${count} pts ${(performance.now() - t0).toFixed(0)} ms`)
  return result
}
