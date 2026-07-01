import * as A from 'astronomy-engine'

// ── Transit computation ───────────────────────────────────────────────────────
// Uses astronomy-engine SearchTransit / NextTransit for exact results.
// Returns objects with: { id, planet, start, peak, finish, durMin, separationArcmin }

function transitEntry(planet, info) {
  const startDate  = info.start.date
  const peakDate   = info.peak.date
  const finishDate = info.finish.date
  const durMin     = (finishDate - startDate) / 60000
  return {
    id:              `${planet.toLowerCase()}-${peakDate.getFullYear()}-${peakDate.getMonth()}-${peakDate.getDate()}`,
    planet,
    start:           startDate,
    peak:            peakDate,
    finish:          finishDate,
    durMin:          Math.round(durMin),
    separationArcmin: Math.round(info.separation * 10) / 10,
  }
}

// Compute up to `count` transits (Mercury + Venus) starting from startDate.
// Searches forward; startDate should be well before the first desired transit.
export function computeTransits(startDate, count = 30) {
  const results = []

  const bodies = [
    { body: A.Body.Mercury, name: 'Mercury' },
    { body: A.Body.Venus,   name: 'Venus'   },
  ]

  for (const { body, name } of bodies) {
    try {
      let info = A.SearchTransit(body, A.MakeTime(startDate))
      while (results.filter(r => r.planet === name).length < count) {
        results.push(transitEntry(name, info))
        info = A.NextTransit(body, info.finish)
      }
    } catch {
      // No more transits found in the range
    }
  }

  results.sort((a, b) => a.peak - b.peak)
  return results
}

// ── Elongation computation ────────────────────────────────────────────────────
// Greatest elongations for Mercury and Venus (best viewing as morning/evening star).

function elongationEntry(planet, evt) {
  return {
    id:          `elong-${planet.toLowerCase()}-${evt.time.date.getFullYear()}-${evt.time.date.getMonth()}`,
    planet,
    date:        evt.time.date,
    angleDeg:    Math.round(evt.elongation * 10) / 10,
    visibility:  evt.visibility === 'morning' ? 'morning' : 'evening',
  }
}

export function computeElongations(startDate, count = 20) {
  const results = []
  const bodies = [
    { body: A.Body.Mercury, name: 'Mercury' },
    { body: A.Body.Venus,   name: 'Venus'   },
  ]

  for (const { body, name } of bodies) {
    try {
      let evt = A.SearchMaxElongation(body, A.MakeTime(startDate))
      let n = 0
      while (n < count) {
        results.push(elongationEntry(name, evt))
        // Advance by ~half the synodic period to find next
        const advanceDays = name === 'Mercury' ? 60 : 300
        const nextStart = new Date(evt.time.date.getTime() + advanceDays * 86400000)
        evt = A.SearchMaxElongation(body, A.MakeTime(nextStart))
        n++
      }
    } catch {
      // stop
    }
  }

  results.sort((a, b) => a.date - b.date)
  return results
}

// ── Conjunction / Opposition computation ─────────────────────────────────────
// Finds planetary conjunctions (same ecliptic longitude) and oppositions
// (180° apart) relative to the Sun, for outer planets.
// Also finds conjunctions between pairs of visible planets.

const OUTER = [
  { body: A.Body.Mars,    name: 'Mars',    synodic: 780 },
  { body: A.Body.Jupiter, name: 'Jupiter', synodic: 399 },
  { body: A.Body.Saturn,  name: 'Saturn',  synodic: 378 },
  { body: A.Body.Uranus,  name: 'Uranus',  synodic: 370 },
  { body: A.Body.Neptune, name: 'Neptune', synodic: 368 },
]

// Compute oppositions and conjunctions with the Sun for outer planets
export function computeOppositions(startDate, count = 20) {
  const results = []

  for (const planet of OUTER) {
    try {
      // Opposition = planet at 180° from Sun (relative longitude 180)
      let t = A.SearchRelativeLongitude(planet.body, 180, A.MakeTime(startDate))
      let n = 0
      while (n < count) {
        results.push({
          id:      `opp-${planet.name.toLowerCase()}-${t.date.getFullYear()}`,
          type:    'opposition',
          planet:  planet.name,
          body2:   'Sun',
          date:    t.date,
        })
        const next = new Date(t.date.getTime() + planet.synodic * 86400000 * 0.9)
        t = A.SearchRelativeLongitude(planet.body, 180, A.MakeTime(next))
        n++
      }
    } catch { /* no more */ }

    try {
      // Conjunction = planet at 0° from Sun (relative longitude 0)
      let t = A.SearchRelativeLongitude(planet.body, 0, A.MakeTime(startDate))
      let n = 0
      while (n < count) {
        results.push({
          id:      `conj-${planet.name.toLowerCase()}-${t.date.getFullYear()}`,
          type:    'conjunction',
          planet:  planet.name,
          body2:   'Sun',
          date:    t.date,
        })
        const next = new Date(t.date.getTime() + planet.synodic * 86400000 * 0.9)
        t = A.SearchRelativeLongitude(planet.body, 0, A.MakeTime(next))
        n++
      }
    } catch { /* no more */ }
  }

  results.sort((a, b) => a.date - b.date)
  return results.slice(0, count * OUTER.length)
}

// ── Upcoming events near a given date ────────────────────────────────────────
// Returns events within ±windowDays of `nearDate`, sorted by abs(distance).
export function eventsNear(allEvents, nearDate, windowDays = 30) {
  const ms = windowDays * 86400000
  return allEvents
    .filter(e => Math.abs((e.date ?? e.peak) - nearDate) < ms)
    .sort((a, b) => Math.abs((a.date ?? a.peak) - nearDate) - Math.abs((b.date ?? b.peak) - nearDate))
}
