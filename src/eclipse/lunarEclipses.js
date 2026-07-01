// Compute lunar eclipse catalog using Meeus "Astronomical Algorithms" Ch. 47 + 54.
// Accurate to ~1-2 min for eclipse times, ~0.01 for magnitude.
import { getSubLunarPoint } from './daynight'

const DEG = Math.PI / 180

// Shadow geometry at Moon's mean distance (degrees of arc)
const INCL      = 5.128   // Moon's orbital inclination
const UMBRA_R   = 0.7300  // Earth's umbra radius
const MOON_R    = 0.2590  // Moon's angular radius
const PEN_R     = 1.2800  // Earth's penumbra radius
const SPEED     = 0.5075  // Moon's speed through shadow (°/hour)

const TOTAL_LIM = UMBRA_R - MOON_R   // 0.471° — all of Moon inside umbra
const UM_LIM    = UMBRA_R + MOON_R   // 0.989° — any of Moon touches umbra
const PEN_LIM   = PEN_R   + MOON_R   // 1.539° — any of Moon touches penumbra

function jdToDate(jd) {
  return new Date((jd - 2440587.5) * 86400000)
}

// JDE of the k-th full moon.  k must already be offset by +0.5 from the new-moon index.
// Meeus Table 47.a (full-moon corrections).
function fullMoonJDE(k) {
  const T = k / 1236.85
  let JDE = 2451550.09766
    + 29.530588861 * k
    + 0.00015437   * T * T
    - 1.50e-7      * T * T * T

  const E  = 1 - 0.002516 * T - 0.0000074 * T * T
  const M  = ((2.5534   + 29.1053567  * k) % 360) * DEG  // Sun anomaly
  const Mp = ((201.5643 + 385.8169385 * k) % 360) * DEG  // Moon anomaly
  const F  = ((160.7108 + 390.6702560 * k) % 360) * DEG  // arg of lat
  const Om = ((124.7746 -  1.5637558  * k) % 360) * DEG  // ascending node

  JDE += -0.40614 * Math.sin(Mp)
       + 0.17302 * E  * Math.sin(M)
       + 0.01614 * Math.sin(2 * Mp)
       + 0.01043 * Math.sin(2 * F)
       + 0.00734 * E  * Math.sin(Mp - M)
       - 0.00515 * E  * Math.sin(Mp + M)
       + 0.00209 * E * E * Math.sin(2 * M)
       - 0.00111 * Math.sin(Mp - 2 * F)
       - 0.00057 * Math.sin(Mp + 2 * F)
       + 0.00056 * E  * Math.sin(2 * Mp + M)
       - 0.00042 * Math.sin(3 * Mp)
       + 0.00042 * E  * Math.sin(M + 2 * F)
       + 0.00038 * E  * Math.sin(M - 2 * F)
       - 0.00024 * E  * Math.sin(2 * Mp - M)
       - 0.00017 * Math.sin(Om)
  return JDE
}

function fmtDate(d) {
  const y   = d.getUTCFullYear()
  const mm  = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd  = String(d.getUTCDate()).padStart(2, '0')
  const abs = String(Math.abs(y)).padStart(4, '0')
  return y < 0 ? `-${abs}-${mm}-${dd}` : `${abs}-${mm}-${dd}`
}

function fmtTime(d) {
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':')
}

// Return a lunar eclipse object for full-moon index k, or null if no eclipse.
function checkEclipse(k) {
  // Quick rejection on un-corrected F
  const Fq = ((160.7108 + 390.6702560 * k) % 360 + 360) % 360
  if (Math.abs(INCL * Math.sin(Fq * DEG)) > PEN_LIM + 0.15) return null

  // Compute corrected JDE and Moon latitude
  const T  = k / 1236.85
  const Om = ((124.7746 - 1.5637558 * k) % 360 + 360) % 360
  // Node correction to F (Meeus §47)
  const Fc = ((160.7108 + 390.6702560 * k - 0.0168 * Math.cos(Om * DEG) * 0) % 360 + 360) % 360
  // β = Moon's ecliptic latitude at full moon (degrees), leading term
  const beta    = INCL * Math.sin(Fc * DEG)
  const absBeta = Math.abs(beta)

  if (absBeta > PEN_LIM) return null

  let type, mag, durationS = 0

  if (absBeta < TOTAL_LIM) {
    type = 'T'
    mag  = (UMBRA_R + MOON_R - absBeta) / (2 * MOON_R)   // > 1.0
    const half = Math.sqrt(Math.max(0, TOTAL_LIM * TOTAL_LIM - absBeta * absBeta))
    durationS = Math.round(2 * half / SPEED * 3600)
  } else if (absBeta < UM_LIM) {
    type = 'P'
    mag  = (UMBRA_R + MOON_R - absBeta) / (2 * MOON_R)   // 0–1
  } else {
    type = 'N'
    mag  = (PEN_R + MOON_R - absBeta) / (2 * MOON_R)     // 0–1
  }

  // Half-durations to each contact (seconds from peak)
  const halfPenS  = Math.round(Math.sqrt(Math.max(0, PEN_LIM  * PEN_LIM  - absBeta * absBeta)) / SPEED * 3600)
  const halfUmbS  = absBeta < UM_LIM    ? Math.round(Math.sqrt(UM_LIM    * UM_LIM    - absBeta * absBeta) / SPEED * 3600) : 0
  const halfTotS  = absBeta < TOTAL_LIM ? Math.round(Math.sqrt(TOTAL_LIM * TOTAL_LIM - absBeta * absBeta) / SPEED * 3600) : 0

  const JDE  = fullMoonJDE(k)
  const date = jdToDate(JDE)
  const yr   = date.getUTCFullYear()

  const [lng, lat] = getSubLunarPoint(date)

  return {
    kind:      'lunar',
    type,
    mag:       +Math.max(0, mag).toFixed(3),
    durationS,
    gamma:     +beta.toFixed(3),
    greatest:  [+lng.toFixed(2), +lat.toFixed(2)],
    date:      fmtDate(date),
    time:      fmtTime(date),
    // fields expected by existing code (nulled for lunar)
    saros:      null,
    centerLine: null,
    widthKm:    null,
    pathDurationS: null,
    peakFrac:   0.5,
    hybridTransitions: null,
    contacts:   { halfPenS, halfUmbS, halfTotS },
    _yr: yr,
  }
}

// Public: compute all lunar eclipses in [startYear, endYear].
// Lunar cat IDs start at catOffset (default 50000) to never collide with solar IDs.
export function computeLunarEclipses(startYear, endYear, catOffset = 50000) {
  const results = []
  // n + 0.5 = full-moon index k; iterate integer n
  const n0 = Math.floor((startYear - 2000) * 12.3685) - 2
  const n1 = Math.ceil( (endYear   - 2000) * 12.3685) + 2

  let cat = catOffset
  for (let n = n0; n <= n1; n++) {
    const eclipse = checkEclipse(n + 0.5)
    if (!eclipse) continue
    if (eclipse._yr < startYear || eclipse._yr > endYear) continue
    delete eclipse._yr
    results.push({ ...eclipse, cat: cat++ })
  }
  return results
}
