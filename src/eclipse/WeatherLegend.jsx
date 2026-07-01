import { useEffect, useRef } from 'react'

// Color ramps matching OWM tile server palettes
// Each entry: [value, r, g, b, a]  (a = 0–255)
const RAMPS = {
  weatherRadar: {
    label: 'Precipitation (radar)', unit: 'mm/h',
    stops: [
      [  0,   0,   0,   0,   0],
      [0.1, 161, 212, 255, 180],
      [0.2, 130, 191, 255, 200],
      [0.5,  40, 144, 255, 220],
      [  1,   0, 127, 255, 230],
      [  2,   0,  85, 255, 240],
      [  5,   0,   0, 255, 250],
      [ 10, 119,   0, 255, 255],
      [ 20, 255,   0, 255, 255],
    ],
    ticks: [0, 0.5, 2, 10, 20],
    logScale: true,
  },
  weatherTemp: {
    label: 'Temperature', unit: '°C',
    stops: [
      [-65, 130, 22, 146, 255],
      [-55, 130, 22, 146, 255],
      [-45, 142, 14, 176, 255],
      [-40, 109, 19, 209, 255],
      [-30, 35,  55, 232, 255],
      [-20, 18,  87, 232, 255],
      [-10, 18, 113, 232, 255],
      [  0, 18, 179, 232, 255],
      [  5, 18, 208, 232, 255],
      [ 10, 18, 232, 179, 255],
      [ 15, 18, 232, 128, 255],
      [ 20, 34, 232,  18, 255],
      [ 25, 128,232,  18, 255],
      [ 30, 232,224,  18, 255],
      [ 35, 232,144,  18, 255],
      [ 40, 232, 64,  18, 255],
      [ 50, 136, 18,  18, 255],
    ],
    ticks: [-40, -20, 0, 10, 20, 30, 40],
  },
  weatherPrecip: {
    label: 'Precipitation', unit: 'mm/h',
    stops: [
      [  0,   0,   0,   0,   0],
      [0.1, 161, 212, 255, 180],
      [0.2, 130, 191, 255, 200],
      [0.5,  40, 144, 255, 220],
      [  1,   0, 127, 255, 230],
      [  2,   0,  85, 255, 240],
      [  5,   0,   0, 255, 250],
      [ 10, 119,   0, 255, 255],
      [ 20, 255,   0, 255, 255],
    ],
    ticks: [0, 0.5, 2, 10, 20],
    logScale: true,
  },
  weatherWind: {
    label: 'Wind speed', unit: 'm/s',
    stops: [
      [ 0,   0,   0,   0,   0],
      [ 1, 223, 247, 244, 180],
      [ 5, 130, 239, 255, 210],
      [10,  43, 221, 255, 230],
      [15,  38, 232, 144, 240],
      [20, 232, 224,  38, 250],
      [25, 232,  80,  38, 255],
      [30, 136,   0,   0, 255],
    ],
    ticks: [0, 5, 10, 20, 30],
  },
  weatherPressure: {
    label: 'Pressure', unit: 'hPa',
    stops: [
      [ 940, 130,  22, 146, 255],
      [ 950,  82,  23, 204, 255],
      [ 960,  35,  55, 232, 255],
      [ 970,  18,  87, 232, 255],
      [ 980,  18, 179, 232, 255],
      [ 990,  18, 232, 179, 255],
      [1000,  18, 232,  18, 255],
      [1010, 128, 232,  18, 255],
      [1020, 232, 224,  18, 255],
      [1030, 232, 144,  18, 255],
      [1040, 232,  50,  18, 255],
    ],
    ticks: [940, 960, 980, 1000, 1020, 1040],
  },
  weatherCloud: {
    label: 'Cloud cover', unit: '%',
    stops: [
      [  0,   0,   0,   0,   0],
      [ 10,  20,  20,  20,  40],
      [ 25,  15,  15,  15,  90],
      [ 50,  10,  10,  10, 150],
      [ 75,   5,   5,   5, 200],
      [100,   0,   0,   0, 230],
    ],
    ticks: [0, 25, 50, 75, 100],
  },
}

function lerp(a, b, t) { return a + (b - a) * t }

function sampleRamp(stops, value, logScale) {
  if (stops.length === 0) return [0, 0, 0, 0]
  if (value <= stops[0][0]) return stops[0].slice(1)
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1].slice(1)
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i][0]) {
      const v0 = stops[i - 1][0], v1 = stops[i][0]
      const t = logScale
        ? (Math.log(value + 1) - Math.log(v0 + 1)) / (Math.log(v1 + 1) - Math.log(v0 + 1))
        : (value - v0) / (v1 - v0)
      return [0, 1, 2, 3].map(c => Math.round(lerp(stops[i - 1][c + 1], stops[i][c + 1], t)))
    }
  }
  return stops[stops.length - 1].slice(1)
}

function drawRamp(canvas, ramp) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const stops = ramp.stops
  const vmin = stops[0][0], vmax = stops[stops.length - 1][0]
  const img = ctx.createImageData(w, h)
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1)
    const v = ramp.logScale
      ? Math.exp(Math.log(vmin + 1) + t * (Math.log(vmax + 1) - Math.log(vmin + 1))) - 1
      : vmin + t * (vmax - vmin)
    const [r, g, b, a] = sampleRamp(stops, v, ramp.logScale)
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
}

function LegendBar({ rampKey }) {
  const canvasRef = useRef(null)
  const ramp = RAMPS[rampKey]

  useEffect(() => {
    if (canvasRef.current) drawRamp(canvasRef.current, ramp)
  }, [ramp])

  const stops = ramp.stops
  const vmin = stops[0][0], vmax = stops[stops.length - 1][0]
  const span = vmax - vmin

  return (
    <div className="wx-legend">
      <div className="wx-legend-label">{ramp.label} <span className="wx-legend-unit">({ramp.unit})</span></div>
      <div className="wx-legend-bar-wrap">
        <canvas ref={canvasRef} className="wx-legend-canvas" width={260} height={12} />
        <div className="wx-legend-ticks">
          {ramp.ticks.map(v => (
            <span key={v} className="wx-legend-tick" style={{ left: `${((v - vmin) / span) * 100}%` }}>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function WeatherLegend({ overlays }) {
  const active = Object.keys(RAMPS).filter(k => overlays[k])
  if (active.length === 0) return null

  return (
    <div className="wx-legend-stack">
      {active.map(key => <LegendBar key={key} rampKey={key} />)}
    </div>
  )
}
