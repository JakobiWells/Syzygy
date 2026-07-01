import { useState, useEffect } from 'react'
import EclipseBrowser from './EclipseBrowser'
import { IssSatellitePanel } from './LocationPanel'
import MeteorShowerPanel from './MeteorShowers'
import PlanetaryTransitPanel, { ElongationPanel, fmtTransitDur, fmtTransitDate } from './PlanetaryTransits'
import ConjunctionsPanel, { OppositionsPanel, fmtConjDate } from './ConjunctionsPanel'
import { useSimTime } from '../time/TimeContext'
import { ISS_LAUNCH_MS } from './issEngine'
import { ECLIPSE_DESCRIPTIONS, TRANSIT_DESCRIPTIONS, METEOR_DESCRIPTIONS } from './eventDescriptions'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  const neg = dateStr.startsWith('-')
  const bare = neg ? dateStr.slice(1) : dateStr
  const [y, m, d] = bare.split('-')
  const prefix = neg ? '−' : ''
  return `${prefix}${y} ${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

const TYPE_NAMES = { T: 'Total', A: 'Annular', H: 'Hybrid', P: 'Partial', N: 'Penumbral' }

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

// ── Main component ─────────────────────────────────────────────────────────

export default function LeftPanel({
  catalog,
  loading,
  lunarCatalog,
  lunarLoading,
  initialCat,
  onSelectEclipse,
  selectedEclipse,
  activeTransit,
  scoreData,
  onSelectIssPass,
  onTransitPaths,
  onSelectTransit,
  onSelectPlace,
  onSelectMeteor,
  selectedMeteor,
  onSelectPlanetaryTransit,
  selectedPlanetaryTransit,
  onSelectElongation,
  selectedElongation,
  onSelectConjunction,
  selectedConjunction,
  onSelectOpposition,
  selectedOpposition,
}) {
  const { simTime } = useSimTime()
  const issActive = simTime.getTime() >= ISS_LAUNCH_MS

  // Determine what to show in the event header
  let eventLabel = null, eventDate = null
  if (activeTransit) {
    eventLabel = `${activeTransit.type === 'solar' ? 'Solar' : 'Lunar'} ISS Transit`
    const d = activeTransit.midTime
    const pad = n => String(n).padStart(2, '0')
    eventDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())} UTC`
  } else if (selectedPlanetaryTransit) {
    eventLabel = `${selectedPlanetaryTransit.planet} Transit`
    eventDate = `${fmtTransitDate(selectedPlanetaryTransit.peak)} · ${fmtTransitDur(selectedPlanetaryTransit.durMin)}`
  } else if (selectedElongation) {
    eventLabel = `${selectedElongation.planet} Greatest Elongation`
    eventDate = `${fmtTransitDate(selectedElongation.date)} · ${selectedElongation.angleDeg}° ${selectedElongation.visibility}`
  } else if (selectedOpposition) {
    eventLabel = `${selectedOpposition.planet} Opposition`
    eventDate = fmtConjDate(selectedOpposition.date)
  } else if (selectedConjunction) {
    eventLabel = `${selectedConjunction.planet} Conjunction`
    eventDate = fmtConjDate(selectedConjunction.date)
  } else if (selectedMeteor?.shower) {
    eventLabel = `${selectedMeteor.shower.name} Meteor Shower`
    eventDate = `Peak ${selectedMeteor.peakDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} · ~${selectedMeteor.shower.zhr}/hr`
  } else if (selectedEclipse) {
    const kindLabel = selectedEclipse.kind === 'lunar' ? 'Lunar' : 'Solar'
    const typeName = TYPE_NAMES[selectedEclipse.type?.[0]] ?? ''
    eventLabel = `${typeName} ${kindLabel} Eclipse`
    eventDate = formatEventDate(selectedEclipse.date)
  }

  // Look up description for the current selection
  let description = null
  if (selectedPlanetaryTransit) {
    const year = new Date(selectedPlanetaryTransit.peak).getUTCFullYear()
    description = TRANSIT_DESCRIPTIONS[`${selectedPlanetaryTransit.planet.toLowerCase()}-${year}`] ?? null
  } else if (selectedEclipse) {
    const key = selectedEclipse.kind === 'lunar'
      ? `${selectedEclipse.date}-lunar`
      : selectedEclipse.date
    description = ECLIPSE_DESCRIPTIONS[key] ?? null
  } else if (selectedMeteor?.shower) {
    description = METEOR_DESCRIPTIONS[selectedMeteor.shower.name] ?? null
  }

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

      {/* ── Accordion sections ───────────────────────────────────────── */}
      <div className="lp-sections">
        <Section title="Eclipse">
          <EclipseBrowser
            embedded
            catalog={catalog}
            loading={loading}
            lunarCatalog={lunarCatalog}
            lunarLoading={lunarLoading}
            initialCat={initialCat}
            onSelect={onSelectEclipse}
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
          <PlanetaryTransitPanel onSelectTransit={onSelectPlanetaryTransit} />
        </Section>

        <Section title="Elongations">
          <ElongationPanel onSelectElongation={onSelectElongation} />
        </Section>

        <Section title="Oppositions">
          <OppositionsPanel onSelect={onSelectOpposition} selected={selectedOpposition} />
        </Section>

        <Section title="Conjunctions">
          <ConjunctionsPanel onSelect={onSelectConjunction} selected={selectedConjunction} />
        </Section>

        <Section title="Meteor Showers">
          <MeteorShowerPanel onSelectShower={onSelectMeteor} />
        </Section>
      </div>
    </div>
  )
}
