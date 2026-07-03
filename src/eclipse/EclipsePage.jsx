import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import SunCalc from 'suncalc'
import * as turf from '@turf/turf'
import 'mapbox-gl/dist/mapbox-gl.css'

import { computeAnimationTimestamps } from './astroEngine'
import { useCatalog } from './useCatalog'
import { useLunarCatalog } from './useLunarCatalog'
import { buildLunarZones } from './lunarVisibility'
import LocationPanel from './LocationPanel'
import LeftPanel from './LeftPanel'
import { meteorGeoJSON } from './MeteorShowers'
import BortleLegend from './BortleLegend'
import TimeBar from '../time/TimeBar'
import TimeScrubber from '../time/TimeScrubber'
import { useSimTime } from '../time/TimeContext'
import { useOverlays } from './OverlaysContext'
import { getNightPolygon, getDayPolygon } from './daynight'
import { TerrainShadowLayer } from './terrainShadowLayer'
import SunIndicator from './SunIndicator'
import MoonIndicator from './MoonIndicator'
import IssIndicator from './IssIndicator'
import {
  loadIssTle, loadIssArchive, getIssGroundTrackPhases, issPathGeoJSON,
  getIssPosition, getIssVisibilityRadiusKm, getIssVisibilityStatus,
  ISS_LAUNCH_MS,
} from './issEngine'
import SolarSystem from './SolarSystem'
import WeatherLayer from './WeatherLayer'
import WeatherLegend from './WeatherLegend'
import WindParticles from './WindParticles'
import HotelLayer from './HotelLayer'
import HotelCard from './HotelCard'
import ErrorBoundary from '../components/ErrorBoundary'
import './eclipse.css'

// ─── Static overlay GeoJSON ────────────────────────────────────────────────

const lng360 = Array.from({ length: 361 }, (_, i) => -180 + i)

const EQUATOR_DATA = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: lng360.map(lng => [lng, 0]) },
}

const TROPIC_LAT = 23.436
const TROPICS_DATA = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: lng360.map(lng => [lng,  TROPIC_LAT]) } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: lng360.map(lng => [lng, -TROPIC_LAT]) } },
  ],
}

// Solar time-zone meridians every 15°
const TIMEZONE_DATA = {
  type: 'FeatureCollection',
  features: Array.from({ length: 25 }, (_, i) => {
    const lng = -180 + i * 15
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: Array.from({ length: 19 }, (_, j) => [lng, -90 + j * 10]) },
    }
  }),
}

// ─── Eclipse data adapter ──────────────────────────────────────────────────

function adaptEclipse(entry) {
  if (!entry) return null
  const cl = entry.centerLine
  let centerLineCoords = null   // visual display: single segment (avoids antimeridian artifact)
  let animationCoords  = null   // shadow track: all segments concatenated (full path)

  if (cl && cl.length > 0) {
    if (Array.isArray(cl[0][0])) {
      // Multi-segment path (antimeridian crossing or polar gap).
      // Visual: use longest segment only — concatenating draws a diagonal across the map.
      // Animation: concatenate all so the shadow tracks the full path duration correctly.
      centerLineCoords = cl.reduce((best, seg) => seg.length > best.length ? seg : best, [])
      animationCoords  = cl.flat()
    } else {
      centerLineCoords = cl
      animationCoords  = cl
    }
  }
  if (centerLineCoords && centerLineCoords.length < 3) centerLineCoords = null
  if (animationCoords  && animationCoords.length  < 2) animationCoords  = null

  // Use catalog peakFrac directly — the ±30 min search window handles any catalog timing errors.
  // Geography-based override broke polar-crossing eclipses (e.g. 2026) where shadow speed varies.
  const peakFrac = entry.peakFrac ?? 0.5

  // Compute per-point corrected UTC timestamps using astronomy-engine.
  // The catalog assumes equal time spacing between the 79 points, which drifts
  // up to ~90 s. We replace those with the actual time of minimum Moon-Sun
  // separation at each center-line coordinate (~98 ms total computation).
  let animationTimestamps = null
  if (animationCoords && entry.time && entry.pathDurationS) {
    const peakMs  = (() => {
      const neg = entry.date.startsWith('-')
      const bare = neg ? entry.date.slice(1) : entry.date
      const [yr, mo, dy] = bare.split('-').map(Number)
      const d = new Date(0)
      d.setUTCFullYear(neg ? -yr : yr, mo - 1, dy)
      const [h, m, s] = entry.time.split(':').map(Number)
      d.setUTCHours(h, m, s ?? 0, 0)
      return d.getTime()
    })()
    const startMs = peakMs - peakFrac * entry.pathDurationS * 1000
    const n = animationCoords.length
    const roughTimes = animationCoords.map((_, i) => startMs + (i / (n - 1)) * entry.pathDurationS * 1000)
    animationTimestamps = computeAnimationTimestamps(animationCoords, roughTimes)
  }

  const widthKm = entry.widthKm && entry.widthKm > 0 ? entry.widthKm : null

  return {
    ...entry,
    centerLineCoords,
    animationCoords,
    animationTimestamps,
    umbraWidth: widthKm ?? 100,
    hasValidWidth: widthKm != null && widthKm > 0,
    peakUTC: entry.time ?? '12:00:00',
    durationAtPoints: entry.durationS && entry.greatest
      ? [{ coords: entry.greatest, seconds: entry.durationS }]
      : [],
    defaultCenter: entry.greatest ?? [0, 20],
    defaultZoom: 3,
    hybridTransitions: entry.hybridTransitions ?? null,
    pathDurationS: entry.pathDurationS ?? null,
    peakFrac,
  }
}

// ─── Geometry helpers ──────────────────────────────────────────────────────

// In globe mode Mapbox renders line segments as straight 3D chords.
// Near the poles, a chord between two points with different longitudes dips
// below Earth's surface, creating a mesh/fan visual artifact.
// SLERP-densifying forces the chord to stay on the sphere surface.
function densifyPolarCoords(coords, latThreshold = 70, steps = 12) {
  const DEG = Math.PI / 180
  const out = []
  for (let i = 0; i < coords.length - 1; i++) {
    out.push(coords[i])
    const [lon1, lat1] = coords[i]
    const [lon2, lat2] = coords[i + 1]
    if (Math.abs(lat1) > latThreshold || Math.abs(lat2) > latThreshold) {
      const φ1 = lat1 * DEG, λ1 = lon1 * DEG
      const φ2 = lat2 * DEG, λ2 = lon2 * DEG
      const x1 = Math.cos(φ1) * Math.cos(λ1), y1 = Math.cos(φ1) * Math.sin(λ1), z1 = Math.sin(φ1)
      const x2 = Math.cos(φ2) * Math.cos(λ2), y2 = Math.cos(φ2) * Math.sin(λ2), z2 = Math.sin(φ2)
      const dot = Math.min(1, Math.max(-1, x1*x2 + y1*y2 + z1*z2))
      const omega = Math.acos(dot)
      if (omega > 0.005) {
        const sinOmega = Math.sin(omega)
        for (let j = 1; j < steps; j++) {
          const t = j / steps
          const a = Math.sin((1 - t) * omega) / sinOmega
          const b = Math.sin(t * omega) / sinOmega
          const xi = a*x1 + b*x2, yi = a*y1 + b*y2, zi = a*z1 + b*z2
          out.push([Math.atan2(yi, xi) / DEG, Math.asin(zi) / DEG])
        }
      }
    }
  }
  out.push(coords[coords.length - 1])
  return out
}

