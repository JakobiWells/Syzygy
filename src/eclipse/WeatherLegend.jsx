// Legends for the RainViewer weather layers, with frame-time status notes.

function pad2(n) { return String(n).padStart(2, '0') }
function fmtFrameUTC(unixS) {
  const d = new Date(unixS * 1000)
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`
}

function statusNote(status) {
  if (status?.state === 'ok') {
    return `Frame ${fmtFrameUTC(status.frameTime)}${status.nowcast ? ' · nowcast' : ''}`
  }
  if (status?.state === 'out-of-range') {
    return 'Live data covers the last ~2 h — move time closer to now'
  }
  return 'Loading frames…'
}

function RadarLegend({ status }) {
  return (
    <div className="wx-legend">
      <div className="wx-legend-label">Radar <span className="wx-legend-unit">(live · RainViewer)</span></div>
      <div className="wx-radar-grad" />
      <div className="wx-radar-scale"><span>light</span><span>moderate</span><span>heavy</span></div>
      <div className="wx-legend-note">{statusNote(status)}</div>
    </div>
  )
}

export default function WeatherLegend({ overlays, weatherStatus }) {
  if (!overlays.weatherRadar) return null

  return (
    <div className="wx-legend-stack">
      <RadarLegend status={weatherStatus?.radar} />
    </div>
  )
}
