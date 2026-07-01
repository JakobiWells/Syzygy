export default function TOC({ items, onSelect }) {
  if (!items.length) return null

  const handleClick = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    onSelect?.()
  }

  return (
    <nav className="toc">
      <p className="toc-title">Contents</p>
      {items.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={item.level === 3 ? 'toc-link toc-h3' : 'toc-link'}
          onClick={e => handleClick(e, item.id)}
        >
          {item.text}
        </a>
      ))}
    </nav>
  )
}
