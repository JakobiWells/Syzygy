// Syzygy weather tile proxy
// Routes:
//   /tiles/{layer}/{z}/{x}/{y}.png          — OWM Maps 1.0 (current)
//   /tiles/v2/{op}/{z}/{x}/{y}.png?date={s} — OWM Maps 2.0 (time-aware)

const CACHE_TTL    = 60 * 60
const OWM_BASE_V1  = 'https://tile.openweathermap.org/map'
const OWM_BASE_V2  = 'https://maps.openweathermap.org/maps/2.0/weather'

const VALID_V1 = new Set(['precipitation_new', 'clouds_new', 'temp_new', 'wind_new', 'pressure_new'])

// OWM Maps 2.0 op codes
const V1_TO_V2 = {
  precipitation_new: 'PA0',
  clouds_new:        'CL',
  temp_new:          'TA2',
  wind_new:          'WS10',
  pressure_new:      'APM',
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

async function proxyTile(owmUrl, cacheKey, cors, cache) {
  const cached = await cache.match(cacheKey)
  if (cached) return new Response(cached.body, { headers: { ...Object.fromEntries(cached.headers), ...cors } })

  const resp = await fetch(owmUrl)
  if (!resp.ok) return new Response(`OWM error: ${resp.status}`, { status: resp.status, headers: cors })

  const body    = await resp.arrayBuffer()
  const headers = {
    ...cors,
    'Content-Type':  resp.headers.get('Content-Type') ?? 'image/png',
    'Cache-Control': `public, max-age=${CACHE_TTL}`,
  }
  const toCache = new Response(body, { status: 200, headers })
  await cache.put(cacheKey, toCache.clone())
  return new Response(body, { status: 200, headers })
}

export default {
  async fetch(request, env) {
    const url  = new URL(request.url)
    const cors = corsHeaders()

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (url.pathname === '/health')   return new Response('ok', { headers: { ...cors, 'Content-Type': 'text/plain' } })

    if (!env.OWM_KEY) return new Response('OWM_KEY not configured', { status: 500, headers: cors })

    const cache = caches.default

    // ── OWM Maps 2.0 time-aware: /tiles/v2/{layer}/{z}/{x}/{y}.png?date={unix_s}
    const v2Match = url.pathname.match(/^\/tiles\/v2\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.png$/)
    if (v2Match) {
      const [, layer, z, x, y] = v2Match
      const op = V1_TO_V2[layer]
      if (!op) return new Response(`Unknown layer: ${layer}`, { status: 400, headers: cors })

      const date    = url.searchParams.get('date') ?? Math.floor(Date.now() / 1000)
      const rounded = Math.round(Number(date) / 3600) * 3600
      const v2Url   = `${OWM_BASE_V2}/${op}/${z}/${x}/${y}?appid=${env.OWM_KEY}&date=${rounded}`
      const cacheKey = new Request(`${url.origin}/tiles/v2/${layer}/${z}/${x}/${y}.png?date=${rounded}`, { method: 'GET' })

      const cached = await cache.match(cacheKey)
      if (cached) return new Response(cached.body, { headers: { ...Object.fromEntries(cached.headers), ...corsHeaders() } })

      const v2Resp = await fetch(v2Url)

      // Maps 2.0 requires a paid plan — fall back to Maps 1.0 (current) transparently
      if (!v2Resp.ok) {
        const v1Url  = `${OWM_BASE_V1}/${layer}/${z}/${x}/${y}.png?appid=${env.OWM_KEY}`
        const v1Resp = await fetch(v1Url)
        if (!v1Resp.ok) return new Response(`OWM error: ${v1Resp.status}`, { status: v1Resp.status, headers: corsHeaders() })
        const body    = await v1Resp.arrayBuffer()
        const headers = { ...corsHeaders(), 'Content-Type': v1Resp.headers.get('Content-Type') ?? 'image/png', 'Cache-Control': `public, max-age=${CACHE_TTL}` }
        await cache.put(cacheKey, new Response(body, { status: 200, headers }).clone())
        return new Response(body, { status: 200, headers })
      }

      const body    = await v2Resp.arrayBuffer()
      const headers = { ...corsHeaders(), 'Content-Type': v2Resp.headers.get('Content-Type') ?? 'image/png', 'Cache-Control': `public, max-age=${CACHE_TTL}` }
      await cache.put(cacheKey, new Response(body, { status: 200, headers }).clone())
      return new Response(body, { status: 200, headers })
    }

    // ── OWM Maps 1.0 current: /tiles/{layer}/{z}/{x}/{y}.png
    const v1Match = url.pathname.match(/^\/tiles\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.png$/)
    if (!v1Match) return new Response('Not found', { status: 404, headers: cors })

    const [, layer, z, x, y] = v1Match
    if (!VALID_V1.has(layer)) return new Response(`Unknown layer: ${layer}`, { status: 400, headers: cors })

    const owmUrl  = `${OWM_BASE_V1}/${layer}/${z}/${x}/${y}.png?appid=${env.OWM_KEY}`
    const cacheKey = new Request(request.url, { method: 'GET' })
    return proxyTile(owmUrl, cacheKey, cors, cache)
  },
}
