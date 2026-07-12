import { useState, useRef, useEffect } from 'react'
import { useOverlays, OVERLAY_GROUPS } from './OverlaysContext'

// Layers dropdown: grouped sections with switch toggles. Weather rasters are
// mutually exclusive (enforced in OverlaysContext); everything else stacks.

function Switch({ on }) {
  return (
    <span className={`layers-switch${on ? ' is-on' : ''}`}>
      <span className="layers-switch-knob" />
    </span>
  )
}

export default function LayersPanel() {
  const { overlays, toggleOverlay } = useOverlays()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const activeCount = Object.values(overlays).filter(Boolean).length

  return (
    <div className="time-layers-wrap" ref={ref}>
      <button
        className={`time-btn time-layers-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Map layers"
      >
        Layers
        <span className="time-layers-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="layers-panel">
          {OVERLAY_GROUPS.map(group => {
            const groupActive = group.items.filter(i => overlays[i.key]).length
            return (
              <div key={group.id} className="layers-group">
                <div className="layers-group-header">
                  <span className="layers-group-title">{group.label}</span>
                  {groupActive > 0 && <span className="layers-group-count">{groupActive}</span>}
                  {group.exclusive && <span className="layers-group-note">one at a time</span>}
                </div>
                {group.items.map(({ key, label, color }) => (
                  <button
                    key={key}
                    className="layers-row"
                    onClick={() => toggleOverlay(key)}
                  >
                    <span className="layers-dot" style={{ background: color }} />
                    <span className="layers-label">{label}</span>
                    <Switch on={!!overlays[key]} />
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
