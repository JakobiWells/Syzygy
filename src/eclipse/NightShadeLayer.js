import { getSubSolarPoint } from './daynight'

// ─── Math helpers ───────────────────────────────────────────────────────────

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// ─── Tile helpers ──────────────────────────────────────────────────────────

function tileXToLng(x, z) { return x / (1 << z) * 360 - 180 }
function tileYToLat(y, z) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (1 << z)))) * 180 / Math.PI
}

function fetchTile(x, y, z) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 256; c.height = 256
      c.getContext('2d').drawImage(img, 0, 0)
      resolve(new Uint8Array(c.getContext('2d').getImageData(0, 0, 256, 256).data))
    }
    img.onerror = () => {
      const px = new Uint8Array(256 * 256 * 4)
      for (let i = 0; i < 256 * 256; i++) { px[i * 4] = 128; px[i * 4 + 3] = 255 }
      resolve(px)
    }
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  })
}

async function buildGlobalTerrainData(z = 3) {
  const n    = 1 << z
  const TILE = 256
  const texW = n * TILE
  const texH = n * TILE
  const buf  = new Uint8Array(texW * texH * 4)

  await Promise.all(
    Array.from({ length: n * n }, (_, idx) => {
      const r = Math.floor(idx / n)
      const c = idx % n
      return fetchTile(c, r, z).then(px => {
        for (let py = 0; py < TILE; py++) {
          const src = py * TILE * 4
          const dst = ((r * TILE + py) * texW + c * TILE) * 4
          buf.set(px.subarray(src, src + TILE * 4), dst)
        }
      })
    })
  )

  return {
    buf, texW, texH,
    bounds: [tileXToLng(0, z), tileYToLat(n, z), tileXToLng(n, z), tileYToLat(0, z)],
  }
}

// ─── Canvas dimensions ─────────────────────────────────────────────────────

const CANVAS_W = 2048
const CANVAS_H = 1024

// Geographic bounds of the canvas (equirectangular)
const BOUNDS_W = -180
const BOUNDS_E =  180
const BOUNDS_N =  85.05
const BOUNDS_S = -85.05

// ─── Layer ─────────────────────────────────────────────────────────────────

export class NightShadeLayer {
  constructor() {
    this.id            = 'night-shade-terrain'
    this.type          = 'custom'
    this.renderingMode = '2d'
    this._sunLng       = 0
    this._sunDec       = 0
    this._visible      = true
    this._map          = null
    this._canvas       = null
    this._ctx          = null
    this._terrain      = null
    this._terrainW     = 0
    this._terrainH     = 0
    this._terrainBounds = null
    this._paintScheduled = false
  }

  onAdd(map, _gl) {
    this._map = map

    this._canvas = document.createElement('canvas')
    this._canvas.width  = CANVAS_W
    this._canvas.height = CANVAS_H
    this._ctx = this._canvas.getContext('2d')

    // Blank initial image
    map.addSource('night-shade-img', {
      type: 'image',
      url: this._blankDataUrl(),
      coordinates: [
        [BOUNDS_W, BOUNDS_N],
        [BOUNDS_E, BOUNDS_N],
        [BOUNDS_E, BOUNDS_S],
        [BOUNDS_W, BOUNDS_S],
      ],
    })
    map.addLayer({
      id: 'night-shade-raster',
      type: 'raster',
      source: 'night-shade-img',
      paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 },
    }, 'night-shade-terrain')

    // Load terrain, then paint
    buildGlobalTerrainData(3).then(({ buf, texW, texH, bounds }) => {
      this._terrain      = buf
      this._terrainW     = texW
      this._terrainH     = texH
      this._terrainBounds = bounds
      this._paint()
    }).catch(() => {
      this._paint()  // render without terrain correction
    })
  }

  _blankDataUrl() {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    return c.toDataURL()
  }

  _sampleElev(lng, lat) {
    if (!this._terrain || !this._terrainBounds) return 0
    const [tw, ts, te, tn] = this._terrainBounds
    const u = (lng - tw) / (te - tw)
    const v = 1 - (lat - ts) / (tn - ts)
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0
    const px = Math.min(Math.floor(u * this._terrainW), this._terrainW - 1)
    const py = Math.min(Math.floor(v * this._terrainH), this._terrainH - 1)
    const i  = (py * this._terrainW + px) * 4
    return this._terrain[i] * 256 + this._terrain[i + 1] + this._terrain[i + 2] / 256 - 32768
  }

  _paint() {
    if (!this._canvas || !this._map) return

    const imgData = this._ctx.createImageData(CANVAS_W, CANVAS_H)
    const data    = imgData.data

    const PI      = Math.PI
    const DEG     = PI / 180
    const R_EARTH = 6371000
    const sunLng  = this._sunLng
    const dec     = this._sunDec  // radians
    const lngSpan = BOUNDS_E - BOUNDS_W
    const latSpan = BOUNDS_N - BOUNDS_S

    for (let y = 0; y < CANVAS_H; y++) {
      const lat   = BOUNDS_N - (y / CANVAS_H) * latSpan
      const lat_r = lat * DEG
      const sinLat = Math.sin(lat_r)
      const cosLat = Math.cos(lat_r)

      for (let x = 0; x < CANVAS_W; x++) {
        const lng = BOUNDS_W + (x / CANVAS_W) * lngSpan

        // Solar altitude
        const H      = (lng - sunLng) * DEG
        const sinAlt = sinLat * Math.sin(dec) + cosLat * Math.cos(dec) * Math.cos(H)
        const alt    = Math.asin(Math.max(-1, Math.min(1, sinAlt)))

        // Terrain horizon dip
        const elev   = Math.max(0, this._sampleElev(lng, lat))
        const dip    = Math.sqrt(2 * elev / R_EARTH)
        const adjAlt = alt + dip

        if (adjAlt >= 0) continue  // fully lit — leave pixel transparent

        // Smooth civil-twilight gradient: 0 at terminator → 1 at −6°
        const t     = 1 - smoothstep(-6 * DEG, 0, adjAlt)
        const alpha = Math.round(190 * t)  // max ~75% opacity

        const i = (y * CANVAS_W + x) * 4
        data[i]     = 10
        data[i + 1] = 20
        data[i + 2] = 51
        data[i + 3] = alpha
      }
    }

    this._ctx.putImageData(imgData, 0, 0)
    this._map.getSource('night-shade-img')?.updateImage({
      url: this._canvas.toDataURL('image/png'),
      coordinates: [
        [BOUNDS_W, BOUNDS_N],
        [BOUNDS_E, BOUNDS_N],
        [BOUNDS_E, BOUNDS_S],
        [BOUNDS_W, BOUNDS_S],
      ],
    })
  }

  setDate(date) {
    const [sunLng, sunLat] = getSubSolarPoint(date)
    this._sunLng = sunLng
    this._sunDec = sunLat * Math.PI / 180
    if (!this._paintScheduled) {
      this._paintScheduled = true
      requestAnimationFrame(() => {
        this._paintScheduled = false
        this._paint()
      })
    }
  }

  setVisible(v) {
    this._visible = v
    if (this._map?.getLayer('night-shade-raster')) {
      this._map.setLayoutProperty('night-shade-raster', 'visibility', v ? 'visible' : 'none')
    }
  }

  // Custom layer interface requires render — no WebGL drawing needed here
  render() {}

  onRemove(map) {
    if (map.getLayer('night-shade-raster')) map.removeLayer('night-shade-raster')
    if (map.getSource('night-shade-img'))   map.removeSource('night-shade-img')
    this._map    = null
    this._canvas = null
    this._ctx    = null
  }
}
