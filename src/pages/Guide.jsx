import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { getGuideBySlug } from '../guideLoader'
import TOC from '../components/TOC'
import Logo from '../components/Logo'
import DevEditor from '../components/DevEditor'
import SpiceTable from '../components/SpiceTable'

const COMPONENTS = {
  'spice-table': SpiceTable,
}

function GuideContent({ html }) {
  const PLACEHOLDER = /<div data-component="([^"]+)"><\/div>/g
  const parts = []
  let last = 0
  let match

  while ((match = PLACEHOLDER.exec(html)) !== null) {
    if (match.index > last) parts.push({ type: 'html', content: html.slice(last, match.index) })
    parts.push({ type: 'component', name: match[1] })
    last = match.index + match[0].length
  }
  if (last < html.length) parts.push({ type: 'html', content: html.slice(last) })

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'html') return <div key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
        const Component = COMPONENTS[part.name]
        return Component ? <Component key={i} /> : null
      })}
    </>
  )
}

export default function Guide() {
  const { slug } = useParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const guide = getGuideBySlug(slug)
  if (!guide) {
    return (
      <div className="not-found">
        <p>Guide not found. <Link to="/">← Back home</Link></p>
      </div>
    )
  }

  const { frontmatter, html, toc } = guide

  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-header-link">
          <Logo size={42} />
          <span>Syzygy</span>
        </Link>
        <nav className="site-nav">
          <Link to="/eclipse" className="site-nav-link">Eclipse Planner</Link>
        </nav>
        {import.meta.env.DEV && (
          <button className="edit-toggle" onClick={() => setEditMode(v => !v)}>
            {editMode ? 'Preview' : 'Edit'}
          </button>
        )}
      </header>

      {editMode ? (
        <DevEditor html={html} />
      ) : (
        <div className="guide-layout">
          <aside className="guide-sidebar">
            <TOC items={toc} />
          </aside>
          <main className="guide-content">
            <h1 className="guide-title">{frontmatter.title}</h1>
            <p className="guide-description">{frontmatter.description}</p>
            <GuideContent html={html} />
          </main>
        </div>
      )}

      <button className="contents-btn" onClick={() => setDrawerOpen(true)}>
        Contents ↓
      </button>

      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="drawer">
            <TOC items={toc} onSelect={() => setDrawerOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
