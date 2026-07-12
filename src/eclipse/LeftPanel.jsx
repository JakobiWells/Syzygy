import { useState } from 'react'
import EclipseBrowser from './EclipseBrowser'
import { IssSatellitePanel } from './LocationPanel'
import MeteorShowerPanel from './MeteorShowers'
import PlanetaryTransitPanel, { ElongationPanel } from './PlanetaryTransits'
import ConjunctionsPanel, { OppositionsPanel } from './ConjunctionsPanel'
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
}) {
  const { simTime } = useSimTime()
  const { pins, focusId, focused, focusPin, removePin, jumpTo, hiddenIds, toggleHidden } = useEventPins()
  const [addOpen, setAddOpen] = useState(false)
  const issActive = simTime.getTime() >= ISS_LAUNCH_MS

  // Event header: ISS transit (location-computed, not a pin) takes precedence
  let eventLabel = null, eventDate = null
  if (activeTransit) {
    eventLabel = `${activeTransit.type === 'solar' ? 'Solar' : 'Lunar'} ISS Transit`
    const d = activeTransit.midTime
    const pad = n => String(n).padStart(2, '0')
    eventDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())} UTC`
  } else if (focused) {
    eventLabel = focused.title
    eventDate  = focused.dateLabel
  }

  const description = activeTransit ? null : descriptionFor(focused)

  return (
    <div className="left-panel">
      {/* ── Event header ─────────────────────────────────────────────── */}
      <div className="left-panel-event">
        {eventLabel ? (
          <>
            <div className="left-panel-event-name">{eventLabel}</div>
            <div className="left-panel-event-date">{eventDate}</div>
          </>
        ) : (
          <span className="left-panel-event-placeholder">No event selected</span>
        )}
      </div>

      {description && (
        <div className="lp-event-description">
          <div className="lp-event-description-title">{description.title}</div>
          <div className="lp-event-description-body">{description.body}</div>
        </div>
      )}

      {/* ── Pinned events ────────────────────────────────────────────── */}
      <div className="lp-pins">
        {pins.length === 0 && (
          <div className="lp-pins-empty">No events pinned yet — add one below.</div>
        )}
        {pins.map(p => {
          const hidden = hiddenIds.has(p.id)
          return (
            <div
              key={p.id}
              className={`lp-pin-row${p.id === focusId ? ' is-focused' : ''}${hidden ? ' is-hidden' : ''}`}
              onClick={() => focusPin(p.id)}
            >
              <span className="lp-pin-icon">{p.icon}</span>
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
            <Section title="Satellite">
              <IssSatellitePanel
                lat={scoreData?.lat}
                lng={scoreData?.lng}
                onSelectPass={onSelectIssPass}
                onTransitPaths={onTransitPaths}
                onSelectTransit={onSelectTransit}
                onSelectPlace={onSelectPlace}
              />
              <div className="iss-ring-legend">
                <div className="iss-ring-legend-title">Visibility ring</div>
                <div className="iss-ring-legend-row"><span className="iss-ring-legend-dot" style={{ background: '#22c55e' }} />Visible from location</div>
                <div className="iss-ring-legend-row"><span className="iss-ring-legend-dot" style={{ background: '#f59e0b' }} />Sky too bright</div>
                <div className="iss-ring-legend-row"><span className="iss-ring-legend-dot" style={{ background: '#94a3b8' }} />ISS in Earth's shadow</div>
                <div className="iss-ring-legend-row"><span className="iss-ring-legend-dot" style={{ background: '#0ea5e9' }} />Below viewing angle</div>
              </div>
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
        </div>
      )}
    </div>
  )
}
