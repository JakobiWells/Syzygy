function cloudBarClass(pct) {
  if (pct === null) return 'mid'
  if (pct < 20) return 'low'
  if (pct < 50) return 'mid'
  return 'high'
}

function starsFromScore(score) {
  if (score <= 0) return 0
  return Math.max(1, Math.min(5, Math.ceil(score / 20)))
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function ScoreCard({ data, onClose }) {
  const visible = data !== null

  if (!data) {
    return <div className="eclipse-score-card" aria-hidden="true" />
  }

  const {
    placeName,
    inPath,
    score,
    cloudPct,
    yearBreakdown,
    durationSeconds,
    sunAltDeg,
    sunCardinal,
    lat,
    lng,
  } = data

  const stars = starsFromScore(score)
  const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars)

  const shareUrl = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('lat', lat.toFixed(5))
    url.searchParams.set('lng', lng.toFixed(5))
    navigator.clipboard.writeText(url.toString())
  }

  const airbnbUrl = `https://www.airbnb.com/s/${lat.toFixed(4)},${lng.toFixed(4)}/homes`

  return (
    <div className={`eclipse-score-card ${visible ? 'is-visible' : ''}`}>
      <div className="eclipse-score-card-handle" />

      <div className="eclipse-score-header">
        <p className="eclipse-score-place">{placeName || `${lat.toFixed(3)}, ${lng.toFixed(3)}`}</p>
        <button className="eclipse-score-close" onClick={onClose}>✕</button>
      </div>

      {!inPath ? (
        <p className="eclipse-out-of-path">
          This location is outside the path of totality. Move your pin inside the dark corridor for a full score.
        </p>
      ) : (
        <>
          <div className="eclipse-score-stars" aria-label={`${stars} out of 5 stars`}>
            {starStr}
          </div>

          <div className="eclipse-score-grid">
            <div className="eclipse-score-stat">
              <p className="eclipse-score-stat-label">Totality duration</p>
              <p className="eclipse-score-stat-value">{formatDuration(durationSeconds)}</p>
            </div>

            <div className="eclipse-score-stat">
              <p className="eclipse-score-stat-label">Cloud cover (avg)</p>
              <p className="eclipse-score-stat-value">
                {cloudPct !== null ? `${cloudPct}%` : '—'}
              </p>
            </div>

            <div className="eclipse-score-stat">
              <p className="eclipse-score-stat-label">Sun altitude</p>
              <p className="eclipse-score-stat-value">{sunAltDeg !== null ? `${sunAltDeg}°` : '—'}</p>
              <p className="eclipse-score-stat-sub">{sunCardinal || ''}</p>
            </div>

            <div className="eclipse-score-stat">
              <p className="eclipse-score-stat-label">Viewing score</p>
              <p className="eclipse-score-stat-value">{score} / 100</p>
            </div>
          </div>

          {yearBreakdown && yearBreakdown.length > 0 && (
            <div className="eclipse-cloud-breakdown">
              <p className="eclipse-control-label" style={{ marginBottom: '0.4rem' }}>
                Historical cloud cover by year
              </p>
              {yearBreakdown.map(({ year, value }) => (
                <div key={year} className="eclipse-cloud-year">
                  <span className="eclipse-cloud-year-label">{year}</span>
                  <div className="eclipse-cloud-bar-track">
                    <div
                      className={`eclipse-cloud-bar-fill ${cloudBarClass(value)}`}
                      style={{ width: value !== null ? `${value}%` : '0%' }}
                    />
                  </div>
                  <span className="eclipse-cloud-year-pct">
                    {value !== null ? `${value}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="eclipse-score-actions">
        {inPath && (
          <a
            href={airbnbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="eclipse-btn"
          >
            Find lodging nearby ↗
          </a>
        )}
        <button className="eclipse-btn" onClick={shareUrl}>
          Copy link to spot
        </button>
      </div>
    </div>
  )
}
