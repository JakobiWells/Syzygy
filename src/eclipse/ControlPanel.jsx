import { useState, useEffect, useRef } from 'react'
import { ECLIPSES, ECLIPSE_YEARS } from './eclipseData'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${y} ${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / 86400000)
}

// Group ECLIPSE_YEARS by decade
const DECADES = []
const decadeMap = {}
for (const y of ECLIPSE_YEARS) {
  const decade = Math.floor(parseInt(y, 10) / 10) * 10
  const key = `${decade}s`
  if (!decadeMap[key]) { decadeMap[key] = []; DECADES.push(key) }
  decadeMap[key].push(y)
}

const TYPE_LABELS = { total: 'T', hybrid: 'H', annular: 'A', partial: 'P' }

export default function ControlPanel({
  selectedYear,
  onSelectYear,
  layers,
  onToggleLayer,
  isPlaying,
  onTogglePlay,
  weatherLoading,
  projection,
  onToggleProjection,
}) {
  const eclipse = ECLIPSES[selectedYear]
  const days = daysUntil(eclipse.date)
  const daysLabel = days > 0 ? `${days.toLocaleString()} days away` : 'Past'
  const typeLabel = TYPE_LABELS[eclipse.type] || 'T'

  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function onDown(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  function select(y) {
    onSelectYear(y)
    setPickerOpen(false)
  }

  // Compact label: date + type
  const triggerText = `${formatDate(eclipse.date)} · ${typeLabel}`

  // Region: extract from label after "—"
  function region(y) {
    const lbl = ECLIPSES[y].label
    const idx = lbl.indexOf('—')
    return idx >= 0 ? lbl.slice(idx + 2) : lbl
  }

  return (
    <div className="eclipse-control">

      {/* Eclipse picker */}
      <div className="eclipse-control-row">
        <span className="eclipse-control-label">Eclipse</span>
        <div className="eclipse-picker" ref={pickerRef}>
          <button
            className="eclipse-picker-trigger"
            onClick={() => setPickerOpen(v => !v)}
          >
            <span>{triggerText}</span>
            <span className="eclipse-picker-arrow">{pickerOpen ? '▲' : '▼'}</span>
          </button>

          {pickerOpen && (
            <div className="eclipse-picker-dropdown">
              {DECADES.map(decade => (
                <div key={decade}>
                  <div className="eclipse-picker-decade">{decade}</div>
                  {decadeMap[decade].map(y => (
                    <div
                      key={y}
                      className={`eclipse-picker-item${y === selectedYear ? ' is-selected' : ''}`}
                      onClick={() => select(y)}
                    >
                      <span className="eclipse-picker-type">
                        {TYPE_LABELS[ECLIPSES[y].type] || 'T'}
                      </span>
                      <span className="eclipse-picker-date">{formatDate(ECLIPSES[y].date)}</span>
                      <span className="eclipse-picker-region">{region(y)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Layer toggles */}
      <div className="eclipse-control-row">
        <span className="eclipse-control-label">Layers</span>
        <div className="eclipse-toggles">
          <button
            className={`eclipse-toggle ${layers.path ? 'is-on' : ''}`}
            onClick={() => onToggleLayer('path')}
          >
            Path
          </button>
          <button
            className={`eclipse-toggle ${layers.centerLine ? 'is-on' : ''}`}
            onClick={() => onToggleLayer('centerLine')}
          >
            Center line
          </button>
          <button
            className={`eclipse-toggle ${layers.weather ? 'is-on' : ''}`}
            onClick={() => onToggleLayer('weather')}
          >
            {weatherLoading && <span className="eclipse-toggle-spinner" />}
            Weather
          </button>
        </div>
      </div>

      {/* Projection toggle */}
      <div className="eclipse-control-row">
        <span className="eclipse-control-label">View</span>
        <div className="eclipse-toggles">
          <button
            className={`eclipse-toggle ${projection === 'mercator' ? 'is-on' : ''}`}
            onClick={() => projection !== 'mercator' && onToggleProjection()}
          >
            2D
          </button>
          <button
            className={`eclipse-toggle ${projection === 'globe' ? 'is-on' : ''}`}
            onClick={() => projection !== 'globe' && onToggleProjection()}
          >
            Globe
          </button>
        </div>
      </div>

      {/* Animation */}
      <div className="eclipse-control-row">
        <span className="eclipse-control-label">Shadow animation</span>
        <button className="eclipse-play" onClick={onTogglePlay}>
          {isPlaying ? '⏸ Pause' : '▶ Play shadow'}
        </button>
      </div>

      {/* Countdown */}
      <div className="eclipse-control-row">
        <span className="eclipse-countdown">{daysLabel}</span>
      </div>

    </div>
  )
}
