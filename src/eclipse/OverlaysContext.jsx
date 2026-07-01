import { createContext, useContext, useState, useCallback } from 'react'

const OverlaysContext = createContext(null)

export const OVERLAY_ITEMS = [
  { key: 'night',           label: 'Night shade',       color: '#3b5280' },
  { key: 'terrainShadow',   label: 'Terrain shadow',    color: '#555555' },
  { key: 'eclipsePath',     label: 'Eclipse path',      color: '#1a1a1a' },
  { key: 'eclipseCenter',   label: 'Center line',       color: '#f0a500' },
  { key: 'greatestEclipse', label: 'Greatest eclipse',  color: '#f0a500' },
  { key: 'greatestDuration',label: 'Greatest duration', color: '#7c3aed' },
  { key: 'subSolar',        label: 'Sub-solar point',   color: '#f59e0b' },
  { key: 'subLunar',        label: 'Sub-lunar point',   color: '#94a3b8' },
  { key: 'issIndicator',    label: 'ISS indicator',     color: '#0ea5e9' },
  { key: 'issPath',         label: 'ISS path',          color: '#0ea5e9' },
  { key: 'equator',         label: 'Equator',           color: '#22c55e' },
  { key: 'tropics',         label: 'Tropics',           color: '#f0a500' },
  { key: 'timezones',       label: 'Time zones',        color: '#888888' },
  { key: 'cityLights',      label: 'City lights',       color: '#fbbf24' },
  { key: 'lightPollution',  label: 'Light pollution',   color: '#60a5fa' },
  { key: 'weatherRadar',    label: 'Radar',             color: '#4ade80' },
  { key: 'hotels',          label: 'Hotels',             color: '#f472b6' },
  { key: 'weatherPrecip',   label: 'Precipitation',     color: '#34d399' },
  { key: 'weatherCloud',    label: 'Cloud cover',       color: '#93c5fd' },
  { key: 'weatherTemp',     label: 'Temperature',       color: '#f97316' },
  { key: 'weatherWind',     label: 'Wind speed',        color: '#a78bfa' },
  { key: 'weatherWindPtcl',label: 'Wind particles',    color: '#c4b5fd' },
  { key: 'weatherPressure', label: 'Pressure',          color: '#fb923c' },
]

const DEFAULTS = {
  night: true,
  terrainShadow: false,
  eclipsePath: true,
  eclipseCenter: true,
  greatestEclipse: true,
  greatestDuration: false,
  subSolar: true,
  subLunar: true,
  issIndicator: true,
  issPath: true,
  equator: false,
  tropics: false,
  timezones: false,
  cityLights: false,
  lightPollution: false,
  hotels:          false,
  weatherRadar:    false,
  weatherPrecip:   false,
  weatherCloud:    false,
  weatherTemp:     false,
  weatherWind:     false,
  weatherWindPtcl: false,
  weatherPressure: false,
}

export function OverlaysProvider({ children }) {
  const [overlays, setOverlays] = useState(DEFAULTS)
  const [projection, setProjection] = useState('globe')

  const toggleOverlay = useCallback((key) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <OverlaysContext.Provider value={{ overlays, toggleOverlay, projection, setProjection }}>
      {children}
    </OverlaysContext.Provider>
  )
}

export function useOverlays() {
  return useContext(OverlaysContext)
}
