import { useEffect, useState } from 'react'

// Aurora viewing potential from NOAA SWPC's OVATION model — a global 1°×1°
// grid of aurora probabilities, updated every ~5 minutes, forecasting the
// next ~30–90 minutes. Rendered as a smooth heatmap over both poles.
// This is a live/near-term forecast — it does not follow the sim clock.

const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
const REFRESH_MS  = 10 * 60_000
const MIN_PROB    = 4          // skip near-zero cells (grid is 360×181)

function ovationToGeoJSON(data) {
  const features = []
  for (const [lon, lat, prob] of data.coordinates ?? []) {
    if (prob < MIN_PROB) continue
    features.push({
      type: 'Feature',
      properties: { prob },
      geometry: { type: 'Point', coordinates: [lon > 180 ? lon - 360 : lon, lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}

export default function AuroraLayer({ map, mapLoaded, visible }) {
  const [geojson, setGeojson] = useState(null)
  const [observed, setObserved] = useState(null)

  useEffect(() => {
    if (!visible) return
    let alive = true
    async function load() {
      try {
        const data = await (await fetch(OVATION_URL)).json()
        if (!alive) return
        setGeojson(ovationToGeoJSON(data))
        setObserved(data['Observation Time'] ?? null)
      } catch { /* keep previous */ }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [visible])

  useEffect(() => {
    if (!mapLoaded || !map) return
    if (!map.getSource('aurora-source')) {
      map.addSource('aurora-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'aurora-heat',
        type: 'heatmap',
        source: 'aurora-source',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'prob'], 0, 0, 100, 1],
          'heatmap-intensity': 0.9,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 4, 30, 8, 90],
          'heatmap-opacity': 0.75,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(16, 185, 129, 0)',
            0.15, 'rgba(16, 185, 129, 0.25)',
            0.4,  'rgba(52, 211, 153, 0.55)',
            0.65, 'rgba(163, 230, 53, 0.7)',
            0.85, 'rgba(250, 204, 21, 0.8)',
            1,    'rgba(239, 68, 68, 0.85)',
          ],
        },
      })
    }
    if (geojson) map.getSource('aurora-source')?.setData(geojson)
    if (map.getLayer('aurora-heat')) {
      map.setLayoutProperty('aurora-heat', 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, mapLoaded, geojson, visible])

  if (!visible) return null
  return (
    <div className="aurora-legend">
      <div className="aurora-legend-title">Aurora viewing potential</div>
      <div className="aurora-legend-grad" />
      <div className="aurora-legend-scale"><span>low</span><span>chance</span><span>high</span></div>
      <div className="aurora-legend-note">
        NOAA OVATION forecast (next ~30–90 min){observed ? ` · obs ${observed.slice(11, 16)} UTC` : ''} — live only
      </div>
    </div>
  )
}
