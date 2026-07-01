import SunCalc from 'suncalc'

const VERT = `
attribute vec2 a_pos;
attribute vec2 a_lnglat;
uniform mat4 u_matrix;
varying vec2 v_lnglat;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_lnglat = a_lnglat;
}
`

// Ray-march toward the sun in 300 steps of u_step_m metres each.
// Half-texel stepping gives sub-texel resolution via bilinear filtering.
const FRAG = `
precision highp float;
varying vec2 v_lnglat;
uniform sampler2D u_terrain;
uniform vec4 u_tex_bounds;
uniform vec2 u_sun;
uniform float u_opacity;
uniform float u_step_m;

float sampleElev(float lng, float lat) {
  float u = (lng - u_tex_bounds.x) / (u_tex_bounds.z - u_tex_bounds.x);
  float v = 1.0 - (lat - u_tex_bounds.y) / (u_tex_bounds.w - u_tex_bounds.y);
  if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) return -32768.0;
  vec4 c = texture2D(u_terrain, vec2(u, v)) * 255.0;
  return c.r * 256.0 + c.g + c.b / 256.0 - 32768.0;
}

void main() {
  float lng = v_lnglat.x;
  float lat = v_lnglat.y;
  float sunAlt = u_sun.y;
  if (sunAlt <= 0.0) { discard; return; }

  float e0 = max(-500.0, sampleElev(lng, lat));
  float tanAlt = tan(sunAlt);
  float cosLat = max(0.01, cos(lat * 0.01745329251));
  float az = u_sun.x;
  float stepM = u_step_m;
  float dLat = stepM * cos(az) / 111320.0;
  float dLng = stepM * sin(az) / (111320.0 * cosLat);

  bool inShadow = false;
  for (int i = 1; i <= 300; i++) {
    float fi = float(i);
    float e = sampleElev(lng + fi * dLng, lat + fi * dLat);
    if (e > -9000.0 && e > e0 + fi * stepM * tanAlt + 2.0) {
      inShadow = true;
      break;
    }
  }

  if (inShadow) {
    gl_FragColor = vec4(0.0, 0.02, 0.1, u_opacity);
  } else {
    discard;
  }
}
`

function compileShader(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('TerrainShadow shader error:', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

function linkProgram(gl, vertSrc, fragSrc) {
  const v = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!v || !f) return null
  const p = gl.createProgram()
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('TerrainShadow link error:', gl.getProgramInfoLog(p))
    gl.deleteProgram(p)
    return null
  }
  return p
}

// ─── Tile helpers ──────────────────────────────────────────────────────────

function lngToTileX(lng, z) {
  return Math.floor((lng + 180) / 360 * (1 << z))
}
function latToTileY(lat, z) {
  const r = lat * Math.PI / 180
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z))
}
function tileXToLng(x, z) { return x / (1 << z) * 360 - 180 }
function tileYToLat(y, z) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (1 << z)))) * 180 / Math.PI
}

function fetchTilePixels(x, y, z) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Each fetch gets its own canvas — fully parallel-safe
      const c = document.createElement('canvas')
      c.width = 256; c.height = 256
      c.getContext('2d').drawImage(img, 0, 0)
      resolve(new Uint8Array(c.getContext('2d').getImageData(0, 0, 256, 256).data))
    }
    img.onerror = () => {
      // Sea level: R=128, G=0, B=0 → 128*256+0+0-32768 = 0 m
      const px = new Uint8Array(256 * 256 * 4)
      for (let i = 0; i < 256 * 256; i++) { px[i * 4] = 128; px[i * 4 + 3] = 255 }
      resolve(px)
    }
    img.src = url
  })
}

async function buildTerrainTexture(map) {
  const bounds = map.getBounds()
  const west  = Math.max(-180, bounds.getWest())
  const east  = Math.min(180,  bounds.getEast())
  const south = Math.max(-85,  bounds.getSouth())
  const north = Math.min(85,   bounds.getNorth())

  // One zoom level below map zoom keeps tile count at ~12–20 tiles regardless
  // of how zoomed in/out the user is, while staying close to the map resolution.
  // Cap at z=10 (Terrarium z=10 tiles are ~150 m/px at equator — sufficient detail).
  const z = Math.max(2, Math.min(10, Math.floor(map.getZoom()) - 1))
  const n = 1 << z

  const x0 = lngToTileX(west,  z)
  const x1 = lngToTileX(east,  z)
  const y0 = latToTileY(north, z)
  const y1 = latToTileY(south, z)

  const cols = Math.min(x1 - x0 + 1, 8)
  const rows = Math.min(y1 - y0 + 1, 8)

  const TILE = 256
  const texW = cols * TILE
  const texH = rows * TILE
  const buf  = new Uint8Array(texW * texH * 4)

  // Fetch all tiles in parallel — each has its own canvas, no race conditions
  await Promise.all(
    Array.from({ length: rows * cols }, (_, idx) => {
      const r = Math.floor(idx / cols)
      const c = idx % cols
      const tx = ((x0 + c) % n + n) % n
      const ty = Math.max(0, Math.min(n - 1, y0 + r))
      return fetchTilePixels(tx, ty, z).then(px => {
        for (let py = 0; py < TILE; py++) {
          const srcRow = py * TILE * 4
          const dstRow = ((r * TILE + py) * texW + c * TILE) * 4
          buf.set(px.subarray(srcRow, srcRow + TILE * 4), dstRow)
        }
      })
    })
  )

  const texBounds = [
    tileXToLng(x0,        z),
    tileYToLat(y0 + rows, z),
    tileXToLng(x0 + cols, z),
    tileYToLat(y0,        z),
  ]

  // Half-texel step size: ray advances half a texel per step, letting bilinear
  // filtering provide sub-texel resolution for smoother shadow edges
  const texelDegLng = (texBounds[2] - texBounds[0]) / texW
  const centerLat   = (texBounds[1] + texBounds[3]) / 2
  const texelM      = texelDegLng * 111320 * Math.cos(centerLat * Math.PI / 180)
  const stepM       = Math.max(80, texelM * 0.5)

  return { buf, texW, texH, texBounds, stepM }
}

