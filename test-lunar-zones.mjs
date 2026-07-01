/**
 * Direct test of buildLunarZones with the Sep 7, 2025 eclipse.
 * Tests whether the turf polygon operations hang.
 */

import * as turf from './node_modules/@turf/turf/dist/esm/index.js'

const DEG = Math.PI / 180

// Simplified getSubLunarPoint (from daynight.js)
function getSubLunarPoint(date) {
  const T  = (date.getTime() / 86400000 - 10957.5) / 36525
  const L  = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360
  const Mm = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360
  const Ms = ((357.5291 +  35999.0503 * T) % 360 + 360) % 360
  const D  = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360
  const F  = (( 93.2721 + 483202.0175 * T) % 360 + 360) % 360
  const Mmr = Mm * DEG, Msr = Ms * DEG, Dr = D * DEG, Fr = F * DEG
  const lambda = L
    + 6.289 * Math.sin(Mmr)
    - 1.274 * Math.sin(2 * Dr - Mmr)
    + 0.658 * Math.sin(2 * Dr)
    - 0.186 * Math.sin(Msr)
    - 0.059 * Math.sin(2 * Dr - 2 * Mmr)
    - 0.057 * Math.sin(2 * Dr - Msr + Mmr)
    + 0.053 * Math.sin(2 * Dr + Mmr)
    + 0.046 * Math.sin(2 * Dr - Msr)
    + 0.041 * Math.sin(Mmr - Msr)
    - 0.035 * Math.sin(Dr)
    - 0.031 * Math.sin(Mmr + Msr)
    - 0.015 * Math.sin(2 * Fr - 2 * Dr)
    + 0.011 * Math.sin(2 * Dr - Msr + Mmr)
  const beta =
    + 5.128 * Math.sin(Fr)
    + 0.280 * Math.sin(Mmr + Fr)
    + 0.277 * Math.sin(Mmr - Fr)
    + 0.173 * Math.sin(2 * Dr - Fr)
    + 0.055 * Math.sin(2 * Dr - Mmr + Fr)
    - 0.046 * Math.sin(2 * Dr - Mmr - Fr)
    + 0.033 * Math.sin(2 * Dr + Fr)
    + 0.017 * Math.sin(2 * Mmr + Fr)
  const lamR = lambda * DEG, betR = beta * DEG
  const eps  = (23.439 - 0.0000004 * (T * 36525)) * DEG
  const sinDec = Math.sin(betR) * Math.cos(eps) + Math.cos(betR) * Math.sin(eps) * Math.sin(lamR)
  const dec    = Math.asin(Math.max(-1, Math.min(1, sinDec)))
  const ra     = Math.atan2(
    Math.sin(lamR) * Math.cos(eps) - Math.tan(betR) * Math.sin(eps),
    Math.cos(lamR)
  )
  const D0   = date.getTime() / 86400000 - 10957.5
  const gmst = (6.697375 + 0.0657098242 * D0 +
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) % 24
  const gha  = (gmst * 15 - ra / DEG + 360) % 360
  let moonLng = ((-gha % 360) + 360) % 360
  if (moonLng > 180) moonLng -= 360
  return [moonLng, dec / DEG]
}

const HEMI_KM = 9900

function hemi(lngLat) {
  console.log(`  Creating hemi at [${lngLat[0].toFixed(2)}, ${lngLat[1].toFixed(2)}]`)
  const t0 = performance.now()
  const result = turf.circle(turf.point(lngLat), HEMI_KM, { steps: 72, units: 'kilometers' })
  console.log(`  Hemi created in ${(performance.now()-t0).toFixed(1)}ms, coords=${result.geometry.coordinates[0].length}`)
  return result
}

function safeUnion(a, b, label) {
  console.log(`  safeUnion(${label})...`)
  const t0 = performance.now()
  try {
    const result = turf.union(turf.featureCollection([a, b]))
    console.log(`  union done in ${(performance.now()-t0).toFixed(1)}ms`)
    return result
  } catch(e) {
    console.log(`  union ERROR: ${e.message}`)
    return a
  }
}

