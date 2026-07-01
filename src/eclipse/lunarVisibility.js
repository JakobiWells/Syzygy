import * as turf from '@turf/turf'
import { getSubLunarPoint } from './daynight'

// 83° great-circle radius — large enough to cover near-entire visibility hemisphere
// while avoiding the turf.circle antimeridian-crossing bug that produces degenerate
// polygon coordinates (> 180° or < -180°) and can hang polygon-clipping.
const HEMI_KM = 9200

// 32 steps gives smooth-enough circles at ~11° angular resolution while keeping
// turf.union/intersect fast (~4× faster than 72 steps for these large polygons).
const HEMI_STEPS = 32

function hemi(lngLat) {
  return turf.circle(turf.point(lngLat), HEMI_KM, { steps: HEMI_STEPS, units: 'kilometers' })
}

function safeUnion(a, b) {
  try { return turf.union(turf.featureCollection([a, b])) } catch { return a }
}

function safeIntersect(a, b) {
  try { return turf.intersect(turf.featureCollection([a, b])) } catch { return null }
}

function yield_() {
  return new Promise(r => setTimeout(r, 0))
}

// Returns a Promise that resolves to visibility zone GeoJSON features for a lunar eclipse.
// Each zone key maps to a Feature<Polygon|MultiPolygon> or null.
//   somePen    — any part of penumbral phase visible
//   somePart   — any part of partial (umbral) phase visible
//   someTot    — any part of total phase visible
//   entireTot  — entire total phase visible
//   entirePart — entire partial phase visible
//   entireEcl  — entire eclipse (P1→P4) visible
//
// Boundaries are derived by intersecting/unioning the "Moon-above-horizon"
// hemisphere at each contact time (P1, U1, U2/U3, U4, P4).
//
// Each turf operation is preceded by a yield to keep the browser responsive.
// Even so, each individual union/intersect call may block for ~100-400 ms;
// for a truly non-blocking implementation, move this to a Web Worker.
export async function buildLunarZones(eclipse) {
  if (!eclipse || eclipse.kind !== 'lunar' || !eclipse.contacts || !eclipse.time) return null

  const { halfPenS, halfUmbS, halfTotS } = eclipse.contacts
  if (!halfPenS) return null

  // Parse peak UTC time
  const neg  = eclipse.date.startsWith('-')
  const bare = neg ? eclipse.date.slice(1) : eclipse.date
  const [y, m, d] = bare.split('-').map(Number)
  const peak = new Date(0)
  try {
    peak.setUTCFullYear(neg ? -y : y, m - 1, d)
    const parts = eclipse.time.split(':').map(Number)
    peak.setUTCHours(parts[0], parts[1], parts[2] ?? 0, 0)
  } catch {
    return null
  }
  const peakMs = peak.getTime()

  function slp(offsetS) {
    const [lng, lat] = getSubLunarPoint(new Date(peakMs + offsetS * 1000))
    return [lng, lat]
  }

  const zones = {}
  try {
    const HP1 = hemi(slp(-halfPenS))
    const HP4 = hemi(slp(+halfPenS))
    await yield_()
    zones.somePen   = safeUnion(HP1, HP4)
    await yield_()
    zones.entireEcl = safeIntersect(HP1, HP4)

    if (halfUmbS > 0) {
      await yield_()
      const HU1 = hemi(slp(-halfUmbS))
      const HU4 = hemi(slp(+halfUmbS))
      await yield_()
      zones.somePart   = safeUnion(HU1, HU4)
      await yield_()
      zones.entirePart = safeIntersect(HU1, HU4)
    }

    if (halfTotS > 0) {
      await yield_()
      const HU2 = hemi(slp(-halfTotS))
      const HU3 = hemi(slp(+halfTotS))
      await yield_()
      zones.someTot   = safeUnion(HU2, HU3)
      await yield_()
      zones.entireTot = safeIntersect(HU2, HU3)
    }
  } catch {
    return null
  }

  return zones
}