function norm(deg) { return ((deg % 360) + 360) % 360 }

function buildCorridorFeatures(centerLine, umbraWidthKm) {
  const half = umbraWidthKm / 2
  const len = turf.length(centerLine, { units: 'kilometers' })
  const steps = Math.ceil(len / 6)
  const northPts = [], southPts = []

  for (let i = 0; i <= steps; i++) {
    const dist = (i / steps) * len
    const pt = turf.along(centerLine, dist, { units: 'kilometers' })
    const d1 = Math.max(0, dist - 40)
    const d2 = Math.min(len, dist + 40)
    const brng = turf.bearing(
      turf.along(centerLine, d1, { units: 'kilometers' }),
      turf.along(centerLine, d2, { units: 'kilometers' }),
    )
    northPts.push(turf.destination(pt, half, norm(brng - 90), { units: 'kilometers' }).geometry.coordinates)
    southPts.push(turf.destination(pt, half, norm(brng + 90), { units: 'kilometers' }).geometry.coordinates)
  }

  return {
    polygon: turf.polygon([[...northPts, ...[...southPts].reverse(), northPts[0]]]),
    northLine: turf.lineString(northPts),
    southLine: turf.lineString(southPts),
  }
}

function interpolateDuration(lat, lng, durationAtPoints) {
  let best = null, bestDist = Infinity
  for (const { coords, seconds } of durationAtPoints) {
    const d = turf.distance(turf.point([lng, lat]), turf.point(coords), { units: 'kilometers' })
    if (d < bestDist) { bestDist = d; best = seconds }
  }
  return best
}

// ─── Weather helpers ───────────────────────────────────────────────────────

function getSampleYears() {
  const end = new Date().getFullYear() - 1
  return [end - 4, end - 3, end - 2, end - 1, end]
}

function eclipseYear(eclipse) {
  if (!eclipse?.date) return 0
  const neg = eclipse.date.startsWith('-')
  return parseInt((neg ? eclipse.date.slice(1) : eclipse.date).split('-')[0], 10) * (neg ? -1 : 1)
}

function canFetchWeather(eclipse) {
  const yr = eclipseYear(eclipse)
  const now = new Date().getFullYear()
  return yr >= 1940 && yr <= now
}

