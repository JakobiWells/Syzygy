import { useRef, useCallback, useMemo } from 'react'
import { useSimTime } from './TimeContext'
import { useEventPins } from '../eclipse/eventPins'

// ── Adaptive domain ──────────────────────────────────────────────────────────
// The scrubber covers the hull of all pinned events (plus padding). With no
// pins it falls back to a window around the current sim time. If the playhead
// wanders outside, the domain extends in 25%-of-span steps (hysteresis) so
// tick labels don't slide continuously while playing.

const HOUR = 3600_000
const DAY  = 86_400_000
const YEAR = 365.2425 * DAY

const MIN_SPAN     = 12 * HOUR
const DEFAULT_SPAN = 2 * YEAR

function pinHull(pins) {
  if (!pins.length) return null
  let min = Infinity, max = -Infinity
  for (const p of pins) {
    if (p.startMs < min) min = p.startMs
    if (p.endMs   > max) max = p.endMs
  }
  if (max - min < MIN_SPAN) {
    const mid = (min + max) / 2
    min = mid - MIN_SPAN / 2
    max = mid + MIN_SPAN / 2
  }
  const pad = (max - min) * 0.08
  return [min - pad, max + pad]
}

// ── Dynamic ticks ────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtYear(y)  { return y < 0 ? `${-y} BCE` : String(y) }

const TICK_STEPS = [
  { ms: HOUR,      label: d => `${String(d.getUTCHours()).padStart(2,'0')}:00` },
  { ms: 3 * HOUR,  label: d => `${String(d.getUTCHours()).padStart(2,'0')}:00` },
  { ms: 6 * HOUR,  label: d => `${String(d.getUTCHours()).padStart(2,'0')}:00` },
  { ms: 12 * HOUR, label: d => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2,'0')}:00` },
  { ms: DAY,       label: d => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` },
  { ms: 2 * DAY,   label: d => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` },
  { ms: 7 * DAY,   label: d => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` },
  { months: 1,     label: d => `${MONTHS[d.getUTCMonth()]} ${fmtYear(d.getUTCFullYear())}` },
  { months: 3,     label: d => `${MONTHS[d.getUTCMonth()]} ${fmtYear(d.getUTCFullYear())}` },
  { years: 1,      label: d => fmtYear(d.getUTCFullYear()) },
  { years: 2,      label: d => fmtYear(d.getUTCFullYear()) },
  { years: 5,      label: d => fmtYear(d.getUTCFullYear()) },
  { years: 10,     label: d => fmtYear(d.getUTCFullYear()) },
  { years: 25,     label: d => fmtYear(d.getUTCFullYear()) },
  { years: 50,     label: d => fmtYear(d.getUTCFullYear()) },
  { years: 100,    label: d => fmtYear(d.getUTCFullYear()) },
  { years: 250,    label: d => fmtYear(d.getUTCFullYear()) },
  { years: 500,    label: d => fmtYear(d.getUTCFullYear()) },
]

function stepSpanMs(step) {
  if (step.years)  return step.years * YEAR
  if (step.months) return step.months * 30.44 * DAY
  return step.ms
}

