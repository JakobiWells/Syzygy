import { useEffect, useRef } from 'react'
import { useSimTime } from '../time/TimeContext'

const PROXY_BASE = import.meta.env.VITE_WEATHER_PROXY_URL ?? 'http://localhost:8787'

// OWM Maps 2.0 updates on 3-hour intervals — round to nearest 3h so tile URLs
// stay stable within a window and edge cache stays effective.
function roundTo3h(date) {
  const ms = date.getTime()
  return Math.round(ms / (3 * 3_600_000)) * 3 * 3600 // unix seconds
}

function owmUrl(layer, date) {
  return `${PROXY_BASE}/tiles/v2/${layer}/{z}/{x}/{y}.png?date=${roundTo3h(date)}`
}

const LAYERS = [
  {
    key:      'weatherRadar',
    sourceId: 'wx-radar',
    layerId:  'wx-radar-layer',
    owmLayer: 'precipitation_new',
    paint:    { 'raster-opacity': 0.9, 'raster-saturation': 0.6, 'raster-contrast': 0.4 },
  },
  {
    key:      'weatherPrecip',
    sourceId: 'wx-precip',
    layerId:  'wx-precip-layer',
    owmLayer: 'precipitation_new',
    paint:    { 'raster-opacity': 0.75, 'raster-saturation': 0.4, 'raster-contrast': 0.2 },
  },
  {
    key:      'weatherCloud',
    sourceId: 'wx-cloud',
    layerId:  'wx-cloud-layer',
    owmLayer: 'clouds_new',
    paint:    { 'raster-opacity': 0.88, 'raster-saturation': -1, 'raster-brightness-min': 0, 'raster-brightness-max': 0.05 },
  },
  {
    key:      'weatherTemp',
    sourceId: 'wx-temp',
    layerId:  'wx-temp-layer',
    owmLayer: 'temp_new',
    paint:    { 'raster-opacity': 0.75, 'raster-saturation': 0.4, 'raster-contrast': 0.2 },
  },
  {
    key:      'weatherWind',
    sourceId: 'wx-wind',
    layerId:  'wx-wind-layer',
    owmLayer: 'wind_new',
    paint:    { 'raster-opacity': 0.8, 'raster-saturation': 0.3, 'raster-contrast': 0.2 },
  },
  {
    key:      'weatherPressure',
    sourceId: 'wx-pressure',
    layerId:  'wx-pressure-layer',
    owmLayer: 'pressure_new',
    paint:    { 'raster-opacity': 0.75, 'raster-saturation': 0.3, 'raster-contrast': 0.2 },
  },
]

function addLayer(map, sourceId, layerId, url, paint) {
  if (!map.getSource(sourceId))
    map.addSource(sourceId, { type: 'raster', tiles: [url], tileSize: 256, attribution: '© OpenWeatherMap' })
  if (!map.getLayer(layerId))
    map.addLayer({ id: layerId, type: 'raster', source: sourceId, paint, layout: { visibility: 'none' } })
}

export default function WeatherLayer({ map, mapLoaded, overlays }) {
  const { simTime } = useSimTime()
  const prev3h = useRef(null)

  // Add sources and layers once
  useEffect(() => {
    if (!mapLoaded || !map) return
    for (const { sourceId, layerId, owmLayer, paint } of LAYERS)
      addLayer(map, sourceId, layerId, owmUrl(owmLayer, simTime), paint)

    return () => {
      for (const { sourceId, layerId } of LAYERS) {
        try { if (map.getLayer(layerId))   map.removeLayer(layerId)   } catch {}
        try { if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
      }
    }
  }, [map, mapLoaded])

  // Sync visibility + update tile URLs when the 3-hour window rolls over
  useEffect(() => {
    if (!mapLoaded || !map) return

    const t3h = roundTo3h(simTime)
    const timeChanged = t3h !== prev3h.current
    prev3h.current = t3h

    for (const { key, sourceId, layerId, owmLayer, paint } of LAYERS) {
      const visible = !!overlays[key]

      if (!map.getSource(sourceId)) {
        addLayer(map, sourceId, layerId, owmUrl(owmLayer, simTime), paint)
      } else if (timeChanged) {
        map.getSource(sourceId).setTiles([owmUrl(owmLayer, simTime)])
      }

      if (map.getLayer(layerId))
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, mapLoaded, overlays, simTime])

  return null
}