async function fetchCloudForPoint(lat, lng, eclipse) {
  const years = getSampleYears()
  const peakHour = parseInt(eclipse.peakUTC.split(':')[0], 10)
  const baseMMDD = eclipse.date.replace(/^-?\d+-/, '').slice(0, 5) // 'MM-DD'

  const yearResults = await Promise.all(years.map(async yr => {
    const date = `${yr}-${baseMMDD}`
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&start_date=${date}&end_date=${date}&hourly=cloud_cover&timezone=UTC`
    try {
      const res = await fetch(url)
      const json = await res.json()
      const val = json?.hourly?.cloud_cover?.[peakHour] ?? null
      return { year: yr, value: val !== null ? Math.round(val) : null }
    } catch {
      return { year: yr, value: null }
    }
  }))

  const valid = yearResults.filter(r => r.value !== null)
  const avg = valid.length ? Math.round(valid.reduce((s, r) => s + r.value, 0) / valid.length) : null
  return { cloudPct: avg, yearBreakdown: yearResults }
}

// ─── Map layer management ──────────────────────────────────────────────────

const SOURCE_IDS = [
  'north-pole-source', 'south-pole-source',
  'umbra-source', 'north-limit-source', 'south-limit-source',
  'center-line-source', 'shadow-source',
  'hybrid-annular-source', 'hybrid-total-source', 'penumbra-source',
  'night-source', 'equator-source', 'tropics-source', 'timezones-source',
  'iss-path-past-source', 'iss-path-future-source', 'iss-visibility-source',
  'transit-band-source', 'transit-path-source',
  'meteor-source',
  'planetary-transit-source',
  'city-lights-source',
]
const LAYER_IDS = [
  'north-pole-cap', 'south-pole-cap',
  'night-fill', 'equator-line', 'tropics-line', 'timezones-line',
  'iss-path-past-line', 'iss-path-future-line', 'iss-visibility-fill', 'iss-visibility-line',
  'transit-band-fill', 'transit-band-outline', 'transit-path-line',
  'meteor-fill',
  'planetary-transit-fill', 'planetary-transit-outline',
  'city-lights-raster',
  'sqm-raster',
  'umbra-fill', 'north-limit', 'south-limit', 'center-line', 'shadow-fill',
  'penumbra-fill', 'penumbra-outline', 'hybrid-annular', 'hybrid-total',
]

// Polar cap GeoJSON — rings of lat/lng sampled densely so the globe chord-rendering
// stays on the surface. 700 km covers the worst rendering artifacts above ~83° N/S.
function polarCapGeoJSON(poleLat, radiusKm) {
  const steps = 120
  const R = 6371
  const angRad = radiusKm / R
  const coords = Array.from({ length: steps + 1 }, (_, i) => {
    const θ = (i / steps) * 2 * Math.PI
    const lat = Math.asin(
      Math.sin(poleLat * Math.PI / 180) * Math.cos(angRad) +
      Math.cos(poleLat * Math.PI / 180) * Math.sin(angRad) * Math.cos(θ)
    ) * 180 / Math.PI
    const lng = (poleLat > 0 ? 0 : 180) + Math.atan2(
      Math.sin(θ) * Math.sin(angRad) * Math.cos(poleLat * Math.PI / 180),
      Math.cos(angRad) - Math.sin(poleLat * Math.PI / 180) * Math.sin(lat * Math.PI / 180)
    ) * 180 / Math.PI
    return [lng, lat]
  })
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
}

const NORTH_POLE_CAP = polarCapGeoJSON(90,  700)
const SOUTH_POLE_CAP = polarCapGeoJSON(-90, 900)

const EMPTY_POLY   = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } }
const EMPTY_LINE   = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
const EMPTY_CIRCLE = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } }
const EMPTY_FC     = { type: 'FeatureCollection', features: [] }
const EMPTY_ISS_PATH = { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] } }

function initLayers(map) {
  // Polar caps — solid fills that sit beneath the night layer to mask globe rendering
  // artifacts (chord interpolation causes geometry to dip below the surface near poles).
  map.addSource('north-pole-source', { type: 'geojson', data: NORTH_POLE_CAP })
  map.addLayer({ id: 'north-pole-cap', type: 'fill', source: 'north-pole-source',
    paint: { 'fill-color': '#a8cfe0', 'fill-opacity': 1 } })

  map.addSource('south-pole-source', { type: 'geojson', data: SOUTH_POLE_CAP })
  map.addLayer({ id: 'south-pole-cap', type: 'fill', source: 'south-pole-source',
    paint: { 'fill-color': '#eef4f6', 'fill-opacity': 1 } })

  map.addSource('night-source', { type: 'geojson', data: EMPTY_POLY })
  map.addLayer({ id: 'night-fill', type: 'fill', source: 'night-source',
    paint: { 'fill-color': '#0a1628', 'fill-opacity': 0.35 } })

  // NASA Black Marble VIIRS DNB annual composite — city lights (max zoom 8, NASA data limit)
  map.addSource('city-lights-source', {
    type: 'raster',
    tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'],
    tileSize: 256,
    maxzoom: 8,
    attribution: 'NASA Black Marble / GIBS',
  })
  map.addLayer({
    id: 'city-lights-raster',
    type: 'raster',
    source: 'city-lights-source',
    paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 400 },
    layout: { visibility: 'none' },
  })

  // Light pollution gradient — same NASA Black Marble source, luminance remapped via
  // raster-color to the app's dark→cool-gray→warm-amber palette.
  // raster-color-mix computes luminance in 0-1 range (shader normalises RGB channels to 0-1),
  // so raster-color-range must be [0, 1] and stops must match.
  map.addLayer({
    id: 'sqm-raster',
    type: 'raster',
    source: 'city-lights-source',
    paint: {
      'raster-color-mix':   [0.2126, 0.7152, 0.0722, 0],  // standard luminance weights
      'raster-color-range': [0, 1],
      'raster-color': [
        'interpolate', ['linear'], ['raster-value'],
        0,     'rgba(4,8,18,0.88)',          // class 1 — pristine dark sky (dark navy)
        0.015, 'rgba(8,18,42,0.85)',         // class 2
        0.05,  'rgba(18,36,56,0.81)',        // class 3
        0.11,  'rgba(28,50,52,0.77)',        // class 4 — teal-gray transition
        0.22,  'rgba(50,60,38,0.74)',        // class 5 — olive neutral
        0.35,  'rgba(90,72,34,0.76)',        // class 6 — warm gray
        0.55,  'rgba(142,108,46,0.82)',      // class 7 — amber
        0.78,  'rgba(192,155,82,0.90)',      // class 8
        1.0,   'rgba(232,208,148,0.96)',     // class 9 — city core (bright cream)
      ],
      'raster-fade-duration': 400,
    },
    layout: { visibility: 'none' },
  })

  map.addSource('equator-source', { type: 'geojson', data: EQUATOR_DATA })
  map.addLayer({ id: 'equator-line', type: 'line', source: 'equator-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#22c55e', 'line-width': 1.25, 'line-opacity': 0.55 } })

  map.addSource('tropics-source', { type: 'geojson', data: TROPICS_DATA })
  map.addLayer({ id: 'tropics-line', type: 'line', source: 'tropics-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#f0a500', 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [4, 4] } })

  map.addSource('timezones-source', { type: 'geojson', data: TIMEZONE_DATA })
  map.addLayer({ id: 'timezones-line', type: 'line', source: 'timezones-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#888', 'line-width': 0.75, 'line-opacity': 0.35, 'line-dasharray': [2, 5] } })

  map.addSource('iss-path-past-source', { type: 'geojson', data: EMPTY_ISS_PATH })
  map.addLayer({ id: 'iss-path-past-line', type: 'line', source: 'iss-path-past-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#0284c7', 'line-width': 2.25, 'line-opacity': 0.82 } })

  map.addSource('iss-path-future-source', { type: 'geojson', data: EMPTY_ISS_PATH })
  map.addLayer({ id: 'iss-path-future-line', type: 'line', source: 'iss-path-future-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#0ea5e9', 'line-width': 2, 'line-opacity': 0.72, 'line-dasharray': [2, 3] } })

  map.addSource('iss-visibility-source', { type: 'geojson', data: EMPTY_POLY })
  map.addLayer({ id: 'iss-visibility-fill', type: 'fill', source: 'iss-visibility-source',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'match', ['get', 'status'],
        'visible', '#22c55e',
        'daylight', '#f59e0b',
        'not-sunlit', '#64748b',
        'stale-tle', '#7c3aed',
        'out-of-range', '#0ea5e9',
        '#0ea5e9',
      ],
      'fill-opacity': [
        'match', ['get', 'status'],
        'not-sunlit', 0.07,
        'visible', 0.16,
        0.1,
      ],
    } })
  map.addLayer({ id: 'iss-visibility-line', type: 'line', source: 'iss-visibility-source',
    layout: { visibility: 'none' },
    paint: {
      'line-color': [
        'match', ['get', 'status'],
        'visible', '#16a34a',
        'daylight', '#d97706',
        'not-sunlit', '#64748b',
        'stale-tle', '#7c3aed',
        'out-of-range', '#0ea5e9',
        '#0ea5e9',
      ],
      'line-width': 1.5,
      'line-opacity': 0.65,
      'line-dasharray': [3, 3],
    } })

  map.addSource('transit-band-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'transit-band-fill', type: 'fill', source: 'transit-band-source',
    paint: { 'fill-color': '#f97316', 'fill-opacity': 0.15 } })
  map.addLayer({ id: 'transit-band-outline', type: 'line', source: 'transit-band-source',
    paint: { 'line-color': '#f97316', 'line-width': 1, 'line-opacity': 0.55, 'line-dasharray': [3, 2] } })
  map.addSource('transit-path-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'transit-path-line', type: 'line', source: 'transit-path-source',
    paint: { 'line-color': '#f97316', 'line-width': 2, 'line-opacity': 0.9 } })

  // Planetary transit daytime visibility zone
  map.addSource('planetary-transit-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'planetary-transit-fill', type: 'fill', source: 'planetary-transit-source',
    paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.13 } })
  map.addLayer({ id: 'planetary-transit-outline', type: 'line', source: 'planetary-transit-source',
    paint: { 'line-color': '#fbbf24', 'line-width': 1.5, 'line-opacity': 0.5, 'line-dasharray': [4, 3] } })

  // Meteor shower visibility zones (rendered largest→smallest so inner zones override outer)
  map.addSource('meteor-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'meteor-fill', type: 'fill', source: 'meteor-source',
    paint: {
      'fill-color': ['match', ['get', 'zone'],
        'best', '#7c3aed',
        'good', '#a855f7',
        '#d8b4fe',
      ],
      'fill-opacity': ['match', ['get', 'zone'],
        'best', 0.45,
        'good', 0.28,
        0.12,
      ],
    },
  })

  // Lunar eclipse visibility zones (6 layers, painted outside-in)
  const LUNAR_ZONE_STYLES = [
    { key: 'pen',     fill: '#94a3b8', line: '#64748b', fo: 0.03, lo: 0.10 },
    { key: 'part',    fill: '#818cf8', line: '#6366f1', fo: 0.05, lo: 0.13 },
    { key: 'tot',     fill: '#c084fc', line: '#a855f7', fo: 0.07, lo: 0.16 },
    { key: 'enttot',  fill: '#e879f9', line: '#d946ef', fo: 0.09, lo: 0.19 },
    { key: 'entpart', fill: '#f43f5e', line: '#e11d48', fo: 0.12, lo: 0.22 },
    { key: 'entecl',  fill: '#dc2626', line: '#991b1b', fo: 0.16, lo: 0.28 },
  ]
  for (const { key, fill, line, fo, lo } of LUNAR_ZONE_STYLES) {
    map.addSource(`lunar-${key}-source`, { type: 'geojson', data: EMPTY_POLY })
    map.addLayer({ id: `lunar-${key}-fill`, type: 'fill', source: `lunar-${key}-source`,
      layout: { visibility: 'none' },
      paint: { 'fill-color': fill, 'fill-opacity': fo } })
    map.addLayer({ id: `lunar-${key}-outline`, type: 'line', source: `lunar-${key}-source`,
      layout: { visibility: 'none' },
      paint: { 'line-color': line, 'line-width': 1, 'line-opacity': lo } })
  }

  map.addSource('umbra-source',          { type: 'geojson', data: EMPTY_POLY })
  map.addSource('north-limit-source',    { type: 'geojson', data: EMPTY_LINE })
  map.addSource('south-limit-source',    { type: 'geojson', data: EMPTY_LINE })
  map.addSource('center-line-source',    { type: 'geojson', data: EMPTY_LINE })
  map.addSource('shadow-source',         { type: 'geojson', data: EMPTY_CIRCLE })
  map.addSource('hybrid-annular-source', { type: 'geojson', data: EMPTY_FC })
  map.addSource('hybrid-total-source',   { type: 'geojson', data: EMPTY_LINE })
  map.addSource('penumbra-source',       { type: 'geojson', data: EMPTY_POLY })

  // Penumbra — beneath everything else (partial eclipse shadow region)
  map.addLayer({ id: 'penumbra-fill', type: 'fill', source: 'penumbra-source',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#f0a500', 'fill-opacity': 0.05 } })

  map.addLayer({ id: 'penumbra-outline', type: 'line', source: 'penumbra-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#d97706', 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [3, 4] } })

  map.addLayer({ id: 'umbra-fill', type: 'fill', source: 'umbra-source',
    paint: { 'fill-color': '#1a1a1a', 'fill-opacity': 0.08 } })

  map.addLayer({ id: 'north-limit', type: 'line', source: 'north-limit-source',
    paint: { 'line-color': '#1a1a1a', 'line-width': 1.5, 'line-opacity': 0.35 } })

  map.addLayer({ id: 'south-limit', type: 'line', source: 'south-limit-source',
    paint: { 'line-color': '#1a1a1a', 'line-width': 1.5, 'line-opacity': 0.35 } })

  // Hybrid eclipse: annular ends (amber) and total middle (dark, dashed)
  map.addLayer({ id: 'hybrid-annular', type: 'line', source: 'hybrid-annular-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#d97706', 'line-width': 2.5, 'line-opacity': 0.9 } })

  map.addLayer({ id: 'hybrid-total', type: 'line', source: 'hybrid-total-source',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#1a1a1a', 'line-width': 2, 'line-dasharray': [5, 4], 'line-opacity': 0.8 } })

  map.addLayer({ id: 'center-line', type: 'line', source: 'center-line-source',
    paint: { 'line-color': '#f0a500', 'line-width': 2, 'line-dasharray': [4, 4] } })

  map.addLayer({ id: 'shadow-fill', type: 'fill', source: 'shadow-source',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#000000', 'fill-opacity': 0.65 } })

}

function applyLayerVisibility(map, { showPath, showCenter }, eclipseType, isLunar = false) {
  const vis = v => v ? 'visible' : 'none'
  const isHybrid  = eclipseType?.[0] === 'H'
  const isPartial = !isLunar && eclipseType?.[0] === 'P'

  ;['umbra-fill','north-limit','south-limit'].forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(!isLunar && showPath && !isPartial))
  })

  if (map.getLayer('center-line'))
    map.setLayoutProperty('center-line', 'visibility', vis(!isLunar && showCenter && !isHybrid && !isPartial))

  if (map.getLayer('hybrid-annular'))
    map.setLayoutProperty('hybrid-annular', 'visibility', vis(!isLunar && showCenter && isHybrid))
  if (map.getLayer('hybrid-total'))
    map.setLayoutProperty('hybrid-total', 'visibility', vis(!isLunar && showCenter && isHybrid))

  if (map.getLayer('penumbra-fill'))
    map.setLayoutProperty('penumbra-fill', 'visibility', vis(isPartial))
  if (map.getLayer('penumbra-outline'))
    map.setLayoutProperty('penumbra-outline', 'visibility', vis(isPartial))
}

// ─── Main component ────────────────────────────────────────────────────────

export default function EclipsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { catalog, loading: catalogLoading } = useCatalog()
  const { catalog: lunarCatalog, loading: lunarLoading } = useLunarCatalog()
  const { simTime, isPlaying, setSimTime } = useSimTime()
  const { overlays, projection } = useOverlays()

  const mapContainer = useRef(null)
  const map = useRef(null)
  const simTimeRef = useRef(simTime)
  const markerRef = useRef(null)
  const greatestMarkerRef = useRef(null)
  const durationMarkerRef = useRef(null)

  const eclipseRef = useRef(null)
  const centerLineRef = useRef(null)
  const corridorRef = useRef(null)    // corridor features (escapes stale closure in handleMapClick)
  const terrainLayerRef = useRef(null)
  const lastNightUpdateRef = useRef(0)
  const weatherCacheRef = useRef({})

  const [selectedEclipse, setSelectedEclipse] = useState(null)
  const [activeTransit, setActiveTransit] = useState(null)
  const [mapError, setMapError] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [scoreData, setScoreData] = useState(null)
  const [transitPaths, setTransitPaths] = useState(null)
  const [selectedMeteor, setSelectedMeteor] = useState({ shower: null, peakDate: null })
  const [selectedPlanetaryTransit, setSelectedPlanetaryTransit] = useState(null)
  const [selectedElongation, setSelectedElongation] = useState(null)
  const [selectedConjunction, setSelectedConjunction] = useState(null)
  const [selectedOpposition, setSelectedOpposition] = useState(null)
  const [selectedHotel, setSelectedHotel]   = useState(null)

  // initialCat from URL — passed down to EclipseBrowser for auto-selection
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialCat = useMemo(() => {
    const cat = parseInt(searchParams.get('eclipse'), 10)
    return isNaN(cat) ? null : cat
  }, [])

  // ─── Adapted eclipse (with old-format fields for map code) ───────────────

  const eclipse = useMemo(() => adaptEclipse(selectedEclipse), [selectedEclipse])
  const hasPath = !!(eclipse?.centerLineCoords?.length && eclipse?.hasValidWidth)

  const centerLineFeature = useMemo(() => {
    if (!hasPath) return null
    const isPolar = eclipse.centerLineCoords.some(([, lat]) => Math.abs(lat) > 75)
    // Densify near-polar segments so globe-mode chords stay on the sphere surface.
    const coords = isPolar ? densifyPolarCoords(eclipse.centerLineCoords) : eclipse.centerLineCoords
    const rough = turf.lineString(coords)
    // Skip bezierSpline for polar paths (it oscillates wildly through the pole region).
    if (isPolar) return rough
    try {
      return turf.bezierSpline(rough, { resolution: 10000, sharpness: 0.85 })
    } catch {
      return rough
    }
  }, [selectedEclipse?.cat])

  // Full-path line for shadow animation (all segments; no bezier — just raw coords so
  // turf.along distances correspond accurately to the full pathDurationS timing).
  const animationLineFeature = useMemo(() => {
    const coords = eclipse?.animationCoords
    if (!coords || coords.length < 2) return centerLineFeature
    const isPolar = coords.some(([, lat]) => Math.abs(lat) > 75)
    return turf.lineString(isPolar ? densifyPolarCoords(coords) : coords)
  }, [selectedEclipse?.cat])

  const corridorLineFeature = useMemo(() => {
    if (!eclipse?.centerLineCoords || !eclipse?.hasValidWidth) return null
    return centerLineFeature
  }, [selectedEclipse?.cat, centerLineFeature])

  const corridorFeatures = useMemo(() => {
    if (!corridorLineFeature || !eclipse?.umbraWidth) return null
    try {
      return buildCorridorFeatures(corridorLineFeature, eclipse.umbraWidth)
    } catch {
      return null
    }
  }, [selectedEclipse?.cat, corridorLineFeature])

  // Jump simulation clock when eclipse changes.
  // Solar eclipses with a path start at path-beginning so the animation plays naturally.
  // Lunar and partial solar (no path) jump straight to peak.
  useEffect(() => {
    if (!eclipse?.date || !eclipse?.peakUTC) return
    try {
      const neg = eclipse.date.startsWith('-')
      const bare = neg ? eclipse.date.slice(1) : eclipse.date
      const [y, m, d] = bare.split('-').map(Number)
      const peak = new Date(0)
      peak.setUTCFullYear(neg ? -y : y, m - 1, d)
      const parts = eclipse.peakUTC.split(':').map(Number)
      peak.setUTCHours(parts[0], parts[1], parts[2] ?? 0, 0)
      if (eclipse.kind === 'lunar' || !eclipse.pathDurationS) {
        // Lunar or partial solar: go to peak so sky view shows the event immediately
        setSimTime(peak)
      } else {
        // Solar with path: start at beginning so the shadow animation plays from the start
        const pathStartMs = peak.getTime() - eclipse.peakFrac * eclipse.pathDurationS * 1000
        setSimTime(new Date(pathStartMs))
      }
    } catch {}
  }, [selectedEclipse?.cat])

  // Keep refs in sync for animation/click handlers (refs escape stale closures)
  useEffect(() => {
    eclipseRef.current = eclipse
    centerLineRef.current = centerLineFeature
    corridorRef.current = corridorFeatures
  }, [eclipse, centerLineFeature, corridorFeatures])

  useEffect(() => { simTimeRef.current = simTime }, [simTime])

  // ─── URL sync ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedEclipse) return
    const params = { eclipse: String(selectedEclipse.cat) }
    if (scoreData) {
      params.lat = scoreData.lat.toFixed(5)
      params.lng = scoreData.lng.toFixed(5)
    }
    setSearchParams(params, { replace: true })
  }, [selectedEclipse?.cat, scoreData])

  // ─── Map initialisation ──────────────────────────────────────────────────

  useEffect(() => {
    if (map.current) return
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) { console.warn('VITE_MAPBOX_TOKEN not set'); return }
    mapboxgl.accessToken = token

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [0, 20],
        zoom: 2,
      })
    } catch (e) {
      setMapError('Map init failed: ' + e.message)
      return
    }

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    map.current.on('error', e => {
      console.error('Mapbox error:', e)
      // Suppress tile fetch errors — these are transient and flood the UI
      if (e.error?.message?.includes('Failed to fetch') || e.sourceId) return
      setMapError('Mapbox: ' + (e.error?.message ?? ''))
    })
    map.current.on('load', () => {
      try {
        initLayers(map.current)
        setMapLoaded(true)
      } catch (e) { setMapError('Load error: ' + e.message) }
    })
    map.current.on('click', handleMapClick)

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      greatestMarkerRef.current?.remove()
      durationMarkerRef.current?.remove()
      terrainLayerRef.current = null
      map.current?.remove()
      map.current = null
    }
  }, [])

  // ─── Eclipse change → update map sources ────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current || !eclipse) return

    const isLunar   = eclipse.kind === 'lunar'
    const isHybrid  = !isLunar && eclipse.type?.[0] === 'H'
    const isPartial = !isLunar && eclipse.type?.[0] === 'P'

    const poly  = corridorFeatures?.polygon ?? EMPTY_POLY
    const north = corridorFeatures?.northLine ?? EMPTY_LINE
    const south = corridorFeatures?.southLine ?? EMPTY_LINE
    const cl    = centerLineFeature ?? EMPTY_LINE

    const startShadow = hasPath
      ? turf.circle(turf.point(eclipse.centerLineCoords[0]), eclipse.umbraWidth / 2, { steps: 64, units: 'kilometers' })
      : EMPTY_CIRCLE

    map.current.getSource('umbra-source')?.setData(poly)
    map.current.getSource('north-limit-source')?.setData(north)
    map.current.getSource('south-limit-source')?.setData(south)
    map.current.getSource('shadow-source')?.setData(startShadow)

    // Annular eclipses: shift the centerline color to a warmer amber
    const clColor = eclipse.type?.[0] === 'A' ? '#d97706' : '#f0a500'
    if (map.current.getLayer('center-line')) {
      map.current.setPaintProperty('center-line', 'line-color', clColor)
    }
    map.current.getSource('center-line-source')?.setData(cl)

    // ── Hybrid: split centerline into annular ends + total middle ────────
    if (isHybrid && centerLineFeature) {
      try {
        const totalLen = turf.length(centerLineFeature, { units: 'kilometers' })
        let d1, d2

        const ht = eclipse.hybridTransitions
        if (ht && ht.length === 2) {
          // Use the computed annular↔total transition points
          const snap1 = turf.nearestPointOnLine(centerLineFeature, turf.point(ht[0]), { units: 'kilometers' })
          const snap2 = turf.nearestPointOnLine(centerLineFeature, turf.point(ht[1]), { units: 'kilometers' })
          d1 = Math.min(snap1.properties.location, snap2.properties.location)
          d2 = Math.max(snap1.properties.location, snap2.properties.location)
          // Clamp to valid range
          d1 = Math.max(0, Math.min(d1, totalLen * 0.48))
          d2 = Math.min(totalLen, Math.max(d2, totalLen * 0.52))
        } else {
          // Fallback: 15% on each end
          d1 = totalLen * 0.15
          d2 = totalLen * 0.85
        }

        const annularStart = turf.lineSliceAlong(centerLineFeature, 0, d1, { units: 'kilometers' })
        const annularEnd   = turf.lineSliceAlong(centerLineFeature, d2, totalLen, { units: 'kilometers' })
        const totalMid     = turf.lineSliceAlong(centerLineFeature, d1, d2, { units: 'kilometers' })
        map.current.getSource('hybrid-annular-source')?.setData({
          type: 'FeatureCollection', features: [annularStart, annularEnd],
        })
        map.current.getSource('hybrid-total-source')?.setData(totalMid)
      } catch {
        map.current.getSource('hybrid-annular-source')?.setData(EMPTY_FC)
        map.current.getSource('hybrid-total-source')?.setData(EMPTY_LINE)
      }
    } else {
      map.current.getSource('hybrid-annular-source')?.setData(EMPTY_FC)
      map.current.getSource('hybrid-total-source')?.setData(EMPTY_LINE)
    }

    // ── Partial: penumbra circle around greatest eclipse point ───────────
    if (isPartial && eclipse.greatest) {
      // Scale radius by magnitude: mag≈1 → ~3800 km, mag≈0 → ~400 km
      const mag = eclipse.mag ?? 0.5
      const penumbraRadiusKm = Math.round(400 + mag * 3400)
      const penumbra = turf.circle(turf.point(eclipse.greatest), penumbraRadiusKm, { steps: 80, units: 'kilometers' })
      map.current.getSource('penumbra-source')?.setData(penumbra)
    } else {
      map.current.getSource('penumbra-source')?.setData(EMPTY_POLY)
    }

    // ── Lunar: visibility zones — cleared here, populated by the async effect below ──
    const LUNAR_ZONE_KEYS = ['pen', 'part', 'tot', 'enttot', 'entpart', 'entecl']
    for (const key of LUNAR_ZONE_KEYS) {
      map.current.getSource(`lunar-${key}-source`)?.setData(EMPTY_POLY)
      if (map.current.getLayer(`lunar-${key}-fill`))    map.current.setLayoutProperty(`lunar-${key}-fill`,    'visibility', 'none')
      if (map.current.getLayer(`lunar-${key}-outline`)) map.current.setLayoutProperty(`lunar-${key}-outline`, 'visibility', 'none')
    }

    // ── Greatest eclipse pin ─────────────────────────────────────────────
    if (greatestMarkerRef.current) { greatestMarkerRef.current.remove(); greatestMarkerRef.current = null }
    if (eclipse.greatest && !isPartial && overlays.greatestEclipse) {
      const el = document.createElement('div')
      el.className = 'eclipse-greatest-pin'
      greatestMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(eclipse.greatest)
        .addTo(map.current)
    }

    // ── Greatest duration pin ────────────────────────────────────────────
    if (durationMarkerRef.current) { durationMarkerRef.current.remove(); durationMarkerRef.current = null }
    const durPoint = eclipse.durationAtPoints?.[0]
    if (durPoint && !isPartial && overlays.greatestDuration) {
      const el = document.createElement('div')
      el.className = 'eclipse-duration-pin'
      durationMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(durPoint.coords)
        .addTo(map.current)
    }

    setScoreData(null)
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }

    applyLayerVisibility(map.current, { showPath: overlays.eclipsePath, showCenter: overlays.eclipseCenter }, eclipse.type, eclipse.kind === 'lunar')
    map.current.flyTo({ center: eclipse.defaultCenter, zoom: eclipse.defaultZoom, duration: 1200 })
  }, [selectedEclipse?.cat, mapLoaded])

  // ─── Lunar visibility zones (async — buildLunarZones yields between operations) ──

  useEffect(() => {
    if (!mapLoaded || !map.current || !eclipse || eclipse.kind !== 'lunar') return
    let cancelled = false
    const LUNAR_ZONE_KEYS = ['pen', 'part', 'tot', 'enttot', 'entpart', 'entecl']
    buildLunarZones(eclipse).then(zones => {
      if (cancelled || !map.current) return
      const zoneMap = {
        pen: zones?.somePen, part: zones?.somePart, tot: zones?.someTot,
        enttot: zones?.entireTot, entpart: zones?.entirePart, entecl: zones?.entireEcl,
      }
      for (const key of LUNAR_ZONE_KEYS) {
        const data = zoneMap[key]
        map.current.getSource(`lunar-${key}-source`)?.setData(data ?? EMPTY_POLY)
        const v = data ? 'visible' : 'none'
        if (map.current.getLayer(`lunar-${key}-fill`))    map.current.setLayoutProperty(`lunar-${key}-fill`,    'visibility', v)
        if (map.current.getLayer(`lunar-${key}-outline`)) map.current.setLayoutProperty(`lunar-${key}-outline`, 'visibility', v)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [selectedEclipse?.cat, mapLoaded])

  // ─── Layer visibility ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    applyLayerVisibility(map.current, { showPath: overlays.eclipsePath, showCenter: overlays.eclipseCenter }, eclipse?.type, eclipse?.kind === 'lunar')
  }, [overlays.eclipsePath, overlays.eclipseCenter, mapLoaded, eclipse?.type, eclipse?.kind])

  // ─── Greatest eclipse / duration marker visibility ───────────────────────

  useEffect(() => {
    if (!eclipse || eclipse.type?.[0] === 'P') return
    // Greatest eclipse marker
    if (greatestMarkerRef.current) {
      greatestMarkerRef.current.getElement().style.display = overlays.greatestEclipse ? '' : 'none'
    } else if (overlays.greatestEclipse && eclipse.greatest && map.current) {
      const el = document.createElement('div')
      el.className = 'eclipse-greatest-pin'
      greatestMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(eclipse.greatest).addTo(map.current)
    }
    // Greatest duration marker
    const durPoint = eclipse.durationAtPoints?.[0]
    if (durationMarkerRef.current) {
      durationMarkerRef.current.getElement().style.display = overlays.greatestDuration ? '' : 'none'
    } else if (overlays.greatestDuration && durPoint && map.current) {
      const el = document.createElement('div')
      el.className = 'eclipse-duration-pin'
      durationMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(durPoint.coords).addTo(map.current)
    }
  }, [overlays.greatestEclipse, overlays.greatestDuration, eclipse])

  // ─── Shadow driven by simTime ─────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    if (!eclipse?.animationCoords || !eclipse?.animationTimestamps) return
    if (!map.current.getLayer('shadow-fill')) return

    const ts = eclipse.animationTimestamps
    const rawCoords = eclipse.animationCoords
    const tNow = simTime.getTime()

    if (tNow < ts[0] || tNow > ts[ts.length - 1]) {
      map.current.setLayoutProperty('shadow-fill', 'visibility', 'none')
      return
    }

    map.current.setLayoutProperty('shadow-fill', 'visibility', 'visible')

    // Binary search for the surrounding timestamp pair
    let lo = 0, hi = ts.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (ts[mid] <= tNow) lo = mid; else hi = mid
    }
    const frac = (tNow - ts[lo]) / (ts[hi] - ts[lo])
    const lon = rawCoords[lo][0] + frac * (rawCoords[hi][0] - rawCoords[lo][0])
    const lat = rawCoords[lo][1] + frac * (rawCoords[hi][1] - rawCoords[lo][1])
    const shadow = turf.circle(turf.point([lon, lat]), eclipse.umbraWidth / 2, { steps: 64, units: 'kilometers' })
    map.current.getSource('shadow-source')?.setData(shadow)
  }, [simTime, mapLoaded, selectedEclipse?.cat])

  // ─── Day / night terminator ──────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    const wallNow = Date.now()
    if (wallNow - lastNightUpdateRef.current < 100) return
    lastNightUpdateRef.current = wallNow
    try {
      map.current.getSource('night-source')?.setData(getNightPolygon(simTime))
    } catch {}
  }, [simTime, mapLoaded])

  // ─── Terrain shadow ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    if (!overlays.terrainShadow) {
      if (terrainLayerRef.current) {
        if (map.current.getLayer('terrain-shadow')) map.current.removeLayer('terrain-shadow')
        terrainLayerRef.current = null
      }
      return
    }
    if (terrainLayerRef.current) return

    const layer = new TerrainShadowLayer()
    terrainLayerRef.current = layer
    map.current.addLayer(layer, 'night-fill')
    layer.setDate(simTime)

    const onMoveEnd = () => terrainLayerRef.current?.refresh()
    map.current.on('moveend', onMoveEnd)
    return () => { map.current?.off('moveend', onMoveEnd) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, overlays.terrainShadow])

  // Update sun position when time changes while layer is active
  useEffect(() => {
    if (!terrainLayerRef.current || !overlays.terrainShadow) return
    terrainLayerRef.current.setDate(simTime)
  }, [simTime, overlays.terrainShadow])

  // ─── Overlay layer visibility ────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    const vis = v => v ? 'visible' : 'none'
    ;[
      ['night-fill',     overlays.night],
      ['equator-line',      overlays.equator],
      ['tropics-line',      overlays.tropics],
      ['timezones-line',    overlays.timezones],
      ['city-lights-raster',     overlays.cityLights],
      ['sqm-raster',             overlays.lightPollution],
      ['iss-path-past-line',     overlays.issPath      && simTime.getTime() >= ISS_LAUNCH_MS],
      ['iss-path-future-line',   overlays.issPath      && simTime.getTime() >= ISS_LAUNCH_MS],
      ['iss-visibility-fill',    overlays.issIndicator && simTime.getTime() >= ISS_LAUNCH_MS],
      ['iss-visibility-line',    overlays.issIndicator && simTime.getTime() >= ISS_LAUNCH_MS],
    ].forEach(([id, show]) => {
      if (map.current.getLayer(id)) map.current.setLayoutProperty(id, 'visibility', vis(show))
    })
  }, [overlays, mapLoaded, simTime])

  // ─── ISS ground track + visibility footprint ─────────────────────────────
  // Driven by simTime so the ISS moves with the simulation clock.
  // When simTime is outside ±14 days of the TLE epoch SGP4 diverges —
  // we clear the sources rather than show garbage positions.

  useEffect(() => {
    if (!mapLoaded || !map.current) return

    const clearAll = () => {
      map.current.getSource('iss-path-past-source')?.setData(EMPTY_ISS_PATH)
      map.current.getSource('iss-path-future-source')?.setData(EMPTY_ISS_PATH)
      map.current.getSource('iss-visibility-source')?.setData(EMPTY_POLY)
    }

    if (!overlays.issPath && !overlays.issIndicator) { clearAll(); return }
    if (simTime.getTime() < ISS_LAUNCH_MS) { clearAll(); return }

    let cancelled = false
    const draw = () => {
      if (cancelled || !map.current) return

      if (overlays.issPath) {
        const phases = getIssGroundTrackPhases(simTime)
        map.current.getSource('iss-path-past-source')?.setData(issPathGeoJSON(phases.past))
        map.current.getSource('iss-path-future-source')?.setData(issPathGeoJSON(phases.future))
      } else {
        map.current.getSource('iss-path-past-source')?.setData(EMPTY_ISS_PATH)
        map.current.getSource('iss-path-future-source')?.setData(EMPTY_ISS_PATH)
      }

      if (overlays.issIndicator) {
        const status = getIssVisibilityStatus(simTime, scoreData?.lat, scoreData?.lng)
        const pos = status.pos ?? getIssPosition(simTime)
        if (!pos) {
          map.current.getSource('iss-visibility-source')?.setData(EMPTY_POLY)
        } else {
          const radiusKm = getIssVisibilityRadiusKm(pos.altKm, 10)
          const circle = turf.circle(
            turf.point([pos.lng, pos.lat]),
            Math.max(radiusKm, 10),
            { steps: 64, units: 'kilometers' },
          )
          circle.properties = { status: status.status, label: status.label }
          map.current.getSource('iss-visibility-source')?.setData(circle)
        }
      } else {
        map.current.getSource('iss-visibility-source')?.setData(EMPTY_POLY)
      }
    }

    // Draw with live TLE as soon as it's ready; redraw once the historical
    // archive arrives (no-op re-resolve after first load).
    loadIssTle().then(draw)
    loadIssArchive().then(draw)

    return () => { cancelled = true }
  }, [simTime, mapLoaded, overlays.issPath, overlays.issIndicator, scoreData?.lat, scoreData?.lng])

  // ─── Transit paths ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    const empty = { type: 'FeatureCollection', features: [] }
    map.current.getSource('transit-path-source')?.setData(transitPaths?.centerlines ?? empty)
    map.current.getSource('transit-band-source')?.setData(transitPaths?.bands ?? empty)
  }, [transitPaths, mapLoaded])

  // ─── Meteor shower visibility zones ─────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    const src = map.current.getSource('planetary-transit-source')
    if (!src) return
    if (!selectedPlanetaryTransit) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    try {
      src.setData(getDayPolygon(new Date(selectedPlanetaryTransit.date + 'T12:00:00Z')))
    } catch {
      src.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [selectedPlanetaryTransit, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    const src = map.current.getSource('meteor-source')
    if (!src) return
    if (!selectedMeteor.shower) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    try {
      src.setData(meteorGeoJSON(selectedMeteor.shower, selectedMeteor.peakDate))
    } catch {
      src.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [selectedMeteor, mapLoaded])

  // ─── Projection ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !map.current) return
    map.current.setProjection(projection)
  }, [projection, mapLoaded])

  // ─── Map click ───────────────────────────────────────────────────────────

  const handleMapClick = useCallback((e) => {
    const { lng, lat } = e.lngLat
    handleLocationSelect(lng, lat)
  }, [])

  async function handleLocationSelect(lng, lat) {
    const ec = eclipseRef.current

    if (markerRef.current) markerRef.current.remove()
    const el = document.createElement('div')
    el.className = 'eclipse-pin'
    markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat]).addTo(map.current)

    if (!ec) {
      let placeName = `${lat.toFixed(3)}, ${lng.toFixed(3)}`
      try {
        const gcUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,region,country&access_token=${mapboxgl.accessToken}`
        const gcRes = await fetch(gcUrl)
        const gcJson = await gcRes.json()
        if (gcJson.features?.length) placeName = gcJson.features[0].place_name
      } catch {}
      setScoreData({ lat, lng, placeName, inPath: false, score: 0,
        cloudPct: null, yearBreakdown: [], durationSeconds: null, sunAltDeg: null, sunCardinal: '—' })
      return
    }

    // Sun position at eclipse peak (for scoring)
    let altDeg = 0, cardinal = '—'
    try {
      const neg = ec.date.startsWith('-')
      const bare = neg ? ec.date.slice(1) : ec.date
      const [y, m, d] = bare.split('-').map(Number)
      const peakDate = new Date(0)
      peakDate.setUTCFullYear(neg ? -y : y, m - 1, d)
      const tp = ec.peakUTC.split(':').map(Number)
      peakDate.setUTCHours(tp[0], tp[1], tp[2] ?? 0, 0)
      const pos = SunCalc.getPosition(peakDate, lat, lng)
      const compassDeg = ((pos.azimuth * 180 / Math.PI) + 180 + 360) % 360
      const cardinals = ['N','NE','E','SE','S','SW','W','NW']
      cardinal = `${cardinals[Math.round(compassDeg / 45) % 8]} (${Math.round(compassDeg)}°)`
      altDeg = Math.round(pos.altitude * 180 / Math.PI)
    } catch {}

    // In-path check — use ref to escape stale closure from useCallback
    let inPath = false
    if (corridorRef.current?.polygon) {
      inPath = turf.booleanPointInPolygon(turf.point([lng, lat]), corridorRef.current.polygon)
    }

    const durationSeconds = inPath ? interpolateDuration(lat, lng, ec.durationAtPoints) : null

    // Weather
    let cloudData = { cloudPct: null, yearBreakdown: [] }
    if (canFetchWeather(ec)) {
      const cacheKey = `${(Math.round(lat * 2) / 2).toFixed(1)},${(Math.round(lng * 2) / 2).toFixed(1)},${ec.cat}`
      if (!weatherCacheRef.current[cacheKey]) {
        weatherCacheRef.current[cacheKey] = await fetchCloudForPoint(lat, lng, ec)
      }
      cloudData = weatherCacheRef.current[cacheKey]
    }

    let score = 0
    if (inPath) {
      const cloudScore = (100 - (cloudData.cloudPct ?? 50)) * 0.35
      const altScore = Math.min(altDeg / 90, 1) * 15
      score = Math.round(50 + cloudScore + altScore)
    }

    let placeName = `${lat.toFixed(3)}, ${lng.toFixed(3)}`
    try {
      const gcUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,region,country&access_token=${mapboxgl.accessToken}`
      const gcRes = await fetch(gcUrl)
      const gcJson = await gcRes.json()
      if (gcJson.features?.length) placeName = gcJson.features[0].place_name
    } catch { /* keep coordinate fallback */ }

    setScoreData({
      lat, lng, placeName, inPath, score,
      cloudPct: cloudData.cloudPct,
      yearBreakdown: cloudData.yearBreakdown,
      durationSeconds,
      sunAltDeg: altDeg,
      sunCardinal: cardinal,
    })
  }

  // ─── Restore pinned location from URL ────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !eclipse) return
    const urlLat = parseFloat(searchParams.get('lat'))
    const urlLng = parseFloat(searchParams.get('lng'))
    if (!isNaN(urlLat) && !isNaN(urlLng)) handleLocationSelect(urlLng, urlLat)
  }, [mapLoaded, eclipse?.cat])

  const handleSelect = useCallback(e => setSelectedEclipse(e), [])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="eclipse-page">
      <div ref={mapContainer} className="eclipse-map" />
{overlays.subSolar  && <SunIndicator  map={mapLoaded ? map.current : null} onFlyTo={([lng, lat]) => map.current?.flyTo({ center: [lng, lat], zoom: 3, duration: 1200 })} />}
      {overlays.subLunar  && <MoonIndicator map={mapLoaded ? map.current : null} onFlyTo={([lng, lat]) => map.current?.flyTo({ center: [lng, lat], zoom: 3, duration: 1200 })} />}
      {overlays.issIndicator && simTime.getTime() >= ISS_LAUNCH_MS && <IssIndicator map={mapLoaded ? map.current : null} onFlyTo={([lng, lat]) => map.current?.flyTo({ center: [lng, lat], zoom: 4, duration: 1200 })} lat={scoreData?.lat} lng={scoreData?.lng} />}
      <ErrorBoundary name="SolarSystem"><SolarSystem /></ErrorBoundary>
      {overlays.lightPollution && <BortleLegend />}
      <WeatherLayer
        map={mapLoaded ? map.current : null}
        mapLoaded={mapLoaded}
        overlays={overlays}
      />
      <WeatherLegend overlays={overlays} />
      <WindParticles map={mapLoaded ? map.current : null} mapLoaded={mapLoaded} visible={overlays.weatherWindPtcl} />
      <HotelLayer
        map={mapLoaded ? map.current : null}
        mapLoaded={mapLoaded}
        eclipse={eclipse}
        visible={overlays.hotels}
        onSelectHotel={setSelectedHotel}
      />
      {selectedHotel && <HotelCard hotel={selectedHotel} onClose={() => setSelectedHotel(null)} />}

      <div className="time-bar-group">
        <TimeBar />
        <TimeScrubber />
      </div>

      {mapError && (
        <div style={{ position:'absolute', top:'1rem', left:'50%', transform:'translateX(-50%)', background:'#f9f9f7', border:'1px solid #e0e0dc', borderRadius:4, padding:'1.25rem 1.5rem', zIndex:999, maxWidth:420, fontSize:'0.875rem', lineHeight:1.6 }}>
          {mapError.includes('WebGL') ? (
            <><strong>WebGL is blocked</strong><p style={{ color:'#5c5c5c', marginTop:'0.5rem' }}>Enable WebGL in your browser settings, then reload.</p></>
          ) : (
            <><strong>Map error:</strong> {mapError}</>
          )}
        </div>
      )}

      <LeftPanel
        catalog={catalog}
        loading={catalogLoading}
        lunarCatalog={lunarCatalog}
        lunarLoading={lunarLoading}
        initialCat={initialCat}
        onSelectEclipse={eclipse => { setActiveTransit(null); handleSelect(eclipse) }}
        selectedEclipse={selectedEclipse}
        activeTransit={activeTransit}
        scoreData={scoreData}
        onSelectIssPass={pass => {
          setSimTime(pass.start)
          const pos = getIssPosition(pass.start)
          if (pos) map.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 3.2, duration: 1000 })
        }}
        onTransitPaths={setTransitPaths}
        onSelectTransit={tr => {
          setActiveTransit(tr)
          setSimTime(tr.midTime)
          const mid = tr.path?.length > 0 ? tr.path[Math.floor(tr.path.length / 2)] : null
          if (mid) map.current?.flyTo({ center: mid, zoom: 9, duration: 1200 })
        }}
        onSelectPlace={(lng, lat) => {
          map.current?.flyTo({ center: [lng, lat], zoom: 9, duration: 1000 })
          handleLocationSelect(lng, lat)
        }}
        selectedMeteor={selectedMeteor}
        onSelectMeteor={(shower, peakDate) => {
          setSelectedMeteor({ shower, peakDate })
          if (shower) {
            setSimTime(peakDate)
            map.current?.flyTo({ center: [0, Math.max(-60, Math.min(60, shower.dec))], zoom: 1.5, duration: 1200 })
          }
        }}
        selectedPlanetaryTransit={selectedPlanetaryTransit}
        onSelectPlanetaryTransit={t => {
          setSelectedPlanetaryTransit(t)
          if (t) setSimTime(new Date(t.peak))
        }}
        selectedElongation={selectedElongation}
        onSelectElongation={e => {
          setSelectedElongation(e)
          if (e) setSimTime(new Date(e.date))
        }}
        selectedConjunction={selectedConjunction}
        onSelectConjunction={e => {
          setSelectedConjunction(e)
          if (e) setSimTime(new Date(e.date))
        }}
        selectedOpposition={selectedOpposition}
        onSelectOpposition={e => {
          setSelectedOpposition(e)
          if (e) setSimTime(new Date(e.date))
        }}
      />

      <LocationPanel
        scoreData={scoreData}
        eclipseKind={selectedEclipse?.kind ?? 'solar'}
        onClose={() => { setScoreData(null); if (markerRef.current) { markerRef.current.remove(); markerRef.current = null } }}
        onSelectPlace={(lng, lat) => {
          map.current?.flyTo({ center: [lng, lat], zoom: 9, duration: 1000 })
          handleLocationSelect(lng, lat)
        }}
      />
    </div>
  )
}
