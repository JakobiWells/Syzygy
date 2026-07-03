import { Link } from 'react-router-dom'
import { getAllGuides } from '../guideLoader'
import Logo from '../components/Logo'

export default function Guides() {
  const guides = getAllGuides()

  return (
    <div className="home">
      <header className="home-header">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">← jakobiwells.com</Link>
        </nav>
        <div className="wordmark-row">
          <Logo size={48} />
          <h1 className="wordmark">Guides</h1>
        </div>
        <p className="tagline">Guides for getting your life in order.</p>
      </header>

      <main>
        {guides.map(guide => (
          <div key={guide.slug} className="guide-card">
            <h2><Link to={`/guides/${guide.slug}`} className="card-title-link">{guide.title}</Link></h2>
            <p>{guide.description}</p>
            <Link to={`/guides/${guide.slug}`} className="read-link">Read →</Link>
          </div>
        ))}
      </main>

      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Jakobi Wells</span>
        <Link to="/">Home</Link>
      </footer>
    </div>
  )
}
