import { Link } from 'react-router-dom'

const PROJECTS = [
  {
    title: 'Eclipse Planner',
    repo: 'jakobiwells/syzygy',
    repoUrl: 'https://github.com/JakobiWells/Syzygy',
    description:
      'Plan your viewing location for the 2026, 2027, and 2028 total solar eclipses. Scores spots by cloud cover history, sun altitude, and totality duration.',
    to: '/eclipse',
    linkLabel: 'Open',
  },
  {
    title: 'Minima',
    repo: 'jakobiwells/minima',
    repoUrl: 'https://github.com/JakobiWells/minima',
    description:
      'Food planning pared down to the essentials, and the home for my guides on getting your life in order — starting with the kitchen.',
    href: 'https://github.com/JakobiWells/minima',
    linkLabel: 'GitHub',
  },
]

const EDUCATION = [
  {
    school: 'Colorado School of Mines',
    degrees: [
      'B.S. in Computer Science',
      'B.S. in Applied Mathematics & Sciences',
    ],
  },
]

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/JakobiWells' },
  { label: 'Email', href: 'mailto:dev@jakobiwells.com' },
  // { label: 'LinkedIn', href: 'https://www.linkedin.com/in/…' },
  // { label: 'X', href: 'https://x.com/…' },
]

export default function PersonalHome() {
  return (
    <div className="home">
      <header className="home-header">
        <h1 className="wordmark">Jakobi Wells</h1>
        <p className="tagline">
          I build small tools for planning things — eclipses, meals, life.
        </p>
      </header>

      <main>
        <section className="home-section">
          <h2 className="section-heading">About</h2>
          <div className="about-text">
            <p>
              [A short paragraph about you — what you do, what you're studying or
              working on, what you care about.]
            </p>
            <p>
              [A second paragraph if you want — interests outside of work,
              what you're currently exploring, where you're based.]
            </p>
          </div>
        </section>

        <section className="home-section">
          <h2 className="section-heading">Projects</h2>
          {PROJECTS.map(project => (
            <div key={project.title} className="guide-card">
              <div className="project-title-row">
                <h2>
                  {project.to ? (
                    <Link to={project.to} className="card-title-link">{project.title}</Link>
                  ) : (
                    <a href={project.href} className="card-title-link">{project.title}</a>
                  )}
                </h2>
                <a href={project.repoUrl} className="project-repo">{project.repo}</a>
              </div>
              <p>{project.description}</p>
              {project.to ? (
                <Link to={project.to} className="read-link">{project.linkLabel} →</Link>
              ) : (
                <a href={project.href} className="read-link">{project.linkLabel} →</a>
              )}
            </div>
          ))}
        </section>

        <section className="home-section">
          <h2 className="section-heading">Education</h2>
          {EDUCATION.map(entry => (
            <div key={entry.school} className="edu-entry">
              <div className="edu-row">
                <span className="edu-school">{entry.school}</span>
              </div>
              {entry.degrees.map(degree => (
                <p key={degree} className="edu-note">{degree}</p>
              ))}
            </div>
          ))}
        </section>

        <section className="home-section">
          <h2 className="section-heading">Links</h2>
          <ul className="links-list">
            {LINKS.map(link => (
              <li key={link.label}>
                <a href={link.href} className="links-list-link">{link.label} →</a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Jakobi Wells</span>
        <span className="footer-links">
          <a href="https://github.com/JakobiWells">GitHub</a>
          <a href="mailto:dev@jakobiwells.com">Email</a>
        </span>
      </footer>
    </div>
  )
}
