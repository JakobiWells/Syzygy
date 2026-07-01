import { useRef } from 'react'

const exec = (cmd, val = null) => document.execCommand(cmd, false, val)

const BUTTONS = [
  { label: 'B',  title: 'Bold',           onDown: () => exec('bold'),                     style: { fontWeight: 'bold' } },
  { label: 'I',  title: 'Italic',         onDown: () => exec('italic'),                   style: { fontStyle: 'italic' } },
  { label: 'H2', title: 'Heading 2',      onDown: () => exec('formatBlock', 'h2') },
  { label: 'H3', title: 'Heading 3',      onDown: () => exec('formatBlock', 'h3') },
  { label: 'P',  title: 'Paragraph',      onDown: () => exec('formatBlock', 'p') },
  { label: '•',  title: 'Bullet list',    onDown: () => exec('insertUnorderedList') },
  { label: '1.', title: 'Numbered list',  onDown: () => exec('insertOrderedList') },
  { label: '—',  title: 'Divider',        onDown: () => exec('insertHorizontalRule') },
]

export default function DevEditor({ html }) {
  const ref = useRef()

  return (
    <div className="dev-editor">
      <div className="dev-editor-toolbar">
        {BUTTONS.map(btn => (
          <button
            key={btn.label}
            title={btn.title}
            className="dev-editor-btn"
            style={btn.style}
            onMouseDown={e => { e.preventDefault(); btn.onDown() }}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="dev-editor-content guide-content"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
