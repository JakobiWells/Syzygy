// ─── Pole/antimeridian-safe GeoJSON geometry ────────────────────────────────
//
// Mapbox GL stores vector features in Web-Mercator tile space, which
// (a) does not exist above ±85.05° latitude, and (b) treats longitude jumps
// across ±180° as segments spanning the whole world. Any polygon near a pole
// hits both: perpendicular offsets flip longitude by ~180° across the pole,
// and the triangulator draws a giant "fan" wedge over the map.
//
// The fix (same algorithm as the standard `antimeridian` library):
//   1. clamp latitudes to the renderable Mercator range,
//   2. cut rings/lines wherever they cross ±180°, interpolating the
//      crossing latitude,
//   3. close each cut piece along the antimeridian — and when a ring
//      encircles a pole (odd number of crossings), close it with a
//      densified cap at the clamp latitude.

// Clamp bounds sit just inside the polar-cap mask layers the map draws
// (north cap covers ≥~83.7°N, south cap ≥~81.9°S). Keeping geometry below
// them means it (a) never reaches the Mercator tile edge at 85.05° where
// Mapbox's pole triangle-fan extrapolates it into a giant smear, and
// (b) visually terminates at the ice cap instead of mid-nowhere.
export const NORTH_MAX_LAT = 83.6
export const SOUTH_MAX_LAT = -81.8

const clampLat = lat => Math.max(SOUTH_MAX_LAT, Math.min(NORTH_MAX_LAT, lat))

function normLon(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180
}

// Densified run of points along a constant longitude, exclusive of endpoints
function meridianRun(lon, latFrom, latTo, stepDeg = 5) {
  const pts = []
  const n = Math.max(1, Math.ceil(Math.abs(latTo - latFrom) / stepDeg))
  for (let i = 1; i < n; i++) pts.push([lon, latFrom + (latTo - latFrom) * (i / n)])
  return pts
}

// Densified run along a constant latitude from lonFrom to lonTo, inclusive
function parallelRun(lat, lonFrom, lonTo, stepDeg = 15) {
  const pts = []
  const n = Math.max(1, Math.ceil(Math.abs(lonTo - lonFrom) / stepDeg))
  for (let i = 0; i <= n; i++) pts.push([lonFrom + (lonTo - lonFrom) * (i / n), lat])
  return pts
}

// Split a closed ring at the antimeridian. Returns an array of closed rings,
// each confined to [-180, 180] longitude. Rings that encircle a pole are
// closed with a cap at ±MAX_LAT. Returns null for degenerate input.
export function splitRing(rawRing) {
  if (!rawRing || rawRing.length < 4) return null
  let ring = rawRing
  const last = ring[ring.length - 1]
  if (ring[0][0] === last[0] && ring[0][1] === last[1]) ring = ring.slice(0, -1)
  if (ring.length < 3) return null

  const pts = ring.map(([lon, lat]) => [normLon(lon), clampLat(lat)])

  // Walk the ring, cutting wherever a segment crosses ±180°
  const chunks = []
  let cur = [pts[0]]
  for (let i = 1; i <= pts.length; i++) {
    const [rawLon, lat] = pts[i % pts.length]
    const prev = cur[cur.length - 1]
    let lon = rawLon
    let d = lon - prev[0]
    if (d > 180) lon -= 360
    else if (d < -180) lon += 360
    if (lon > 180) {
      const t = (180 - prev[0]) / (lon - prev[0])
      const latX = prev[1] + t * (lat - prev[1])
      cur.push([180, latX])
      chunks.push(cur)
      cur = [[-180, latX], [lon - 360, lat]]
    } else if (lon < -180) {
      const t = (-180 - prev[0]) / (lon - prev[0])
      const latX = prev[1] + t * (lat - prev[1])
      cur.push([-180, latX])
      chunks.push(cur)
      cur = [[180, latX], [lon + 360, lat]]
    } else {
      cur.push([lon, lat])
    }
  }

  // Never crossed: single ring (already closed by the wrap-around iteration)
  if (chunks.length === 0) return [cur]

  // The trailing piece continues into the first chunk (both touch the ring's
  // start point) — stitch them into one chunk
  chunks[0] = cur.slice(0, -1).concat(chunks[0])

  const rings = []
  for (const chunk of chunks) {
    const s = chunk[0], e = chunk[chunk.length - 1]
    if (s[0] === e[0]) {
      // Starts and ends on the same side of the antimeridian:
      // close straight down/up the meridian
      const closed = chunk.concat(meridianRun(s[0], e[1], s[1]))
      closed.push([s[0], s[1]])
      rings.push(closed)
    } else {
      // Opposite sides → this piece winds around a pole: cap it
      let latSum = 0
      for (const p of chunk) latSum += p[1]
      const poleLat = latSum / chunk.length >= 0 ? NORTH_MAX_LAT : SOUTH_MAX_LAT
      const closed = chunk
        .concat(meridianRun(e[0], e[1], poleLat))
        .concat(parallelRun(poleLat, e[0], s[0]))
        .concat(meridianRun(s[0], poleLat, s[1]))
      closed.push([s[0], s[1]])
      rings.push(closed)
    }
  }
  return rings
}

