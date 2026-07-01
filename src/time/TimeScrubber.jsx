import { useRef, useCallback } from 'react'
import { useSimTime } from './TimeContext'

// Scrubber covers this year range
const YEAR_MIN = 1900
const YEAR_MAX = 2100
const MS_MIN   = Date.UTC(YEAR_MIN, 0, 1)
const MS_MAX   = Date.UTC(YEAR_MAX, 11, 31)
const MS_SPAN  = MS_MAX - MS_MIN

function msToFrac(ms) {
  return Math.max(0, Math.min(1, (ms - MS_MIN) / MS_SPAN))
}

function fracToMs(f) {
  return MS_MIN + f * MS_SPAN
}

// Tick marks: every decade, labels every 25 years
const TICKS = []
for (let y = YEAR_MIN; y <= YEAR_MAX; y += 10) {
  TICKS.push({ year: y, major: y % 25 === 0 })
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(ms) {
  const d = new Date(ms)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export default function TimeScrubber() {
  const { simTime, setSimTime } = useSimTime()
  const trackRef  = useRef(null)
  const dragging  = useRef(false)

  const frac = msToFrac(simTime.getTime())

  const fracFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }, [])

  const jump = useCallback((e) => {
    setSimTime(new Date(fracToMs(fracFromEvent(e))))
  }, [fracFromEvent, setSimTime])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    trackRef.current.setPointerCapture(e.pointerId)
    jump(e)
  }, [jump])

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return
    jump(e)
  }, [jump])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  return (
    <div className="time-scrubber">
      <div
        ref={trackRef}
        className="time-scrubber-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Filled region left of thumb */}
        <div className="time-scrubber-fill" style={{ width: `${frac * 100}%` }} />

        {/* Tick marks */}
        {TICKS.map(({ year, major }) => (
          <div
            key={year}
            className={`time-scrubber-tick${major ? ' major' : ''}`}
            style={{ left: `${msToFrac(Date.UTC(year, 0, 1)) * 100}%` }}
          >
            {major && <span className="time-scrubber-tick-label">{year}</span>}
          </div>
        ))}

        {/* Thumb */}
        <div className="time-scrubber-thumb" style={{ left: `${frac * 100}%` }} />
      </div>
    </div>
  )
}
