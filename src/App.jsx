import { Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Guide from './pages/Guide'
import EclipsePage from './eclipse/EclipsePage'
import { TimeProvider } from './time/TimeContext'
import { OverlaysProvider } from './eclipse/OverlaysContext'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: 'red' }}>
          <strong>Caught error:</strong><br />
          {this.state.error.message}<br /><br />
          <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <TimeProvider>
        <OverlaysProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/guides/:slug" element={<Guide />} />
            <Route path="/eclipse" element={<EclipsePage />} />
          </Routes>
        </OverlaysProvider>
        </TimeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
