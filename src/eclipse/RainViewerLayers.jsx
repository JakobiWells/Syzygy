import { useEffect, useRef, useState } from 'react'
import { useSimTime } from '../time/TimeContext'

// Animated weather via RainViewer (free, no key):
//   · precipitation radar — ~2 h of past frames at 10-min steps + ~30-min nowcast
//   · infrared satellite (clouds) — similar rolling window
// Frames are pre-added as raster layers and the one nearest the sim time is
// shown, so the weather *moves* during playback and scrubbing steps through
// real frames. Radar always renders above the cloud layer.

const RV_META_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const REFRESH_MS  = 5 * 60_000
const FRAME_PAD_S = 10 * 60   // tolerance beyond first/last frame

const GROUPS = [
  {
    kind: 'radar',
    prefix: 'rv-radar-',
    // color scheme 2 (universal blue), smoothed, snow shown
    url: (host, path) => `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`,
    frames: meta => [
      ...(meta.radar?.past ?? []).map(f => ({ ...f, nowcast: false })),
      ...(meta.radar?.nowcast ?? []).map(f => ({ ...f, nowcast: true })),
    ],
    paint: { 'raster-opacity': 0.75 },
  },
  // NOTE: RainViewer's public satellite.infrared feed currently returns an
  // empty list (free IR satellite was discontinued), so there is no clouds
  // group — historical/current cloud imagery will come from NASA GIBS later.
]

export default function RainViewerLayers({ map, mapLoaded, radarVisible, onStatus }) {
  const { simTime } = useSimTime()
  const [frameSets, setFrameSets] = useState(null)   // { radar: [...] }
  const lastStatusRef = useRef('')

  const anyVisible = radarVisible
  const visibleByKind = { radar: radarVisible }

  // Fetch the frame index while any layer is on; refresh as frames publish
  useEffect(() => {
    if (!anyVisible) return
    let alive = true
    async function load() {
      try {
        const meta = await (await fetch(RV_META_URL)).json()
        const next = {}
        for (const g of GROUPS) {
          next[g.kind] = g.frames(meta)
            .map(f => ({ time: f.time, nowcast: f.nowcast, url: g.url(meta.host, f.path) }))
            .sort((a, b) => a.time - b.time)
        }
        if (alive) setFrameSets(next)
      } catch { /* keep previous frames */ }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [anyVisible])

  // Maintain a raster source+layer per frame; radar stays above clouds
  useEffect(() => {
    if (!mapLoaded || !map || !frameSets) return
    for (const g of GROUPS) {
      const frames = frameSets[g.kind] ?? []
      const keep = new Set(frames.map(f => `${g.prefix}${f.time}`))
      for (const f of frames) {
        const id = `${g.prefix}${f.time}`
        if (!map.getSource(id)) {
          map.addSource(id, { type: 'raster', tiles: [f.url], tileSize: 256, attribution: '© RainViewer' })
        }
        if (!map.getLayer(id)) {
          map.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: g.paint })
        }
      }
      for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.id.startsWith(g.prefix) && !keep.has(layer.id)) {
          try { map.removeLayer(layer.id) } catch {}
          try { map.removeSource(layer.id) } catch {}
        }
      }
    }
    // Keep radar on top of the cloud layer
    for (const layer of map.getStyle()?.layers ?? []) {
      if (layer.id.startsWith('rv-radar-')) {
        try { map.moveLayer(layer.id) } catch {}
      }
    }
  }, [map, mapLoaded, frameSets])

  // Cleanup on unmount
  useEffect(() => () => {
    if (!map) return
    for (const layer of map.getStyle()?.layers ?? []) {
      if (layer.id.startsWith('rv-radar-') || layer.id.startsWith('rv-sat-')) {
        try { map.removeLayer(layer.id) } catch {}
        try { map.removeSource(layer.id) } catch {}
      }
    }
  }, [map])

  // Show the frame nearest the sim time for each visible kind
  useEffect(() => {
    if (!mapLoaded || !map || !frameSets) return
    const t = simTime.getTime() / 1000
    const status = {}

    for (const g of GROUPS) {
      const frames = frameSets[g.kind] ?? []
      const visible = visibleByKind[g.kind]
      let active = null
      if (visible && frames.length) {
        const inRange = t >= frames[0].time - FRAME_PAD_S && t <= frames[frames.length - 1].time + FRAME_PAD_S
        if (inRange) {
          active = frames.reduce((best, f) =>
            Math.abs(f.time - t) < Math.abs(best.time - t) ? f : best, frames[0])
        }
      }
      for (const f of frames) {
        const id = `${g.prefix}${f.time}`
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', active?.time === f.time ? 'visible' : 'none')
        }
      }
      status[g.kind] = !visible ? null
        : active ? { state: 'ok', frameTime: active.time, nowcast: active.nowcast }
        : frames.length ? { state: 'out-of-range' }
        : { state: 'loading' }
    }

    const sig = JSON.stringify(status)
    if (sig !== lastStatusRef.current) {
      lastStatusRef.current = sig
      onStatus?.(status)
    }
  }, [map, mapLoaded, frameSets, simTime, radarVisible])

  return null
}
