const DEG = Math.PI / 180

// Compute the sub-solar point (lat/lng where sun is directly overhead) at a given UTC date.
export function getSubSolarPoint(date) {
  // Days since J2000.0 (2000-01-01 12:00 UTC)
  const D = date.getTime() / 86400000 - 10957.5

  // Solar mean longitude and anomaly (degrees)
  const L = (280.460 + 0.9856474 * D) % 360
  const g = ((357.528 + 0.9856003 * D) % 360) * DEG

  // Ecliptic longitude (radians)
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG

  // Obliquity of ecliptic (radians)
  const epsilon = (23.439 - 0.0000004 * D) * DEG

  // Solar declination (latitude of sub-solar point)
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda))

  // Right ascension (radians)
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda))

  // Greenwich Mean Sidereal Time (hours)
  const gmst = (6.697375 + 0.0657098242 * D +
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) % 24

  // Greenwich Hour Angle of Sun (degrees)
  const gha = (gmst * 15 - ra / DEG + 360) % 360

  // Sub-solar longitude: -GHA normalized to [-180, 180]
  let sunLng = ((-gha % 360) + 360) % 360
  if (sunLng > 180) sunLng -= 360

  return [sunLng, dec / DEG]
}

// Compute the sub-lunar point (lat/lng where the moon is directly overhead).
// Uses simplified Meeus formulas — accurate to ~0.3° for indicator purposes.
export function getSubLunarPoint(date) {
  const T  = (date.getTime() / 86400000 - 10957.5) / 36525  // Julian centuries from J2000.0

  // Fundamental arguments (degrees)
  const L  = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360   // Moon mean longitude
  const Mm = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360   // Moon mean anomaly
  const Ms = ((357.5291 +  35999.0503 * T) % 360 + 360) % 360   // Sun mean anomaly
  const D  = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360   // Moon elongation
  const F  = (( 93.2721 + 483202.0175 * T) % 360 + 360) % 360   // Moon argument of latitude

  const Mmr = Mm * DEG, Msr = Ms * DEG, Dr = D * DEG, Fr = F * DEG

  // Ecliptic longitude corrections (degrees)
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

  // Ecliptic latitude (degrees)
  const beta =
    + 5.128 * Math.sin(Fr)
    + 0.280 * Math.sin(Mmr + Fr)
    + 0.277 * Math.sin(Mmr - Fr)
    + 0.173 * Math.sin(2 * Dr - Fr)
    + 0.055 * Math.sin(2 * Dr - Mmr + Fr)
    - 0.046 * Math.sin(2 * Dr - Mmr - Fr)
    + 0.033 * Math.sin(2 * Dr + Fr)
    + 0.017 * Math.sin(2 * Mmr + Fr)

  const lamR = lambda * DEG
  const betR = beta * DEG
  const eps  = (23.439 - 0.0000004 * (T * 36525)) * DEG  // obliquity

  // Ecliptic → equatorial
  const sinDec = Math.sin(betR) * Math.cos(eps) + Math.cos(betR) * Math.sin(eps) * Math.sin(lamR)
  const dec    = Math.asin(Math.max(-1, Math.min(1, sinDec)))
  const ra     = Math.atan2(
    Math.sin(lamR) * Math.cos(eps) - Math.tan(betR) * Math.sin(eps),
    Math.cos(lamR)
  )

  // Greenwich Mean Sidereal Time → sub-lunar longitude
  const D0   = date.getTime() / 86400000 - 10957.5
  const gmst = (6.697375 + 0.0657098242 * D0 +
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) % 24
  const gha  = (gmst * 15 - ra / DEG + 360) % 360

  let moonLng = ((-gha % 360) + 360) % 360
  if (moonLng > 180) moonLng -= 360

  return [moonLng, dec / DEG]
}

// Build a GeoJSON polygon representing the daytime hemisphere (transit visibility zone).
export function getDayPolygon(date) {
  const [sunLng, sunLat] = getSubSolarPoint(date)
  const dec = sunLat * DEG
  const tanDec = Math.tan(dec)

  const steps = 360
  const terminator = []
  for (let i = 0; i <= steps; i++) {
    const lng = -180 + (360 * i / steps)
    const H = (lng - sunLng) * DEG
    const cosH = Math.cos(H)
    let lat
    if (Math.abs(tanDec) < 1e-9 && Math.abs(cosH) < 1e-9) {
      lat = 0
    } else if (Math.abs(tanDec) < 1e-9) {
      lat = cosH > 0 ? -89.9 : 89.9
    } else {
      lat = Math.atan(-cosH / tanDec) / DEG
    }
    lat = Math.max(-89.9, Math.min(89.9, lat))
    terminator.push([parseFloat(lng.toFixed(2)), parseFloat(lat.toFixed(2))])
  }

  // Day pole is opposite of night pole
  const dayPole = dec < 0 ? -89.9 : 89.9

  const ring = [
    ...terminator,
    [180, dayPole],
    [-180, dayPole],
    terminator[0],
  ]

  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }
}

// Build a GeoJSON polygon representing the night hemisphere.
export function getNightPolygon(date) {
  const [sunLng, sunLat] = getSubSolarPoint(date)
  const dec = sunLat * DEG
  const tanDec = Math.tan(dec)

  // Sample terminator latitude at each integer longitude step
  const steps = 360
  const terminator = []
  for (let i = 0; i <= steps; i++) {
    const lng = -180 + (360 * i / steps)
    const H = (lng - sunLng) * DEG

    const cosH = Math.cos(H)
    let lat
    if (Math.abs(tanDec) < 1e-9 && Math.abs(cosH) < 1e-9) {
      lat = 0
    } else if (Math.abs(tanDec) < 1e-9) {
      lat = cosH > 0 ? -89.9 : 89.9
    } else {
      lat = Math.atan(-cosH / tanDec) / DEG
    }
    lat = Math.max(-89.9, Math.min(89.9, lat))
    terminator.push([parseFloat(lng.toFixed(2)), parseFloat(lat.toFixed(2))])
  }

  // Which pole is in night? North pole is dark when sun is south (dec < 0)
  const nightPole = dec < 0 ? 89.9 : -89.9

  const ring = [
    ...terminator,
    [180, nightPole],
    [-180, nightPole],
    terminator[0],
  ]

  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }
}
