import { Link } from 'react-router-dom'
import { getAllGuides } from '../guideLoader'
import Logo from '../components/Logo'

export default function Home() {
  const guides = getAllGuides()

  return (
    <div className="home">
      <header className="home-header">
        <div className="wordmark-row">
          <Logo size={48} />
          <h1 className="wordmark">Syzygy</h1>
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
        <div className="guide-card">
          <h2><Link to="/eclipse" className="card-title-link">Eclipse Planner</Link></h2>
          <p>Plan your viewing location for 2026, 2027, and 2028 total solar eclipses. Score spots by cloud cover history, sun altitude, and totality duration.</p>
          <Link to="/eclipse" className="read-link">Open →</Link>
        </div>
      </main>

<footer className="home-footer">
        <span>© {new Date().getFullYear()} Syzygy</span>
        <a href="#">Twitter</a>
      </footer>
    </div>
  )
}
