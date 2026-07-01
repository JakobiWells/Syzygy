import { useEffect, useRef, useState } from 'react'
import * as turf from '@turf/turf'

const HOTELS_BASE = import.meta.env.VITE_HOTELS_PROXY_URL ?? 'http://localhost:8788'
const SAMPLE_KM   = 150

function samplePath(coords, intervalKm) {
  if (!coords?.length) return []
  const line  = turf.lineString(coords)
  const total = turf.length(line, { units: 'kilometers' })
  const pts   = []
  for (let d = 0; d <= total; d += intervalKm)
    pts.push(turf.along(line, d, { units: 'kilometers' }).geometry.coordinates)
  return pts
}

function fmtDate(date) { return date.toISOString().slice(0, 10) }

export default function HotelLayer({ map, mapLoaded, eclipse, visible, onSelectHotel }) {
  const [hotels, setHotels] = useState([])
  const fetchedRef = useRef(null)

  useEffect(() => {
    if (!visible || !eclipse?.centerLineCoords?.length || !eclipse?.date) {
      setHotels([]); return
    }

    const eclipseDate = new Date(eclipse.date)
    const checkin     = fmtDate(eclipseDate)
    const nextDay     = new Date(eclipseDate); nextDay.setDate(nextDay.getDate() + 1)
    const checkout    = fmtDate(nextDay)
    const key         = `${eclipse.cat}-${checkin}`
    if (fetchedRef.current === key) return
    fetchedRef.current = key
    setHotels([])

    const samplePoints = samplePath(eclipse.centerLineCoords, SAMPLE_KM)
    if (!samplePoints.length) return

    let cancelled = false
    fetch(`${HOTELS_BASE}/hotels`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ eclipseCat: String(eclipse.cat), checkin, checkout, samplePoints }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setHotels(data.hotels ?? []) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [visible, eclipse?.cat, eclipse?.date])

  // Add/update map markers
  useEffect(() => {
    if (!mapLoaded || !map) return

    const SOURCE = 'hotel-markers'
    const LAYER  = 'hotel-layer'

    const geojson = {
      type: 'FeatureCollection',
      features: hotels.map(h => ({
        type: 'Feature',
        geometry:   { type: 'Point', coordinates: [h.lng, h.lat] },
        properties: { id: h.place_id },
      })),
    }

    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: 'geojson', data: geojson })
      map.addLayer({
        id: LAYER, type: 'circle', source: SOURCE,
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 10],
          'circle-color':        '#f472b6',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-opacity':      0.9,
        },
      })
      map.on('click', LAYER, e => {
        const id    = e.features?.[0]?.properties?.id
        const hotel = hotels.find(h => h.place_id === id)
        if (hotel) onSelectHotel(hotel)
      })
      map.on('mouseenter', LAYER, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER, () => { map.getCanvas().style.cursor = '' })
    } else {
      map.getSource(SOURCE).setData(geojson)
    }

    map.setLayoutProperty(LAYER, 'visibility', visible && hotels.length ? 'visible' : 'none')

    return () => {
      try { if (map.getLayer(LAYER))   map.removeLayer(LAYER)   } catch {}
      try { if (map.getSource(SOURCE)) map.removeSource(SOURCE) } catch {}
    }
  }, [map, mapLoaded, hotels, visible])

  return null
}