// ─── Mercator helpers ──────────────────────────────────────────────────────

function lngToMerc(lng) { return (lng + 180) / 360 }
function latToMerc(lat) {
  const sin = Math.sin(lat * Math.PI / 180)
  return (1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2
}

// ─── Custom layer ──────────────────────────────────────────────────────────

export class TerrainShadowLayer {
  constructor() {
    this.id = 'terrain-shadow'
    this.type = 'custom'
    this.renderingMode = '2d'
    this._sunAz     = 0
    this._sunAlt    = -1
    this._texBounds = [-180, -85, 180, 85]
    this._stepM     = 80
    this._loading   = false
  }

  onAdd(map, gl) {
    this._map = map
    this._gl  = gl

    this._prog = linkProgram(gl, VERT, FRAG)
    if (!this._prog) return

    this._aPos       = gl.getAttribLocation(this._prog, 'a_pos')
    this._aLngLat    = gl.getAttribLocation(this._prog, 'a_lnglat')
    this._uMatrix    = gl.getUniformLocation(this._prog, 'u_matrix')
    this._uTexBounds = gl.getUniformLocation(this._prog, 'u_tex_bounds')
    this._uSun       = gl.getUniformLocation(this._prog, 'u_sun')
    this._uOpacity   = gl.getUniformLocation(this._prog, 'u_opacity')
    this._uStepM     = gl.getUniformLocation(this._prog, 'u_step_m')
    this._uTerrain   = gl.getUniformLocation(this._prog, 'u_terrain')

    this._tex  = gl.createTexture()
    this._vbuf = gl.createBuffer()
    this._ibuf = gl.createBuffer()

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.bindTexture(gl.TEXTURE_2D, this._tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([128, 0, 0, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    this.refresh()
  }

  async refresh() {
    if (this._loading || !this._map || !this._gl) return
    this._loading = true
    try {
      const { buf, texW, texH, texBounds, stepM } = await buildTerrainTexture(this._map)
      const gl = this._gl
      if (!gl || !this._tex) return
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, this._tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, buf)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindTexture(gl.TEXTURE_2D, null)
      this._texBounds = texBounds
      this._stepM     = stepM
      this._map.triggerRepaint()
    } catch (e) {
      console.warn('TerrainShadow: tile fetch failed', e)
    } finally {
      this._loading = false
    }
  }

  setDate(date) {
    if (!this._map) return
    const c = this._map.getCenter()
    const pos = SunCalc.getPosition(date, c.lat, c.lng)
    this._sunAz  = (((pos.azimuth * 180 / Math.PI) + 180) % 360) * Math.PI / 180
    this._sunAlt = pos.altitude
    this._map.triggerRepaint()
  }

  render(gl, matrix) {
    if (!this._prog) return

    const [west, south, east, north] = this._texBounds
    const GRID   = 64
    const stride = 16 // 4 floats × 4 bytes

    const verts = new Float32Array((GRID + 1) * (GRID + 1) * 4)
    let vi = 0
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        const lat = south + (north - south) * r / GRID
        const lng = west  + (east  - west)  * c / GRID
        verts[vi++] = lngToMerc(lng)
        verts[vi++] = latToMerc(lat)
        verts[vi++] = lng
        verts[vi++] = lat
      }
    }

    const indices = new Uint16Array(GRID * GRID * 6)
    let ii = 0
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const i = r * (GRID + 1) + c
        indices[ii++] = i;         indices[ii++] = i + 1;         indices[ii++] = i + GRID + 1
        indices[ii++] = i + 1;     indices[ii++] = i + GRID + 2;  indices[ii++] = i + GRID + 1
      }
    }

    gl.useProgram(this._prog)

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbuf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibuf)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW)

    gl.enableVertexAttribArray(this._aPos)
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(this._aLngLat)
    gl.vertexAttribPointer(this._aLngLat, 2, gl.FLOAT, false, stride, 8)

    gl.uniformMatrix4fv(this._uMatrix, false, matrix)
    gl.uniform4f(this._uTexBounds, west, south, east, north)
    gl.uniform2f(this._uSun, this._sunAz, this._sunAlt)
    gl.uniform1f(this._uOpacity, 0.65)
    gl.uniform1f(this._uStepM, this._stepM)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._tex)
    gl.uniform1i(this._uTerrain, 0)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)

    gl.disableVertexAttribArray(this._aPos)
    gl.disableVertexAttribArray(this._aLngLat)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  onRemove(_map, gl) {
    if (this._prog) gl.deleteProgram(this._prog)
    if (this._tex)  gl.deleteTexture(this._tex)
    if (this._vbuf) gl.deleteBuffer(this._vbuf)
    if (this._ibuf) gl.deleteBuffer(this._ibuf)
    this._map = null
    this._gl  = null
  }
}