// Build ~6-14 ticks aligned to natural calendar boundaries.
function buildTicks(minMs, maxMs) {
  const span = maxMs - minMs
  const target = span / 9
  const step = TICK_STEPS.find(s => stepSpanMs(s) >= target) ?? TICK_STEPS[TICK_STEPS.length - 1]

  const ticks = []
  if (step.years) {
    const n = step.years
    const startYear = Math.ceil(new Date(minMs).getUTCFullYear() / n) * n
    for (let y = startYear; ; y += n) {
      const d = new Date(0)
      d.setUTCFullYear(y, 0, 1)
      d.setUTCHours(0, 0, 0, 0)
      const ms = d.getTime()
      if (ms > maxMs) break
      if (ms >= minMs) ticks.push({ ms, label: step.label(d) })
      if (ticks.length > 40) break
    }
  } else if (step.months) {
    const n = step.months
    const start = new Date(minMs)
    let y = start.getUTCFullYear()
    let mo = Math.ceil(start.getUTCMonth() / n) * n
    for (;;) {
      const d = new Date(0)
      d.setUTCFullYear(y + Math.floor(mo / 12), mo % 12, 1)
      d.setUTCHours(0, 0, 0, 0)
      const ms = d.getTime()
      if (ms > maxMs) break
      if (ms >= minMs) ticks.push({ ms, label: step.label(d) })
      mo += n
      if (ticks.length > 40) break
    }
  } else {
    // Hour/day steps align cleanly on epoch multiples (UTC midnights/hours)
    for (let ms = Math.ceil(minMs / step.ms) * step.ms; ms <= maxMs; ms += step.ms) {
      ticks.push({ ms, label: step.label(new Date(ms)) })
      if (ticks.length > 40) break
    }
  }

  // Thin labels if crowded
  const labelEvery = ticks.length > 14 ? 2 : 1
  return ticks.map((t, i) => ({ ...t, labeled: i % labelEvery === 0 }))
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TimeScrubber() {
  const { simTime, setSimTime } = useSimTime()
  const { pins, focusId, jumpTo } = useEventPins()
  const trackRef  = useRef(null)
  const dragging  = useRef(false)

  // Domain with hysteresis: recompute on pin changes; extend stepwise if the
  // playhead exits the current domain.
  const domainRef  = useRef(null)
  const pinsSigRef = useRef('')

  const nowMs = simTime.getTime()
  const pinsSig = pins.map(p => p.id).join(',')

  if (!domainRef.current || pinsSigRef.current !== pinsSig) {
    const hull = pinHull(pins)
    let [min, max] = hull ?? [nowMs - DEFAULT_SPAN / 2, nowMs + DEFAULT_SPAN / 2]
    // Always include the playhead so you can scrub from "now" up to an event
    if (nowMs < min) min = nowMs - (max - nowMs) * 0.05
    if (nowMs > max) max = nowMs + (nowMs - min) * 0.05
    domainRef.current = [min, max]
    pinsSigRef.current = pinsSig
  } else {
    const [min, max] = domainRef.current
    const span = max - min
    if (nowMs < min) domainRef.current = [nowMs - span * 0.25, max]
    else if (nowMs > max) domainRef.current = [min, nowMs + span * 0.25]
  }

  const [msMin, msMax] = domainRef.current
  const msSpan = msMax - msMin

  const msToFrac = useCallback(
    ms => Math.max(0, Math.min(1, (ms - msMin) / msSpan)),
    [msMin, msSpan]
  )

  const frac = msToFrac(nowMs)

  const ticks = useMemo(() => buildTicks(msMin, msMax), [msMin, msMax])

  const fracFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }, [])

  const jump = useCallback((e) => {
    setSimTime(new Date(msMin + fracFromEvent(e) * msSpan))
  }, [fracFromEvent, setSimTime, msMin, msSpan])

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
        {/* Filled region left of thumb (the past) */}
        <div className="time-scrubber-fill" style={{ width: `${frac * 100}%` }} />

        {/* Tick marks */}
        {ticks.map(({ ms, label, labeled }) => (
          <div
            key={ms}
            className={`time-scrubber-tick${labeled ? ' major' : ''}`}
            style={{ left: `${msToFrac(ms) * 100}%` }}
          >
            {labeled && <span className="time-scrubber-tick-label">{label}</span>}
          </div>
        ))}

        {/* Event span bars + markers */}
        {pins.map(p => {
          const startFrac = msToFrac(p.startMs)
          const endFrac   = msToFrac(p.endMs)
          return endFrac - startFrac > 0.004 ? (
            <div
              key={`span-${p.id}`}
              className="time-scrubber-span"
              style={{ left: `${startFrac * 100}%`, width: `${(endFrac - startFrac) * 100}%` }}
            />
          ) : null
        })}
        {pins.map(p => (
          <button
            key={p.id}
            className={`time-scrubber-marker${p.id === focusId ? ' is-focused' : ''}`}
            style={{ left: `${msToFrac(p.peakMs) * 100}%` }}
            title={`${p.title} — ${p.dateLabel}`}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => jumpTo(p)}
          >{p.icon}</button>
        ))}

        {/* Thumb */}
        <div className="time-scrubber-thumb" style={{ left: `${frac * 100}%` }} />
      </div>
    </div>
  )
}
