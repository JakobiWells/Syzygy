import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(
      `[ErrorBoundary] ${this.props.name ?? 'unknown'} crashed\n`,
      error,
      '\nComponent stack:',
      info.componentStack
    )
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '8px 12px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 6,
          fontSize: 12,
          color: '#991b1b',
          margin: 4,
        }}>
          <strong>{this.props.name ?? 'Component'} error</strong>
          <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </div>
          <button
            style={{ marginTop: 6, fontSize: 11, cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
