import { useState, useEffect } from 'react'
import { computeLunarEclipses } from './lunarEclipses'

let _cache = null

export function useLunarCatalog() {
  const [catalog, setCatalog] = useState(_cache)

  useEffect(() => {
    if (_cache) { setCatalog(_cache); return }
    // Defer off the render thread — computation is fast (~5 ms) but avoids blocking paint
    const id = setTimeout(() => {
      _cache = computeLunarEclipses(-1999, 3000)
      setCatalog(_cache)
    }, 0)
    return () => clearTimeout(id)
  }, [])

  return { catalog, loading: !catalog }
}
