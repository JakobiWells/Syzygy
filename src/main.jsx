import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// Catch errors that escape React's ErrorBoundary (thrown in setTimeout, RAF, event handlers, promises)
window.addEventListener('error', e => {
  console.error('[GlobalError]', e.message, '\n', e.filename, ':', e.lineno, '\n', e.error)
})
window.addEventListener('unhandledrejection', e => {
  console.error('[UnhandledRejection]', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
