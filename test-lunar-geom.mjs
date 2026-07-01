/**
 * Inspect the geometry of buildLunarZones output to see if antimeridian crossing
 * or other geometric issues could cause Mapbox to hang.
 */

import * as turf from './node_modules/@turf/turf/dist/esm/index.js'

const DEG = Math.PI / 180

function getSubLunarPoint(date) {
  const T  = (date.getTime() / 86400000 - 10957.5) / 36525
  const L  = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360
  const Mm = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360
  const Ms = ((357.5291 +  35999.0503 * T) % 360 + 360) % 360
  const D  = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360
  const F  = (( 93.2721 + 483202.0175 * T) % 360 + 360) % 360
  const Mmr = Mm * DEG, Msr = Ms * DEG, Dr = D * DEG, Fr = F * DEG
  const lambda = L
    + 6.289 * Math.sin(Mmr) - 1.274 * Math.sin(2 * Dr - Mmr)
    + 0.658 * Math.sin(2 * Dr) - 0.186 * Math.sin(Msr)
    - 0.059 * Math.sin(2 * Dr - 2 * Mmr) - 0.057 * Math.sin(2 * Dr - Msr + Mmr)
    + 0.053 * Math.sin(2 * Dr + Mmr) + 0.046 * Math.sin(2 * Dr - Msr)
    + 0.041 * Math.sin(Mmr - Msr) - 0.035 * Math.sin(Dr)
    - 0.031 * Math.sin(Mmr + Msr) - 0.015 * Math.sin(2 * Fr - 2 * Dr)
    + 0.011 * Math.sin(2 * Dr - Msr + Mmr)
  const beta = 5.128 * Math.sin(Fr) + 0.280 * Math.sin(Mmr + Fr)
    + 0.277 * Math.sin(Mmr - Fr) + 0.173 * Math.sin(2 * Dr - Fr)
    + 0.055 * Math.sin(2 * Dr - Mmr + Fr) - 0.046 * Math.sin(2 * Dr - Mmr - Fr)
    + 0.033 * Math.sin(2 * Dr + Fr) + 0.017 * Math.sin(2 * Mmr + Fr)
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

function analyzeGeom(feature, label) {
  if (!feature) { console.log(`  ${label}: null`); return }
  const geom = feature.geometry
  const type = geom.type

  let allCoords = []
  if (type === 'Polygon') {
    allCoords = geom.coordinates.flat()
  } else if (type === 'MultiPolygon') {
    allCoords = geom.coordinates.flat(2)
  }

  const lngs = allCoords.map(c => c[0])
  const lats = allCoords.map(c => c[1])
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)

  const hasNaN = allCoords.some(c => !isFinite(c[0]) || !isFinite(c[1]))
  const crossesAntimeridian = maxLng - minLng > 180

  console.log(`  ${label} (${type}):`)
  console.log(`    coords: ${allCoords.length}, rings: ${type === 'Polygon' ? geom.coordinates.length : geom.coordinates.flat().length}`)
  console.log(`    lng: [${minLng.toFixed(1)}, ${maxLng.toFixed(1)}], lat: [${minLat.toFixed(1)}, ${maxLat.toFixed(1)}]`)
  console.log(`    hasNaN: ${hasNaN}, crossesAntimeridian: ${crossesAntimeridian}`)
  console.log(`    span: ${(maxLng-minLng).toFixed(1)}° lng, ${(maxLat-minLat).toFixed(1)}° lat`)
}

const peakMs = new Date('2025-09-07T18:11:00Z').getTime()
const halfPenS = 9300, halfUmbS = 5400, halfTotS = 2700

function slp(offsetS) {
  return getSubLunarPoint(new Date(peakMs + offsetS * 1000))
}

const P1pos = slp(-halfPenS), P4pos = slp(+halfPenS)
const U1pos = slp(-halfUmbS), U4pos = slp(+halfUmbS)
const U2pos = slp(-halfTotS), U3pos = slp(+halfTotS)

console.log('Building polygons...')
const HP1 = turf.circle(turf.point(P1pos), 9900, { steps: 72, units: 'kilometers' })
const HP4 = turf.circle(turf.point(P4pos), 9900, { steps: 72, units: 'kilometers' })
const HU1 = turf.circle(turf.point(U1pos), 9900, { steps: 72, units: 'kilometers' })
const HU4 = turf.circle(turf.point(U4pos), 9900, { steps: 72, units: 'kilometers' })
const HU2 = turf.circle(turf.point(U2pos), 9900, { steps: 72, units: 'kilometers' })
const HU3 = turf.circle(turf.point(U3pos), 9900, { steps: 72, units: 'kilometers' })

console.log('\nInput hemispheres:')
analyzeGeom(HP1, `HP1 at ${P1pos.map(v=>v.toFixed(1))}`)
analyzeGeom(HP4, `HP4 at ${P4pos.map(v=>v.toFixed(1))}`)
analyzeGeom(HU1, `HU1 at ${U1pos.map(v=>v.toFixed(1))}`)
analyzeGeom(HU4, `HU4 at ${U4pos.map(v=>v.toFixed(1))}`)
analyzeGeom(HU2, `HU2 at ${U2pos.map(v=>v.toFixed(1))}`)
analyzeGeom(HU3, `HU3 at ${U3pos.map(v=>v.toFixed(1))}`)

console.log('\nComputing zones...')

const somePen = (() => { try { return turf.union(turf.featureCollection([HP1, HP4])) } catch { return HP1 } })()
const entireEcl = (() => { try { return turf.intersect(turf.featureCollection([HP1, HP4])) } catch { return null } })()
const somePart = (() => { try { return turf.union(turf.featureCollection([HU1, HU4])) } catch { return HU1 } })()
const entirePart = (() => { try { return turf.intersect(turf.featureCollection([HU1, HU4])) } catch { return null } })()
const someTot = (() => { try { return turf.union(turf.featureCollection([HU2, HU3])) } catch { return HU2 } })()
const entireTot = (() => { try { return turf.intersect(turf.featureCollection([HU2, HU3])) } catch { return null } })()

console.log('\nOutput zones geometry:')
analyzeGeom(somePen,    'somePen')
analyzeGeom(entireEcl,  'entireEcl')
analyzeGeom(somePart,   'somePart')
analyzeGeom(entirePart, 'entirePart')
analyzeGeom(someTot,    'someTot')
analyzeGeom(entireTot,  'entireTot')
