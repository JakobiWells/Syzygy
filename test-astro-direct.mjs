/**
 * Direct Node.js test of bodyPos computation near the Sep 7, 2025 sub-lunar point.
 * Runs without a browser to isolate JavaScript computation from WebGL overhead.
 */

import * as A from './node_modules/astronomy-engine/astronomy.js'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// Sep 7, 2025 total lunar eclipse peak: 18:11 UTC
const eclipseDate = new Date('2025-09-07T18:11:00Z')
console.log('Eclipse date:', eclipseDate.toISOString())

// Sub-lunar point (approximate)
const SUB_LUNAR_LAT = -6.01
const SUB_LUNAR_LNG = 86.86

function bodyPos(body, date, latDeg, lngDeg) {
  console.log(`  bodyPos(${body}, ${latDeg?.toFixed(4)}, ${lngDeg?.toFixed(4)})`)
  const t0 = performance.now()

  const obs = new A.Observer(latDeg, lngDeg, 0)
  const t1 = performance.now()
  console.log(`    Observer: ${(t1-t0).toFixed(2)}ms`)

  const eq = A.Equator(body, date, obs, true, true)
  const t2 = performance.now()
  console.log(`    Equator: ${(t2-t1).toFixed(2)}ms, ra=${eq.ra?.toFixed(4)}, dec=${eq.dec?.toFixed(4)}`)

  const h = A.Horizon(date, obs, eq.ra, eq.dec, 'normal')
  const t3 = performance.now()
  console.log(`    Horizon: ${(t3-t2).toFixed(2)}ms, alt=${h.altitude?.toFixed(4)}, az=${h.azimuth?.toFixed(4)}`)

  if (!isFinite(h.altitude)) {
    console.log(`    WARN: altitude is not finite: ${h.altitude}`)
    return null
  }

  const safeAlt = Math.min(89.9999, Math.max(-89.9999, h.altitude))
  console.log(`    safeAlt=${safeAlt.toFixed(6)}`)

  const t4 = performance.now()

  // Test InverseRefraction convergence manually
  let altitude = safeAlt - A.Refraction('normal', safeAlt)
  let iterations = 0
  const MAX_ITER = 100
  for (let i = 0; i < MAX_ITER; i++) {
    const diff = safeAlt - A.Refraction('normal', altitude) - altitude
    iterations++
    if (Math.abs(diff) < 1.0e-14) break
    altitude += diff
    if (!isFinite(altitude)) {
      console.log(`    InverseRefraction: NaN/Inf at iteration ${i}!`)
      break
    }
  }
  console.log(`    InverseRefraction: ${iterations} iterations, converged=${iterations < MAX_ITER}`)

  const altGeometric = safeAlt + A.InverseRefraction('normal', safeAlt)
  const t5 = performance.now()
  console.log(`    InverseRefraction total: ${(t5-t4).toFixed(2)}ms, altGeometric=${altGeometric?.toFixed(6)}`)

  return { alt: safeAlt, altGeometric, az: h.azimuth }
}

function testLocation(lat, lng, label) {
  console.log(`\n=== ${label} (lat=${lat}, lng=${lng}) ===`)
  const t0 = performance.now()
  const moon = bodyPos('Moon', eclipseDate, lat, lng)
  const sun  = bodyPos('Sun',  eclipseDate, lat, lng)
  const total = performance.now() - t0
  console.log(`  Total: ${total.toFixed(1)}ms`)
  if (moon && sun) {
    console.log(`  Moon alt=${moon.alt.toFixed(3)}, Sun alt=${sun.alt.toFixed(3)}, separation≈${(180 - moon.alt - sun.alt).toFixed(1)}°`)
  }
}

// Test locations: sub-lunar point and concentric rings
testLocation(SUB_LUNAR_LAT, SUB_LUNAR_LNG, 'Sub-lunar point (exact)')
testLocation(-6, 87, '~0 km from sub-lunar')
testLocation(-6, 78, '~1000 km W')
testLocation(-6, 97, '~1000 km E')
testLocation(3,  87, '~1000 km N')
testLocation(-15, 87, '~1000 km S')
testLocation(-6, 74, '~1300 km W')
testLocation(-6, 100, '~1300 km E')
testLocation(8,  87, '~1550 km N (outside crash zone)')
testLocation(-20, 87, '~1550 km S (outside crash zone)')
testLocation(0, 0, 'Control: Africa (far from sub-lunar)')

// Also test A.Illumination for Moon
console.log('\n=== Moon Illumination at eclipse peak ===')
try {
  const t0 = performance.now()
  const illum = A.Illumination('Moon', eclipseDate)
  console.log(`Illumination: ${(performance.now()-t0).toFixed(2)}ms, phase_fraction=${illum.phase_fraction?.toFixed(4)}`)
} catch (e) {
  console.log('Illumination error:', e)
}

console.log('\n=== Done ===')
