#!/usr/bin/env node
/**
 * Fetch ISS TLE archive from Space-Track.org with tiered density:
 *   - Last 2 years : one TLE per 6 hours  (transit accuracy ~few km)
 *   - 2–10 years ago : one TLE per day
 *   - Older         : one TLE per week
 *
 * Requires a free Space-Track account: https://www.space-track.org/auth/createAccount
 *
 * Usage:
 *   SPACETRACK_USER=you@example.com SPACETRACK_PASS=yourpass node scripts/fetchIssArchive.mjs
 *
 * Writes: src/eclipse/issArchive.json  (array of [epochMs, line1, line2])
 */

import { writeFileSync } from 'fs'

const BASE       = 'https://www.space-track.org'
const NORAD      = 25544
const ISS_LAUNCH = '1998-11-18'
const TODAY      = new Date().toISOString().slice(0, 10)
const LAUNCH_MS  = new Date(ISS_LAUNCH + 'T00:00:00Z').getTime()
const NOW_MS     = Date.now()

// Tier boundaries (ms from now)
const TWO_YEARS_MS = 2 * 365.25 * 24 * 3600 * 1000
const TEN_YEARS_MS = 10 * 365.25 * 24 * 3600 * 1000

// Bucket sizes by tier
const SIX_HOUR_MS = 6 * 3600 * 1000
const DAY_MS      = 24 * 3600 * 1000
const WEEK_MS     = 7 * 24 * 3600 * 1000

function bucketSize(epochMs) {
  const age = NOW_MS - epochMs
  if (age <= TWO_YEARS_MS) return SIX_HOUR_MS
  if (age <= TEN_YEARS_MS) return DAY_MS
  return WEEK_MS
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login(user, pass) {
  const res = await fetch(`${BASE}/ajaxauth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `identity=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`)
  const raw = res.headers.getSetCookie?.() ?? []
  if (!raw.length) throw new Error('No session cookie returned — wrong credentials?')
  return raw.map(c => c.split(';')[0]).join('; ')
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAll(cookie) {
  const url = `${BASE}/basicspacedata/query/class/gp_history`
    + `/NORAD_CAT_ID/${NORAD}`
    + `/EPOCH/${ISS_LAUNCH}--${TODAY}`
    + `/orderby/EPOCH%20asc`
    + `/format/json`

  process.stdout.write('Downloading GP history (may take 30–60 s)…')
  const res = await fetch(url, { headers: { Cookie: cookie } })
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`)
  const data = await res.json()
  process.stdout.write(` ${data.length} records.\n`)
  return data
}

// ── Tiered downsample ─────────────────────────────────────────────────────────

function parseEpochMs(epochStr) {
  return new Date(epochStr.replace(' ', 'T') + 'Z').getTime()
}

function downsample(records) {
  // Each record goes into a bucket based on its age tier.
  // Within each bucket we keep the TLE whose epoch is closest to the bucket midpoint.
  const buckets = new Map()

  for (const rec of records) {
    const t    = parseEpochMs(rec.EPOCH)
    const bSz  = bucketSize(t)
    const bIdx = Math.floor((t - LAUNCH_MS) / bSz)
    const bMid = LAUNCH_MS + (bIdx + 0.5) * bSz
    const dist = Math.abs(t - bMid)
    const key  = `${bSz}-${bIdx}`   // unique per (tier, bucket)
    const existing = buckets.get(key)
    if (!existing || dist < existing.dist) {
      buckets.set(key, { epochMs: t, l1: rec.TLE_LINE1, l2: rec.TLE_LINE2, dist })
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.epochMs - b.epochMs)
    .map(({ epochMs, l1, l2 }) => [epochMs, l1.trim(), l2.trim()])
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const user = process.env.SPACETRACK_USER
  const pass = process.env.SPACETRACK_PASS
  if (!user || !pass) {
    console.error(
      'Missing credentials.\n' +
      'Usage: SPACETRACK_USER=you@email.com SPACETRACK_PASS=pass node scripts/fetchIssArchive.mjs\n' +
      'Get a free account at: https://www.space-track.org/auth/createAccount'
    )
    process.exit(1)
  }

  console.log('Logging in to Space-Track.org…')
  const cookie  = await login(user, pass)
  console.log('Login OK.')

  const records  = await fetchAll(cookie)
  const archive  = downsample(records)

  const twoYearsAgo = new Date(NOW_MS - TWO_YEARS_MS).toISOString().slice(0, 10)
  const tenYearsAgo = new Date(NOW_MS - TEN_YEARS_MS).toISOString().slice(0, 10)
  const recent  = archive.filter(([t]) => NOW_MS - t <= TWO_YEARS_MS).length
  const mid     = archive.filter(([t]) => NOW_MS - t > TWO_YEARS_MS && NOW_MS - t <= TEN_YEARS_MS).length
  const old     = archive.filter(([t]) => NOW_MS - t > TEN_YEARS_MS).length
  console.log(`Tiered result: ${old} weekly (<${tenYearsAgo}) + ${mid} daily + ${recent} 6-hourly (>${twoYearsAgo}) = ${archive.length} total`)

  const json = JSON.stringify(archive)
  writeFileSync('src/eclipse/issArchive.json', json)
  console.log(`Wrote src/eclipse/issArchive.json  (${(json.length / 1024).toFixed(0)} KB raw)`)
  console.log('Done. Re-run whenever you want fresher history.')
}

main().catch(e => { console.error('[error]', e.message); process.exit(1) })
