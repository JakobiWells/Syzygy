import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PersonalHome from './pages/PersonalHome'
import Guides from './pages/Guides'
import Guide from './pages/Guide'
import ErrorBoundary from './components/ErrorBoundary'
import { TimeProvider } from './time/TimeContext'
import { OverlaysProvider } from './eclipse/OverlaysContext'

// Lazy-loaded: pulls in mapbox-gl, turf, astronomy-engine, satellite.js and the
// ISS TLE archive — none of which the guide pages need.
const EclipsePage = lazy(() => import('./eclipse/EclipsePage'))

function EclipseFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#5c5c5c', fontSize: '0.9rem' }}>
      Loading eclipse planner…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary name="App">
        <TimeProvider>
        <OverlaysProvider>
          <Routes>
            <Route path="/" element={<PersonalHome />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/:slug" element={<Guide />} />
            <Route path="/eclipse" element={
              <Suspense fallback={<EclipseFallback />}>
                <EclipsePage />
              </Suspense>
            } />
          </Routes>
        </OverlaysProvider>
        </TimeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
