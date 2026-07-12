import { useEffect, useRef, useState } from 'react'
import { useSimTime } from '../time/TimeContext'

// Live animated precipitation radar via RainViewer (free, no key).
// RainViewer serves ~2 hours of past frames at 10-minute steps plus a
// ~30-minute nowcast. Frames are pre-added as individual raster layers and
// the one nearest the sim time is shown — so the radar *moves* while time
// plays, and scrubbing steps through real frames.

const RV_META_URL = 'https://api.rainviewer.com/public/weather-maps.json'
const REFRESH_MS  = 5 * 60_000
const FRAME_PAD_S = 10 * 60   // tolerance beyond first/last frame

function frameLayerId(t) { return `rv-radar-${t}` }

export default function RadarLayer({ map, mapLoaded, visible, onStatus }) {
  const { simTime } = useSimTime()
  const [frames, setFrames] = useState(null)   // [{ time, url, nowcast }]
  const lastStatusRef = useRef('')

  // Fetch frame index while the layer is on; refresh as new frames publish
  useEffect(() => {
    if (!visible) return
    let alive = true
    async function load() {
      try {
        const resp = await fetch(RV_META_URL)
        const meta = await resp.json()
        const past = (meta.radar?.past ?? []).map(f => ({ ...f, nowcast: false }))
        const cast = (meta.radar?.nowcast ?? []).map(f => ({ ...f, nowcast: true }))
        const all = [...past, ...cast].map(f => ({
          time: f.time,
          nowcast: f.nowcast,
          // color scheme 2 (universal blue), smoothed, snow shown
          url: `${meta.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
        })).sort((a, b) => a.time - b.time)
        if (alive && all.length) setFrames(all)
      } catch { /* keep previous frames */ }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [visible])

  // Maintain a raster source+layer per frame
  useEffect(() => {
    if (!mapLoaded || !map || !frames) return
    const keep = new Set(frames.map(f => frameLayerId(f.time)))
    for (const f of frames) {
      const id = frameLayerId(f.time)
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'raster', tiles: [f.url], tileSize: 256, attribution: '© RainViewer' })
      }
      if (!map.getLayer(id)) {
        map.addLayer({
          id, type: 'raster', source: id,
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.75 },
        })
      }
    }
    // Drop frames that rolled out of the window
    for (const layer of map.getStyle()?.layers ?? []) {
      if (layer.id.startsWith('rv-radar-') && !keep.has(layer.id)) {
        try { map.removeLayer(layer.id) } catch {}
        try { map.removeSource(layer.id) } catch {}
      }
    }
  }, [map, mapLoaded, frames])

  // Cleanup on unmount
  useEffect(() => () => {
    if (!map) return
    for (const layer of map.getStyle()?.layers ?? []) {
      if (layer.id.startsWith('rv-radar-')) {
        try { map.removeLayer(layer.id) } catch {}
        try { map.removeSource(layer.id) } catch {}
      }
    }
  }, [map])

  // Show the frame nearest the sim time
  useEffect(() => {
    if (!mapLoaded || !map || !frames?.length) return
    const t = simTime.getTime() / 1000
    const inRange = t >= frames[0].time - FRAME_PAD_S && t <= frames[frames.length - 1].time + FRAME_PAD_S

    let active = null
    if (visible && inRange) {
      active = frames.reduce((best, f) =>
        Math.abs(f.time - t) < Math.abs(best.time - t) ? f : best, frames[0])
    }

    for (const f of frames) {
      const id = frameLayerId(f.time)
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', active?.time === f.time ? 'visible' : 'none')
      }
    }

    const status = !visible ? null
      : active ? { state: 'ok', frameTime: active.time, nowcast: active.nowcast }
      : { state: 'out-of-range', from: frames[0].time, to: frames[frames.length - 1].time }
    const sig = JSON.stringify(status)
    if (sig !== lastStatusRef.current) {
      lastStatusRef.current = sig
      onStatus?.(status)
    }
  }, [map, mapLoaded, frames, simTime, visible])

  return null
}
