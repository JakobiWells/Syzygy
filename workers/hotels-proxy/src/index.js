// Syzygy hotels proxy
// Uses Google Places API for data, caches in D1 so each eclipse path is fetched once.
// Secrets: GOOGLE_PLACES_KEY, CJ_BOOKING_AID, CJ_AIRBNB_AID

const PLACES_BASE  = 'https://maps.googleapis.com/maps/api/place'
const CACHE_DAYS   = 30
const RADIUS_M     = 40000  // 40km search radius per sample point

const cors = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  })
}

// Fetch hotels from Google Places near a point
async function placesNearby(lat, lng, key) {
  const url = `${PLACES_BASE}/nearbysearch/json?location=${lat},${lng}&radius=${RADIUS_M}&type=lodging&key=${key}`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()
  return (data.results ?? []).map(p => ({
    place_id:     p.place_id,
    name:         p.name,
    lat:          p.geometry.location.lat,
    lng:          p.geometry.location.lng,
    rating:       p.rating ?? null,
    rating_count: p.user_ratings_total ?? null,
    price_level:  p.price_level ?? null,
    photo_ref:    p.photos?.[0]?.photo_reference ?? null,
    address:      p.vicinity ?? null,
  }))
}

// Deduplicate by place_id
function dedupe(hotels) {
  const seen = new Set()
  return hotels.filter(h => { if (seen.has(h.place_id)) return false; seen.add(h.place_id); return true })
}

// Build affiliate booking URLs
function bookingUrls(hotel, checkin, checkout, env) {
  const location = encodeURIComponent(hotel.address ?? hotel.name)
  const name     = encodeURIComponent(hotel.name)

  return {
    booking: `https://www.booking.com/search.html?ss=${name}&checkin=${checkin}&checkout=${checkout}${env.CJ_BOOKING_AID ? `&aid=${env.CJ_BOOKING_AID}` : ''}`,
    airbnb:  `https://www.airbnb.com/s/${location}/homes?checkin=${checkin}&checkout=${checkout}${env.CJ_AIRBNB_AID ? `&af_id=${env.CJ_AIRBNB_AID}` : ''}`,
    hotels:  `https://www.hotels.com/search.do?q-destination=${location}&q-check-in=${checkin}&q-check-out=${checkout}`,
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
    if (url.pathname === '/health')   return new Response('ok', { headers: { ...cors(), 'Content-Type': 'text/plain' } })

    // ── Photo proxy — keeps Google API key server-side ────────────────────────
    // GET /photo?ref={photo_reference}&w=600
    if (url.pathname === '/photo') {
      const ref = url.searchParams.get('ref')
      const w   = url.searchParams.get('w') ?? '600'
      if (!ref || !env.GOOGLE_PLACES_KEY) return new Response('Missing ref', { status: 400 })

      const photoUrl = `${PLACES_BASE}/photo?maxwidth=${w}&photo_reference=${ref}&key=${env.GOOGLE_PLACES_KEY}`
      const resp     = await fetch(photoUrl, { redirect: 'follow' })
      return new Response(resp.body, {
        status: resp.status,
        headers: {
          ...cors(),
          'Content-Type':  resp.headers.get('Content-Type') ?? 'image/jpeg',
          'Cache-Control': 'public, max-age=604800',  // photos don't change
        },
      })
    }

    // ── Hotel search — checks D1 cache, falls back to Google Places ───────────
    // POST /hotels  body: { eclipseCat, checkin, checkout, samplePoints: [[lng,lat],...] }
    if (url.pathname === '/hotels' && request.method === 'POST') {
      if (!env.GOOGLE_PLACES_KEY) return json({ error: 'GOOGLE_PLACES_KEY not configured' }, 500)

      const { eclipseCat, checkin, checkout, samplePoints } = await request.json()
      if (!eclipseCat || !samplePoints?.length) return json({ error: 'eclipseCat and samplePoints required' }, 400)

      const staleCutoff = Math.floor(Date.now() / 1000) - CACHE_DAYS * 86400

      // Check if we have fresh cached data for this eclipse
      const cached = await env.DB.prepare(
        'SELECT * FROM hotels WHERE eclipse_cat = ? AND cached_at > ? ORDER BY rating DESC'
      ).bind(eclipseCat, staleCutoff).all()

      if (cached.results.length > 0) {
        const hotels = cached.results.map(h => ({
          ...h,
          photoUrl: h.photo_ref ? `/photo?ref=${h.photo_ref}&w=600` : null,
          links:    bookingUrls(h, checkin, checkout, env),
        }))
        return json({ hotels, fromCache: true })
      }

      // Cache miss — fetch from Google Places for all sample points
      const chunks = await Promise.all(
        samplePoints.map(([lng, lat]) => placesNearby(lat, lng, env.GOOGLE_PLACES_KEY).catch(() => []))
      )
      const hotels = dedupe(chunks.flat())

      // Store in D1
      if (hotels.length > 0) {
        const now = Math.floor(Date.now() / 1000)
        const stmt = env.DB.prepare(
          `INSERT OR REPLACE INTO hotels
           (place_id, eclipse_cat, name, lat, lng, rating, rating_count, price_level, photo_ref, address, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        await env.DB.batch(
          hotels.map(h => stmt.bind(
            h.place_id, eclipseCat, h.name, h.lat, h.lng,
            h.rating, h.rating_count, h.price_level, h.photo_ref, h.address, now
          ))
        )
      }

      return json({
        hotels: hotels.map(h => ({
          ...h,
          photoUrl: h.photo_ref ? `/photo?ref=${h.photo_ref}&w=600` : null,
          links:    bookingUrls(h, checkin, checkout, env),
        })),
        fromCache: false,
      })
    }

    return json({ error: 'Not found' }, 404)
  },
}
