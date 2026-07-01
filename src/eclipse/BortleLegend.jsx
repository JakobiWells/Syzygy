// Compact Bortle scale legend shown when the light pollution (SQM) overlay is active.
// Colors match the standard Falchi/lightpollutionmap.info color scheme.
export default function BortleLegend() {
  return (
    <div className="bortle-legend">
      <div className="bortle-legend-label">Light pollution</div>
      <div className="bortle-legend-bar" />
      <div className="bortle-legend-ticks">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <span key={n} className="bortle-legend-tick">{n}</span>
        ))}
      </div>
      <div className="bortle-legend-ends">
        <span>dark</span>
        <span>Bortle</span>
        <span>bright</span>
      </div>
    </div>
  )
}
