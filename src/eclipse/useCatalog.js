import { useState, useEffect } from 'react'

let _cache = null
let _promise = null

export function useCatalog() {
  const [state, setState] = useState({ catalog: _cache, loading: !_cache, error: null })

  useEffect(() => {
    if (_cache) return
    if (!_promise) {
      _promise = fetch('/eclipseCatalog.json').then(r => r.json())
    }
    _promise
      .then(data => { _cache = data; setState({ catalog: data, loading: false, error: null }) })
      .catch(e => { _promise = null; setState({ catalog: null, loading: false, error: e.message }) })
  }, [])

  return state
}