function safeIntersect(a, b, label) {
  console.log(`  safeIntersect(${label})...`)
  const t0 = performance.now()
  try {
    const result = turf.intersect(turf.featureCollection([a, b]))
    console.log(`  intersect done in ${(performance.now()-t0).toFixed(1)}ms, result=${result ? 'polygon' : 'null'}`)
    return result
  } catch(e) {
    console.log(`  intersect ERROR: ${e.message}`)
    return null
  }
}

// Sep 7, 2025 total lunar eclipse
// Peak: 18:11 UTC
const peakMs = new Date('2025-09-07T18:11:00Z').getTime()

// Typical contact times for a total lunar eclipse (from computation)
// We'll compute these approximately based on geometry
// For Sep 7 2025: halfPenS ≈ 9300s, halfUmbS ≈ 5400s, halfTotS ≈ 2700s (approximate)

// Let's compute the actual sub-lunar positions at contact times
const halfPenS = 9300   // ~2.58 hours penumbral semi-duration
const halfUmbS = 5400   // ~1.5 hours umbral semi-duration
const halfTotS = 2700   // ~45 min total semi-duration

console.log('Sep 7, 2025 total lunar eclipse test')
console.log(`Peak: ${new Date(peakMs).toISOString()}`)
console.log(`halfPenS=${halfPenS}s, halfUmbS=${halfUmbS}s, halfTotS=${halfTotS}s`)

function slp(offsetS) {
  const [lng, lat] = getSubLunarPoint(new Date(peakMs + offsetS * 1000))
  return [lng, lat]
}

const P1pos = slp(-halfPenS)
const P4pos = slp(+halfPenS)
const U1pos = slp(-halfUmbS)
const U4pos = slp(+halfUmbS)
const U2pos = slp(-halfTotS)
const U3pos = slp(+halfTotS)

console.log(`P1 sub-lunar: ${P1pos.map(v=>v.toFixed(2))} (${halfPenS/3600}h before peak)`)
console.log(`P4 sub-lunar: ${P4pos.map(v=>v.toFixed(2))} (${halfPenS/3600}h after peak)`)
console.log(`U1 sub-lunar: ${U1pos.map(v=>v.toFixed(2))} (${halfUmbS/3600}h before peak)`)
console.log(`U4 sub-lunar: ${U4pos.map(v=>v.toFixed(2))} (${halfUmbS/3600}h after peak)`)
console.log(`U2 sub-lunar: ${U2pos.map(v=>v.toFixed(2))} (${halfTotS/3600}h before peak)`)
console.log(`U3 sub-lunar: ${U3pos.map(v=>v.toFixed(2))} (${halfTotS/3600}h after peak)`)

const totalT0 = performance.now()

console.log('\n--- Building hemispherical polygons ---')
const HP1 = hemi(P1pos)
const HP4 = hemi(P4pos)

console.log('\n--- somePen (union of P1 and P4 hemispheres) ---')
const somePen = safeUnion(HP1, HP4, 'HP1 ∪ HP4')

console.log('\n--- entireEcl (intersection of P1 and P4 hemispheres) ---')
const entireEcl = safeIntersect(HP1, HP4, 'HP1 ∩ HP4')

console.log('\n--- Building umbral polygons ---')
const HU1 = hemi(U1pos)
const HU4 = hemi(U4pos)

console.log('\n--- somePart (union of U1 and U4 hemispheres) ---')
const somePart = safeUnion(HU1, HU4, 'HU1 ∪ HU4')

console.log('\n--- entirePart (intersection of U1 and U4 hemispheres) ---')
const entirePart = safeIntersect(HU1, HU4, 'HU1 ∩ HU4')

console.log('\n--- Building totality polygons ---')
const HU2 = hemi(U2pos)
const HU3 = hemi(U3pos)

console.log('\n--- someTot (union of U2 and U3 hemispheres) ---')
const someTot = safeUnion(HU2, HU3, 'HU2 ∪ HU3')

console.log('\n--- entireTot (intersection of U2 and U3 hemispheres) ---')
const entireTot = safeIntersect(HU2, HU3, 'HU2 ∩ HU3')

console.log(`\nTotal buildLunarZones time: ${(performance.now()-totalT0).toFixed(0)}ms`)
console.log('Done.')
