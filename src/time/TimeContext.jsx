import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'

const TimeContext = createContext(null)

export function TimeProvider({ children }) {
  const [simTime, _setSimTime] = useState(() => new Date())
  const [isPlaying, _setPlaying] = useState(true)
  const [speed, _setSpeed] = useState(1)   // sim-seconds per real-second
  const [direction, _setDirection] = useState(1)  // 1 = forward, -1 = backward

  const simTimeRef   = useRef(simTime)
  const playingRef   = useRef(true)
  const speedRef     = useRef(1)
  const directionRef = useRef(1)
  const lastTsRef    = useRef(null)
  const lastRenderTs = useRef(null)
  const rafRef       = useRef(null)

  const setSimTime = useCallback((t) => {
    const d = t instanceof Date ? t : new Date(t)
    simTimeRef.current = d
    _setSimTime(new Date(d))
  }, [])

  const setSpeed = useCallback((val) => {
    speedRef.current = val
    _setSpeed(val)
  }, [])

  const setDirection = useCallback((dir) => {
    directionRef.current = dir
    _setDirection(dir)
  }, [])

  const pause = useCallback(() => {
    playingRef.current = false
    _setPlaying(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    lastTsRef.current = null
  }, [])

  const play = useCallback(() => {
    if (playingRef.current) return
    playingRef.current = true
    _setPlaying(true)
    lastTsRef.current = null
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const togglePlay = useCallback(() => {
    playingRef.current ? pause() : play()
  }, [pause, play])

  const resetToNow = useCallback(() => {
    setSimTime(new Date())
    setSpeed(1)
    play()
  }, [setSimTime, setSpeed, play])

  function tick(ts) {
    if (lastTsRef.current !== null) {
      const dt = ts - lastTsRef.current
      simTimeRef.current = new Date(simTimeRef.current.getTime() + dt * speedRef.current * directionRef.current)

      // Cap React state updates: faster speeds need fewer renders since each is expensive.
      // At 1× speed → 60fps; at 1 day/s → 30fps; at 1 month/s → 10fps.
      const absSpeed = Math.abs(speedRef.current)
      const renderInterval = absSpeed > 2592000 ? 100   // > 1 month/s  → 10fps
                           : absSpeed > 86400   ? 33    // > 1 day/s    → 30fps
                           :                      16    // otherwise    → 60fps
      if (lastRenderTs.current === null || ts - lastRenderTs.current >= renderInterval) {
        _setSimTime(new Date(simTimeRef.current))
        lastRenderTs.current = ts
      }
    }
    lastTsRef.current = ts
    if (playingRef.current) rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <TimeContext.Provider value={{
      simTime, isPlaying, speed, direction,
      setSimTime, setSpeed, setDirection, play, pause, togglePlay, resetToNow,
    }}>
      {children}
    </TimeContext.Provider>
  )
}

export function useSimTime() {
  return useContext(TimeContext)
}
