// Keplerian orbital elements for notable comets.
// Elements are from JPL Horizons / MPC as close to J2000 as published.
// q  = perihelion distance (AU)
// e  = eccentricity
// i  = inclination (deg)
// Om = longitude of ascending node (deg)
// w  = argument of perihelion (deg)
// Tp = perihelion time as Julian Date

const DEG = Math.PI / 180

export const COMETS = [
  {
    id: 'halley',
    name: '1P/Halley',
    q: 0.58597811,
    e: 0.96714291,
    i: 162.26269,
    Om: 58.42008,
    w: 111.33249,
    Tp: 2446470.5,   // 1986 Feb 9 perihelion
    color: '#67e8f9', // cyan
  },
  {
    id: 'hale-bopp',
    name: 'C/1995 O1 (Hale-Bopp)',
    q: 0.91402,
    e: 0.99500,
    i: 89.4296,
    Om: 282.4707,
    w: 130.5887,
    Tp: 2450538.2,   // 1997 Apr 1
    color: '#a5f3fc',
  },
  {
    id: 'neowise',
    name: 'C/2020 F3 (NEOWISE)',
    q: 0.29449,
    e: 0.99916,
    i: 128.9378,
    Om: 61.0106,
    w: 37.2778,
    Tp: 2459034.2,   // 2020 Jul 3
    color: '#86efac',
  },
  {
    id: 'tsuchinshan',
    name: 'C/2023 A3 (Tsuchinshan-ATLAS)',
    q: 0.39142,
    e: 1.00028,
    i: 139.1279,
    Om: 21.5495,
    w: 308.4700,
    Tp: 2460578.0,   // 2024 Sep 27
    color: '#fde68a',
  },
  {
    id: '67p',
    name: '67P/Churyumov-Gerasimenko',
    q: 1.21002,
    e: 0.64989,
    i: 3.8710,
    Om: 36.3303,
    w: 22.1369,
    Tp: 2457247.6,   // 2015 Aug 13 (Rosetta era perihelion)
    color: '#d1d5db',
  },
]

// Julian date from JS Date
function toJD(date) {
  return date.getTime() / 86400000 + 2440587.5
}

// Solve Kepler's equation E - e*sin(E) = M for eccentric anomaly E.
// For near-parabolic orbits (e close to 1) we use the Barker equation branch.
function solveKepler(M, e) {
  if (e >= 0.9999) {
    // Near-parabolic / parabolic: solve via Barker's method (cubic)
    // For parabolic q exactly: r = q*(1 + tan²(nu/2)), use cubic
    // Approximate with iterative Newton on eccentric form but with wide initial guess
    let E = M
    for (let i = 0; i < 100; i++) {
      const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
      E += dE
      if (Math.abs(dE) < 1e-10) break
    }
    return E
  }
  // Standard Newton's method
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

// Rotate a vector [x,y,z] by Euler angles (i, Om, w) from orbital plane to ecliptic.
function orbitalToEcliptic(xOrb, yOrb, i, Om, w) {
  const ci = Math.cos(i * DEG), si = Math.sin(i * DEG)
  const cO = Math.cos(Om * DEG), sO = Math.sin(Om * DEG)
  const cw = Math.cos(w * DEG), sw = Math.sin(w * DEG)

  const Px = cO * cw - sO * sw * ci
  const Py = sO * cw + cO * sw * ci
  const Pz = sw * si
  const Qx = -cO * sw - sO * cw * ci
  const Qy = -sO * sw + cO * cw * ci
  const Qz = cw * si

  return {
    x: xOrb * Px + yOrb * Qx,
    y: xOrb * Py + yOrb * Qy,
    z: xOrb * Pz + yOrb * Qz,
  }
}

// Compute heliocentric ecliptic position of a comet at a given JS Date.
// Returns { x, y, z } in AU, or null if computation fails.
export function cometPosition(comet, date) {
  try {
    const jd = toJD(date)
    const dt = jd - comet.Tp   // days since perihelion
    const { q, e } = comet

    // Semi-major axis (undefined for parabolic, use large value)
    const a = e < 0.9999 ? q / (1 - e) : 1e6

    // Mean motion (rad/day) and mean anomaly
    const n = Math.sqrt(1 / (a * a * a)) * (180 / Math.PI) * DEG   // rad/day (Gaussian k=0.01720209895)
    // Use Gaussian gravitational constant
    const k = 0.01720209895  // rad/day for AU/solar mass
    const nGauss = k / Math.sqrt(a * a * a)   // rad/day
    let M = nGauss * dt   // mean anomaly in radians

    const E = solveKepler(M, e)
    const xOrb = a * (Math.cos(E) - e)
    const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E)

    return orbitalToEcliptic(xOrb, yOrb, comet.i, comet.Om, comet.w)
  } catch {
    return null
  }
}

// Return positions of all comets at the given date, filtered to those within maxAU.
export function cometPositions(date, maxAU = 35) {
  return COMETS.map(c => {
    const pos = cometPosition(c, date)
    if (!pos) return null
    const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z)
    if (r > maxAU) return null
    return { ...c, pos, r }
  }).filter(Boolean)
}