// Interpolated point where segment a→b crosses the polar clamp boundary
function latBoundaryPoint(a, b) {
  const bound = (a[1] > NORTH_MAX_LAT || b[1] > NORTH_MAX_LAT) ? NORTH_MAX_LAT : SOUTH_MAX_LAT
  const t = (bound - a[1]) / (b[1] - a[1])
  return [a[0] + t * (b[0] - a[0]), bound]
}

// Cut a line where it enters the polar cap zone — lines break (dive under the
// cap) rather than sliding along its edge the way clamped polygons do.
function cutLineAtCaps(coords) {
  const inside = lat => lat <= NORTH_MAX_LAT && lat >= SOUTH_MAX_LAT
  const lines = []
  let cur = []
  for (let i = 0; i < coords.length; i++) {
    const p = coords[i]
    if (inside(p[1])) {
      if (cur.length === 0 && i > 0 && !inside(coords[i - 1][1])) {
        cur.push(latBoundaryPoint(coords[i - 1], p))
      }
      cur.push(p)
    } else if (cur.length > 0) {
      cur.push(latBoundaryPoint(coords[i - 1], p))
      if (cur.length >= 2) lines.push(cur)
      cur = []
    }
  }
  if (cur.length >= 2) lines.push(cur)
  return lines
}

// Split a line at the antimeridian and cut it at the polar cap boundaries.
// Returns an array of line segments, each confined to [-180, 180].
export function splitLine(rawCoords) {
  if (!rawCoords || rawCoords.length < 2) return null
  const pts = rawCoords.map(([lon, lat]) => [normLon(lon), lat])

  const chunks = []
  let cur = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [rawLon, lat] = pts[i]
    const prev = cur[cur.length - 1]
    let lon = rawLon
    let d = lon - prev[0]
    if (d > 180) lon -= 360
    else if (d < -180) lon += 360
    if (lon > 180) {
      const t = (180 - prev[0]) / (lon - prev[0])
      const latX = prev[1] + t * (lat - prev[1])
      cur.push([180, latX])
      chunks.push(cur)
      cur = [[-180, latX], [lon - 360, lat]]
    } else if (lon < -180) {
      const t = (-180 - prev[0]) / (lon - prev[0])
      const latX = prev[1] + t * (lat - prev[1])
      cur.push([-180, latX])
      chunks.push(cur)
      cur = [[180, latX], [lon + 360, lat]]
    } else {
      cur.push([lon, lat])
    }
  }
  if (cur.length >= 2) chunks.push(cur)

  const lines = chunks.flatMap(cutLineAtCaps)
  return lines.length ? lines : null
}

// Convenience: sanitize a turf-style Polygon feature (single outer ring) into
// a pole/antimeridian-safe MultiPolygon feature.
export function sanitizePolygon(feature) {
  const ring = feature?.geometry?.coordinates?.[0]
  const rings = splitRing(ring)
  if (!rings) return feature
  return {
    type: 'Feature',
    properties: feature.properties ?? {},
    geometry: { type: 'MultiPolygon', coordinates: rings.map(r => [r]) },
  }
}

// Convenience: sanitize raw line coordinates into a MultiLineString feature.
export function sanitizeLine(coords, properties = {}) {
  const lines = splitLine(coords)
  if (!lines) return null
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'MultiLineString', coordinates: lines },
  }
}
