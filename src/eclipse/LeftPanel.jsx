import { useState } from 'react'
import EclipseBrowser from './EclipseBrowser'
import { IssSatellitePanel } from './LocationPanel'
import MeteorShowerPanel from './MeteorShowers'
import PlanetaryTransitPanel, { ElongationPanel } from './PlanetaryTransits'
import ConjunctionsPanel, { OppositionsPanel } from './ConjunctionsPanel'
import MoonsPanel from './MoonsPanel'
import CometsPanel from './CometsPanel'
import { useSimTime } from '../time/TimeContext'
import { useEventPins } from './eventPins'
import { ISS_LAUNCH_MS } from './issEngine'
import { ECLIPSE_DESCRIPTIONS, TRANSIT_DESCRIPTIONS, METEOR_DESCRIPTIONS } from './eventDescriptions'

// ── Shared accordion section ───────────────────────────────────────────────

function Section({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lp-section">
      <button className="lp-section-toggle" onClick={() => setOpen(v => !v)}>
        <span className="lp-section-title">{title}</span>
        <span className={`lp-section-caret${open ? ' is-open' : ''}`}>▾</span>
      </button>
      {open && <div className="lp-section-body lp-section-body--flush">{children}</div>}
    </div>
  )
}

function fmtTransitBanner(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())} UTC`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtPeakUTC(ms) {
  const d = new Date(ms)
  const pad = n => String(n).padStart(2, '0')
  const y = d.getUTCFullYear()
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${y < 0 ? `${-y} BCE` : y} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

// ── Description lookup for a focused pin ───────────────────────────────────

function descriptionFor(evt) {
  if (!evt) return null
  switch (evt.kind) {
    case 'eclipse': {
      const e = evt.payload
      const key = e.kind === 'lunar' ? `${e.date}-lunar` : e.date
      return ECLIPSE_DESCRIPTIONS[key] ?? null
    }
    case 'transit': {
      const year = new Date(evt.payload.peak).getUTCFullYear()
      return TRANSIT_DESCRIPTIONS[`${evt.payload.planet.toLowerCase()}-${year}`] ?? null
    }
    case 'meteor':
      return METEOR_DESCRIPTIONS[evt.payload.shower.name] ?? null
    default:
      return null
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LeftPanel({
  catalog,
  loading,
  lunarCatalog,
  lunarLoading,
  activeTransit,
  scoreData,
  onSelectIssPass,
  onTransitPaths,
  onSelectTransit,
  onSelectPlace,
  onSatelliteChange,
}) {
  const { simTime } = useSimTime()
  const { pins, focusId, focusPin, removePin, jumpTo, hiddenIds, toggleHidden } = useEventPins()
  const [addOpen, setAddOpen] = useState(false)
  const issActive = simTime.getTime() >= ISS_LAUNCH_MS

  return (
    <div className="left-panel">
      {/* ── Pinned events (each row is a dropdown; open = focused) ───── */}
      <div className="lp-pins">
        {activeTransit && (
          <div className="lp-pin-row lp-pin-row--banner">
            <span className="lp-pin-icon">◍</span>
            <span className="lp-pin-main">
              <span className="lp-pin-title">{activeTransit.type === 'solar' ? 'Solar' : 'Lunar'} {activeTransit.satName ?? 'ISS'} Transit</span>
              <span className="lp-pin-date">{fmtTransitBanner(activeTransit.midTime)}</span>
            </span>
          </div>
        )}
        {pins.length === 0 && !activeTransit && (
          <div className="lp-pins-empty">No events pinned yet — add one below.</div>
        )}
        {pins.map(p => {
          const hidden  = hiddenIds.has(p.id)
          const open    = p.id === focusId
          const desc    = open ? descriptionFor(p) : null
          return (
            <div key={p.id} className={`lp-pin${open ? ' is-focused' : ''}${hidden ? ' is-hidden' : ''}`}>
              <div
                className="lp-pin-row"
                onClick={() => focusPin(open ? null : p.id)}
              >
                <span className={`lp-pin-caret${open ? ' is-open' : ''}`}>▾</span>
                <span className="lp-pin-icon" style={p.iconColor ? { color: p.iconColor } : undefined}>{p.icon}</span>
                <span className="lp-pin-main">
                  <span className="lp-pin-title">{p.title}</span>
                  <span className="lp-pin-date">{p.dateLabel}</span>
                </span>
                <button
                  className={`lp-pin-btn lp-pin-eye${hidden ? ' is-off' : ''}`}
                  title={hidden ? 'Show on map' : 'Hide from map'}
                  onClick={e => { e.stopPropagation(); toggleHidden(p.id) }}
                >👁</button>
                <button
                  className="lp-pin-btn lp-pin-jump"
                  title="Jump the clock to this event"
                  onClick={e => { e.stopPropagation(); focusPin(p.id); jumpTo(p) }}
                >▶</button>
                <button
                  className="lp-pin-btn lp-pin-remove"
                  title="Remove from map"
                  onClick={e => { e.stopPropagation(); removePin(p.id) }}
                >×</button>
              </div>
              {open && (
                <div className="lp-pin-body">
                  <div className="lp-pin-body-time">Peak {fmtPeakUTC(p.peakMs)}</div>
                  {desc && (
                    <>
                      <div className="lp-pin-body-title">{desc.title}</div>
                      <div className="lp-pin-body-text">{desc.body}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Add event ────────────────────────────────────────────────── */}
      <button className={`lp-add-event${addOpen ? ' is-open' : ''}`} onClick={() => setAddOpen(v => !v)}>
        <span className="lp-add-event-plus">{addOpen ? '−' : '+'}</span>
        Add event
      </button>

      {addOpen && (
        <div className="lp-sections">
          <Section title="Eclipse">
            <EclipseBrowser
              embedded
              catalog={catalog}
              loading={loading}
              lunarCatalog={lunarCatalog}
              lunarLoading={lunarLoading}
            />
          </Section>

          {issActive && (
            <Section title="Satellites">
              <IssSatellitePanel
                lat={scoreData?.lat}
                lng={scoreData?.lng}
                onSelectPass={onSelectIssPass}
                onTransitPaths={onTransitPaths}
                onSelectTransit={onSelectTransit}
                onSelectPlace={onSelectPlace}
                onSatelliteChange={onSatelliteChange}
              />
            </Section>
          )}

          <Section title="Planetary Transits">
            <PlanetaryTransitPanel />
          </Section>

          <Section title="Elongations">
            <ElongationPanel />
          </Section>

          <Section title="Oppositions">
            <OppositionsPanel />
          </Section>

          <Section title="Conjunctions">
            <ConjunctionsPanel />
          </Section>

          <Section title="Meteor Showers">
            <MeteorShowerPanel />
          </Section>

          <Section title="Moons">
            <MoonsPanel />
          </Section>

          <Section title="Comets">
            <CometsPanel />
          </Section>
        </div>
      )}
    </div>
  )
}
