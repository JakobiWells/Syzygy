import { createContext, useContext, useState, useCallback } from 'react'

const OverlaysContext = createContext(null)

// ── Layer catalog, grouped for the Layers panel ─────────────────────────────
// `exclusive: true` on a group means its raster members behave like radio
// buttons (stacked weather rasters are illegible); items with `independent`
// opt out of that behavior.

export const OVERLAY_GROUPS = [
  {
    id: 'map',
    label: 'Map',
    items: [
      { key: 'night',         label: 'Night shade',    color: '#3b5280' },
      { key: 'terrainShadow', label: 'Terrain shadow', color: '#555555' },
      { key: 'cityLights',    label: 'City lights',    color: '#fbbf24' },
      { key: 'equator',       label: 'Equator',        color: '#22c55e' },
      { key: 'tropics',       label: 'Tropics',        color: '#f0a500' },
      { key: 'timezones',     label: 'Time zones',     color: '#888888' },
    ],
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    items: [
      { key: 'eclipsePath',      label: 'Shadow path',       color: '#1a1a1a' },
      { key: 'eclipseCenter',    label: 'Center line',       color: '#f97316' },
      { key: 'greatestEclipse',  label: 'Greatest eclipse',  color: '#f0a500' },
      { key: 'greatestDuration', label: 'Greatest duration', color: '#7c3aed' },
      { key: 'subSolar',         label: 'Sub-solar point',   color: '#f59e0b' },
      { key: 'subLunar',         label: 'Sub-lunar point',   color: '#94a3b8' },
    ],
  },
  {
    id: 'satellites',
    label: 'Satellites',
    items: [
      { key: 'issIndicator', label: 'ISS indicator', color: '#0ea5e9' },
      { key: 'issPath',      label: 'ISS path',      color: '#0ea5e9' },
    ],
  },
  {
    id: 'weather',
    label: 'Weather',
    items: [
      { key: 'weatherRadar',    label: 'Radar (live)',   color: '#4ade80' },
      { key: 'weatherWindPtcl', label: 'Wind particles', color: '#c4b5fd' },
    ],
  },
  {
    id: 'data',
    label: 'Data maps',
    items: [
      { key: 'aurora',         label: 'Aurora forecast', color: '#34d399' },
      { key: 'lightPollution', label: 'Light pollution', color: '#60a5fa' },
      { key: 'hotels',         label: 'Hotels',          color: '#f472b6' },
    ],
  },
]

// Flat list (legacy consumers + URL serialization)
export const OVERLAY_ITEMS = OVERLAY_GROUPS.flatMap(g => g.items)

export const OVERLAY_DEFAULTS = {
  night: true,
  terrainShadow: false,
  eclipsePath: true,
  eclipseCenter: true,
  greatestEclipse: true,
  greatestDuration: false,
  subSolar: false,
  subLunar: false,
  issIndicator: true,
  issPath: true,
  equator: false,
  tropics: false,
  timezones: false,
  cityLights: false,
  aurora: false,
  lightPollution: false,
  hotels:          false,
  weatherRadar:    false,
  weatherWindPtcl: false,
}

// Keys that turn each other off (stacked rasters are unreadable)
const EXCLUSIVE_KEYS = OVERLAY_GROUPS
  .filter(g => g.exclusive)
  .flatMap(g => g.items.filter(i => !i.independent).map(i => i.key))

export function OverlaysProvider({ children }) {
  const [overlays, setOverlays] = useState(OVERLAY_DEFAULTS)
  const [projection, setProjection] = useState('globe')

  const toggleOverlay = useCallback((key) => {
    setOverlays(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // Turning ON an exclusive layer turns its siblings off
      if (next[key] && EXCLUSIVE_KEYS.includes(key)) {
        for (const k of EXCLUSIVE_KEYS) if (k !== key) next[k] = false
      }
      return next
    })
  }, [])

  // Bulk apply (URL restore): merge a partial { key: bool } patch
  const setOverlaysBulk = useCallback((patch) => {
    setOverlays(prev => ({ ...prev, ...patch }))
  }, [])

  return (
    <OverlaysContext.Provider value={{ overlays, toggleOverlay, setOverlaysBulk, projection, setProjection }}>
      {children}
    </OverlaysContext.Provider>
  )
}

export function useOverlays() {
  return useContext(OverlaysContext)
}
