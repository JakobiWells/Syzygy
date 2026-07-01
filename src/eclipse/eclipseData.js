// Centerline coordinates from NASA eclipse path tables.
// Format: [longitude, latitude] (GeoJSON order — east positive, north positive)
// Entries marked "approx" use estimated waypoints centered on the NASA greatest-eclipse point.

export const ECLIPSES = {

  // ── 2020s ────────────────────────────────────────────────────────────────

  '2024': {
    type: 'total',
    year: '2024',
    label: '2024 Apr 8 — Mexico · Texas · Ohio · Maine',
    date: '2024-04-08',
    peakUTC: '18:17',
    defaultCenter: [-95, 37],
    defaultZoom: 4,
    umbraWidth: 198,
    centerLineCoords: [
      [-157.187,  -7.637], // 16:40 — Pacific Ocean
      [-138.995,  -2.889], // 16:48
      [-132.225,   0.265], // 16:56
      [-127.477,   3.105], // 17:04
      [-123.733,   5.778], // 17:12
      [-120.593,   8.342], // 17:20
      [-117.850,  10.828], // 17:28
      [-115.375,  13.257], // 17:36
      [-113.077,  15.643], // 17:44
      [-110.892,  17.993], // 17:52
      [-108.763,  20.320], // 18:00 — Sinaloa/Durango, Mexico
      [-106.647,  22.625], // 18:08
      [-104.495,  24.913], // 18:16
      [-102.265,  27.192], // 18:24 — near greatest
      [ -99.908,  29.460], // 18:32
      [ -97.370,  31.720], // 18:40 — Texas (near Waco)
      [ -94.587,  33.972], // 18:48
      [ -91.482,  36.213], // 18:56 — Arkansas/Missouri
      [ -86.985,  38.992], // 19:04 — Indiana
      [ -83.852,  40.640], // 19:12 — Ohio
      [ -78.987,  42.797], // 19:20 — upstate New York
      [ -73.040,  44.873], // 19:28 — Vermont
      [ -65.463,  46.803], // 19:36 — Maine
      [ -54.527,  48.418], // 19:44 — Atlantic
      [ -41.988,  49.065], // 19:52
      [ -27.317,  48.470], // 19:54 — end
    ],
    durationAtPoints: [
      { coords: [-108.763,  20.320], seconds: 264 },
      { coords: [-102.265,  27.192], seconds: 268 },
      { coords: [ -97.370,  31.720], seconds: 263 },
      { coords: [ -91.482,  36.213], seconds: 250 },
      { coords: [ -83.852,  40.640], seconds: 237 },
      { coords: [ -78.987,  42.797], seconds: 225 },
    ],
  },

  '2026': {
    type: 'total',
    year: '2026',
    label: '2026 Aug 12 — Spain · Balearics · Algeria',
    date: '2026-08-12',
    peakUTC: '18:30',
    defaultCenter: [-2, 41],
    defaultZoom: 5,
    umbraWidth: 280,
    centerLineCoords: [
      [-20.95,  57.30],
      [-18.06,  53.37],
      [-14.24,  49.29],
      [-11.72,  47.10],
      [ -8.40,  44.71],
      [ -6.19,  43.37], // entering NW Spain (Galicia)
      [ -3.18,  41.82], // NE Spain (Aragon / Ebro valley)
      [  0.35,  40.35], // Castellón coast (just south of Benicarló)
      [  2.95,  39.41], // western Mediterranean (near Mallorca)
      [  5.42,  38.68],
    ],
    durationAtPoints: [
      { coords: [-6.19, 43.37], seconds: 109 },
      { coords: [-3.18, 41.82], seconds: 104 },
      { coords: [ 0.35, 40.35], seconds: 102 },
      { coords: [ 2.95, 39.41], seconds:  96 },
      { coords: [ 5.42, 38.68], seconds:  80 },
    ],
  },

  '2027': {
    type: 'total',
    year: '2027',
    label: '2027 Aug 2 — Morocco · Egypt · Yemen',
    date: '2027-08-02',
    peakUTC: '10:07',
    defaultCenter: [20, 33],
    defaultZoom: 4,
    umbraWidth: 258,
    centerLineCoords: [
      [-36.23,  30.49],
      [-19.60,  34.29],
      [-10.43,  35.43],
      [ -6.72,  35.66],
      [ -3.38,  35.74],
      [ -0.33,  35.71],
      [  2.49,  35.58],
      [  5.11,  35.36],
      [  7.56,  35.07],
      [  9.86,  34.72],
      [ 12.03,  34.32],
      [ 14.09,  33.86],
      [ 16.05,  33.36],
      [ 17.91,  32.82],
      [ 19.68,  32.24],
      [ 21.39,  31.62],
      [ 23.02,  30.98],
      [ 24.59,  30.30],
      [ 26.10,  29.59],
      [ 27.56,  28.85],
      [ 28.97,  28.08],
      [ 30.34,  27.29],
      [ 31.68,  26.48],
      [ 33.18,  25.51], // GREATEST (near Luxor)
      [ 34.26,  24.78],
      [ 35.51,  23.89],
      [ 36.74,  22.98],
      [ 37.96,  22.04],
      [ 39.17,  21.09],
      [ 40.37,  20.10],
      [ 41.57,  19.10],
      [ 42.78,  18.06],
      [ 44.00,  17.00],
      [ 45.23,  15.91],
      [ 46.48,  14.79],
      [ 47.77,  13.64],
      [ 49.09,  12.46],
      [ 50.46,  11.24],
      [ 51.90,   9.97],
      [ 53.41,   8.66],
    ],
    durationAtPoints: [
      { coords: [ -3.38,  35.74], seconds: 220 },
      { coords: [  9.86,  34.72], seconds: 320 },
      { coords: [ 19.68,  32.24], seconds: 370 },
      { coords: [ 26.10,  29.59], seconds: 380 },
      { coords: [ 33.18,  25.51], seconds: 382 },
      { coords: [ 36.74,  22.98], seconds: 355 },
      { coords: [ 44.00,  17.00], seconds: 265 },
      { coords: [ 51.90,   9.97], seconds: 150 },
    ],
  },

  '2028': {
    type: 'total',
    year: '2028',
    label: '2028 Jul 22 — Kimberley · Sydney · New Zealand',
    date: '2028-07-22',
    peakUTC: '02:56',
    defaultCenter: [138, -26],
    defaultZoom: 4,
    umbraWidth: 208,
    centerLineCoords: [
      [122.11, -13.34], // 02:40 — WA coast (Kimberley)
      [124.52, -14.42], // 02:48
      [125.70, -15.02], // 02:52 — GREATEST
      [126.87, -15.67], // 02:56
      [128.03, -16.35], // 03:00
      [130.36, -17.83], // 03:08 — Northern Territory
      [132.74, -19.49], // 03:16
      [135.21, -21.33], // 03:24
      [137.85, -23.39], // 03:32
      [140.74, -25.71], // 03:40
      [144.03, -28.35], // 03:48 — Queensland
      [147.94, -31.44], // 03:56 — NSW
      [150.27, -33.20], // 04:00 — Sydney area
      [151.57, -34.17], // 04:02
      [154.53, -36.29], // 04:06 — Tasman Sea
      [158.24, -37.48], // 04:08
      [160.55, -40.27], // 04:12
      [163.38, -41.99], // 04:14
      [167.15, -44.13], // 04:16
      [173.65, -47.46], // 04:18 — end (near New Zealand)
    ],
    durationAtPoints: [
      { coords: [122.11, -13.34], seconds: 245 },
      { coords: [125.70, -15.02], seconds: 310 },
      { coords: [132.74, -19.49], seconds: 305 },
      { coords: [140.74, -25.71], seconds: 295 },
      { coords: [150.27, -33.20], seconds: 255 },
      { coords: [160.55, -40.27], seconds: 175 },
    ],
  },

  // ── 2030s ────────────────────────────────────────────────────────────────

  '2030': {
    type: 'total',
    year: '2030',
    label: '2030 Nov 25 — Namibia · Botswana · Indian Ocean',
    date: '2030-11-25',
    peakUTC: '06:51',
    defaultCenter: [30, -32],
    defaultZoom: 3,
    umbraWidth: 310,
    // approx — path crosses southern Africa then arcs into southern Indian Ocean
    centerLineCoords: [
      [ -4.0, -27.5],
      [  5.5, -24.5],
      [ 11.5, -22.5], // Namibia coast
      [ 18.0, -21.8], // Botswana
      [ 24.5, -22.3], // Zimbabwe
      [ 31.0, -24.5], // Mozambique / Limpopo
      [ 38.5, -28.5], // Mozambique coast
      [ 48.0, -33.5], // Indian Ocean
      [ 60.0, -39.5],
      [ 72.0, -44.0], // near greatest
      [ 86.0, -44.5],
    ],
    durationAtPoints: [
      { coords: [11.5, -22.5], seconds: 170 },
      { coords: [18.0, -21.8], seconds: 195 },
      { coords: [24.5, -22.3], seconds: 210 },
      { coords: [72.0, -44.0], seconds: 224 },
    ],
  },

  '2031': {
    type: 'hybrid',
    year: '2031',
    label: '2031 Nov 14 — S Atlantic · Cape Town · Indian Ocean',
    date: '2031-11-14',
    peakUTC: '01:07',
    defaultCenter: [20, -40],
    defaultZoom: 3,
    umbraWidth: 130,
    // approx — hybrid eclipse grazes southern Africa, runs through southern Indian Ocean
    centerLineCoords: [
      [-32.0, -37.0],
      [-20.0, -38.5],
      [ -8.0, -39.5],
      [  2.0, -40.0], // south of Cape Town
      [ 14.0, -40.5],
      [ 26.0, -40.5],
      [ 38.0, -40.2],
      [ 52.0, -39.5],
      [ 66.0, -38.5],
      [ 80.0, -37.0],
      [ 95.0, -35.0],
    ],
    durationAtPoints: [
      { coords: [  2.0, -40.0], seconds:  48 },
      { coords: [ 26.0, -40.5], seconds:  82 },
      { coords: [ 52.0, -39.5], seconds: 128 },
    ],
  },

  '2033': {
    type: 'total',
    year: '2033',
    label: '2033 Mar 30 — Alaska · Arctic Ocean',
    date: '2033-03-30',
    peakUTC: '18:01',
    defaultCenter: [-158, 66],
    defaultZoom: 4,
    umbraWidth: 781,
    centerLineCoords: [
      [-174.57, 61.83],
      [-169.94, 62.92],
      [-166.92, 63.90],
      [-164.57, 64.86],
      [-162.63, 65.80],
      [-160.97, 66.75],
      [-159.54, 67.70],
      [-158.29, 68.67],
      [-157.21, 69.65],
      [-156.30, 70.66],
      [-155.56, 71.70], // GREATEST
      [-155.02, 72.76],
      [-154.72, 73.87],
      [-154.72, 75.03],
      [-155.14, 76.23],
      [-156.18, 77.50],
      [-158.22, 78.85],
      [-162.03, 80.26],
      [-169.48, 81.73],
    ],
    durationAtPoints: [
      { coords: [-174.57, 61.83], seconds: 140 },
      { coords: [-162.63, 65.80], seconds: 153 },
      { coords: [-157.21, 69.65], seconds: 157 },
      { coords: [-155.56, 71.70], seconds: 157 },
    ],
  },

  '2034': {
    type: 'total',
    year: '2034',
    label: '2034 Mar 20 — Nigeria · Sudan · Arabia · India',
    date: '2034-03-20',
    peakUTC: '10:17',
    defaultCenter: [22, 16],
    defaultZoom: 4,
    umbraWidth: 159,
    centerLineCoords: [
      [ -32.976,  0.887],
      [ -19.486,  0.107],
      [ -13.148,  1.112],
      [  -8.513,  2.118],
      [  -4.758,  3.128],
      [  -1.555,  4.140],
      [   1.265,  5.153],
      [   3.807,  6.170],
      [   6.135,  7.188],
      [   7.595,  7.868],
      [   9.673,  8.892],
      [  11.645,  9.918],
      [  13.535, 10.948],
      [  15.363, 11.982],
      [  17.148, 13.018],
      [  18.907, 14.062],
      [  20.653, 15.108],
      [  22.402, 16.162], // GREATEST
      [  24.168, 17.218],
      [  25.965, 18.283],
      [  27.808, 19.355],
      [  29.715, 20.432],
      [  31.703, 21.518],
      [  33.797, 22.611],
      [  36.020, 23.713],
      [  39.240, 25.198],
      [  41.872, 26.323],
      [  44.843, 27.460],
      [  48.135, 28.607],
      [  51.905, 29.767],
      [  56.353, 30.958],
      [  61.850, 32.130],
      [  69.280, 33.335],
      [  83.195, 34.558],
    ],
    durationAtPoints: [
      { coords: [  7.595,  7.868], seconds: 220 },
      { coords: [ 15.363, 11.982], seconds: 243 },
      { coords: [ 22.402, 16.162], seconds: 249 },
      { coords: [ 36.020, 23.713], seconds: 228 },
      { coords: [ 51.905, 29.378], seconds: 185 },
      { coords: [ 83.195, 34.558], seconds: 111 },
    ],
  },

  '2035': {
    type: 'total',
    year: '2035',
    label: '2035 Sep 2 — China · Japan · Pacific',
    date: '2035-09-02',
    peakUTC: '01:55',
    defaultCenter: [130, 38],
    defaultZoom: 4,
    umbraWidth: 116,
    centerLineCoords: [
      [  91.797, 39.507],
      [ 101.415, 40.167],
      [ 107.708, 40.327],
      [ 112.673, 40.277],
      [ 116.858, 40.105],
      [ 120.515, 39.847],
      [ 123.782, 39.523],
      [ 126.743, 39.150],
      [ 129.458, 38.735],
      [ 131.982, 38.287],
      [ 134.313, 37.808],
      [ 135.427, 37.560], // Japan Honshu
      [ 136.507, 37.307],
      [ 138.647, 36.782],
      [ 140.628, 36.237],
      [ 142.512, 35.673],
      [ 144.307, 35.095],
      [ 146.743, 34.200],
      [ 149.058, 33.277],
      [ 151.572, 32.647],
      [ 153.470, 31.353],
      [ 155.548, 30.357],
      [ 157.563, 29.338], // GREATEST
      [ 159.533, 28.298],
      [ 161.470, 27.237],
      [ 163.392, 26.157],
      [ 165.313, 25.052],
      [ 167.903, 23.545],
      [ 169.222, 22.777],
      [ 171.937, 21.202],
      [ 174.815, 19.573],
      [ 177.928, 17.882],
      [ 179.608, 17.007],
    ],
    durationAtPoints: [
      { coords: [  91.80, 39.51], seconds:  70 },
      { coords: [ 112.67, 40.28], seconds: 103 },
      { coords: [ 135.43, 37.56], seconds: 147 },
      { coords: [ 157.56, 29.34], seconds: 174 },
      { coords: [ 179.61, 17.01], seconds: 135 },
    ],
  },

  '2037': {
    type: 'total',
    year: '2037',
    label: '2037 Jul 13 — W Australia · Victoria · Tasman',
    date: '2037-07-13',
    peakUTC: '02:38',
    defaultCenter: [135, -32],
    defaultZoom: 4,
    umbraWidth: 160,
    // approx — crosses southern Australia WNW to ESE; greatest near 36°S, 144°E
    centerLineCoords: [
      [111.5, -21.0], // WA coast (Shark Bay area)
      [116.5, -23.5],
      [121.5, -26.0],
      [126.5, -28.5],
      [131.5, -30.5],
      [136.0, -32.5], // South Australia
      [140.5, -34.2],
      [144.0, -35.8], // Victoria (near Melbourne)
      [148.0, -37.5],
      [152.5, -39.5],
      [157.0, -41.5], // Tasman Sea
    ],
    durationAtPoints: [
      { coords: [121.5, -26.0], seconds: 150 },
      { coords: [131.5, -30.5], seconds: 195 },
      { coords: [140.5, -34.2], seconds: 230 },
      { coords: [144.0, -35.8], seconds: 238 },
      { coords: [152.5, -39.5], seconds: 195 },
    ],
  },

  '2038': {
    type: 'total',
    year: '2038',
    label: '2038 Dec 26 — Patagonia · South Atlantic',
    date: '2038-12-26',
    peakUTC: '13:25',
    defaultCenter: [-60, -52],
    defaultZoom: 4,
    umbraWidth: 235,
    // approx — crosses extreme southern South America and South Atlantic
    centerLineCoords: [
      [-78.5, -50.0], // Pacific, approaching Chile
      [-74.5, -51.5],
      [-71.0, -52.5], // Strait of Magellan / Tierra del Fuego
      [-68.5, -53.2], // near Punta Arenas
      [-66.0, -53.5],
      [-62.0, -53.0], // Falkland Islands area
      [-57.0, -52.0],
      [-51.0, -50.5], // South Atlantic
      [-44.0, -49.0],
      [-36.0, -47.5],
    ],
    durationAtPoints: [
      { coords: [-71.0, -52.5], seconds: 110 },
      { coords: [-68.5, -53.2], seconds: 140 },
      { coords: [-62.0, -53.0], seconds: 170 },
      { coords: [-51.0, -50.5], seconds: 141 },
    ],
  },

  // ── 2040s ────────────────────────────────────────────────────────────────

  '2041': {
    type: 'total',
    year: '2041',
    label: '2041 Apr 30 — Gulf of Guinea · Chad · Sudan',
    date: '2041-04-30',
    peakUTC: '09:05',
    defaultCenter: [15, 9],
    defaultZoom: 4,
    umbraWidth: 80,
    // approx — narrow path (1m51s) across equatorial Africa
    centerLineCoords: [
      [-18.0,  2.0],
      [-10.0,  4.0],
      [ -2.0,  6.0],
      [  4.0,  7.5],
      [  8.5,  8.8],
      [ 12.0,  9.8], // Nigeria / Niger border
      [ 15.5, 10.5], // Chad
      [ 19.0, 11.0],
      [ 23.0, 11.2],
      [ 27.0, 11.0], // Sudan
      [ 32.0, 10.5],
      [ 38.0,  9.5], // Ethiopia / Red Sea
      [ 45.0,  8.0],
    ],
    durationAtPoints: [
      { coords: [  8.5,  8.8], seconds:  60 },
      { coords: [ 12.0,  9.8], seconds:  85 },
      { coords: [ 15.5, 10.5], seconds: 111 },
      { coords: [ 19.0, 11.0], seconds: 105 },
      { coords: [ 27.0, 11.0], seconds:  75 },
    ],
  },

  '2042': {
    type: 'total',
    year: '2042',
    label: '2042 Apr 20 — SE Asia · Philippines · Japan',
    date: '2042-04-20',
    peakUTC: '04:30',
    defaultCenter: [130, 20],
    defaultZoom: 4,
    umbraWidth: 210,
    // approx — greatest ~4m51s near 23°N, 138°E (Ryukyu / Pacific)
    centerLineCoords: [
      [108.0,  9.5],
      [112.5, 12.5],
      [116.5, 15.0],
      [120.5, 17.0], // Philippines
      [124.0, 18.8],
      [127.5, 20.2],
      [131.0, 21.5],
      [134.5, 22.5],
      [138.0, 23.2], // near greatest (Ryukyu Islands)
      [142.0, 23.5],
      [146.5, 23.5],
      [151.5, 23.0],
      [157.0, 22.0],
    ],
    durationAtPoints: [
      { coords: [116.5, 15.0], seconds: 210 },
      { coords: [124.0, 18.8], seconds: 260 },
      { coords: [131.0, 21.5], seconds: 285 },
      { coords: [138.0, 23.2], seconds: 291 },
      { coords: [146.5, 23.5], seconds: 265 },
    ],
  },

  '2044': {
    type: 'total',
    year: '2044',
    label: '2044 Aug 23 — Greenland · NW Territories · Alberta',
    date: '2044-08-23',
    peakUTC: '01:15',
    defaultCenter: [-115, 65],
    defaultZoom: 4,
    umbraWidth: 453,
    centerLineCoords: [
      [ -61.762, 75.783],
      [ -78.792, 77.048],
      [ -89.582, 76.770],
      [ -97.400, 76.039],
      [-103.200, 75.098],
      [-107.553, 74.056],
      [-110.875, 72.962],
      [-113.432, 71.845],
      [-115.410, 70.720],
      [-116.945, 69.599],
      [-118.130, 68.482],
      [-119.032, 67.373],
      [-119.703, 66.273],
      [-120.177, 65.182],
      [-120.482, 64.099], // GREATEST
      [-120.638, 63.023],
      [-120.660, 61.953],
      [-120.557, 60.887],
      [-120.333, 59.822],
      [-119.987, 58.757],
      [-119.519, 57.688],
      [-118.920, 56.613],
      [-118.173, 55.525],
      [-117.255, 54.419],
      [-116.125, 53.282],
      [-114.707, 52.102],
      [-112.853, 50.843],
      [-110.163, 49.425],
    ],
    durationAtPoints: [
      { coords: [ -61.762, 75.783], seconds: 101 },
      { coords: [ -97.400, 76.039], seconds: 113 },
      { coords: [-110.875, 72.962], seconds: 119 },
      { coords: [-120.482, 64.099], seconds: 123 },
      { coords: [-118.920, 56.613], seconds: 119 },
      { coords: [-112.853, 50.843], seconds: 109 },
    ],
  },

  '2045': {
    type: 'total',
    year: '2045',
    label: '2045 Aug 12 — California · Florida · Caribbean',
    date: '2045-08-12',
    peakUTC: '17:41',
    defaultCenter: [-90, 30],
    defaultZoom: 4,
    umbraWidth: 256,
    centerLineCoords: [
      [-150.047,  37.435],
      [-132.113,  40.082],
      [-120.090,  40.375], // N California
      [-111.367,  39.673],
      [-104.412,  38.440], // Colorado
      [ -98.628,  36.863],
      [ -93.689,  35.044], // Arkansas
      [ -89.380,  33.039],
      [ -85.553,  30.882], // Alabama/Georgia
      [ -82.092,  28.600], // central Florida
      [ -78.897,  26.202], // GREATEST (S Florida/Bahamas)
      [ -75.885,  23.697],
      [ -72.980,  21.083],
      [ -70.100,  18.357],
      [ -67.160,  15.503], // Lesser Antilles
      [ -64.053,  12.502],
      [ -60.637,   9.317],
      [ -56.689,   5.888],
      [ -51.808,   2.102],
      [ -45.035,  -2.312],
      [ -31.372,  -8.720],
    ],
    durationAtPoints: [
      { coords: [-120.090,  40.375], seconds: 274 },
      { coords: [-104.412,  38.440], seconds: 319 },
      { coords: [ -93.689,  35.044], seconds: 347 },
      { coords: [ -82.092,  28.600], seconds: 365 },
      { coords: [ -78.897,  26.202], seconds: 366 },
      { coords: [ -67.160,  15.503], seconds: 340 },
      { coords: [ -51.808,   2.102], seconds: 273 },
    ],
  },

  '2046': {
    type: 'total',
    year: '2046',
    label: '2046 Aug 2 — Atlantic · Congo · East Africa',
    date: '2046-08-02',
    peakUTC: '10:28',
    defaultCenter: [20, 2],
    defaultZoom: 4,
    umbraWidth: 260,
    // approx — greatest ~6m23s near 1°N, 15°E; long equatorial crossing
    centerLineCoords: [
      [-18.0,  0.5],
      [ -8.0,  0.5],
      [  0.0,  0.6],
      [  5.5,  0.8],
      [ 10.5,  1.2],
      [ 15.0,  1.5], // Congo / Central African Republic
      [ 19.0,  1.7],
      [ 23.0,  1.7],
      [ 28.0,  1.5], // Uganda / Kenya
      [ 33.0,  1.0],
      [ 38.0,  0.5],
      [ 44.0, -0.5],
      [ 50.5, -2.0],
      [ 57.0, -4.0], // Indian Ocean
    ],
    durationAtPoints: [
      { coords: [  0.0,  0.6], seconds: 310 },
      { coords: [ 10.5,  1.2], seconds: 370 },
      { coords: [ 15.0,  1.5], seconds: 383 },
      { coords: [ 23.0,  1.7], seconds: 370 },
      { coords: [ 33.0,  1.0], seconds: 330 },
      { coords: [ 44.0, -0.5], seconds: 265 },
    ],
  },

  // ── 2050s ────────────────────────────────────────────────────────────────

  '2052': {
    type: 'total',
    year: '2052',
    label: '2052 Mar 30 — Pacific · Mexico · Caribbean',
    date: '2052-03-30',
    peakUTC: '17:55',
    defaultCenter: [-100, 22],
    defaultZoom: 4,
    umbraWidth: 185,
    // approx — greatest ~4m09s near 22°N, -103°W (Mexico)
    centerLineCoords: [
      [-133.0, 18.5],
      [-127.0, 19.5],
      [-121.0, 20.2],
      [-115.5, 20.8],
      [-110.0, 21.2],
      [-105.0, 21.8],
      [-100.5, 22.2], // near greatest (Jalisco/Nayarit, Mexico)
      [ -96.0, 22.5],
      [ -91.5, 22.8],
      [ -87.5, 23.0],
      [ -83.5, 23.2], // Yucatán / Caribbean
      [ -79.5, 23.5],
      [ -74.5, 23.8],
      [ -68.5, 24.0],
      [ -62.0, 24.5],
    ],
    durationAtPoints: [
      { coords: [-121.0, 20.2], seconds: 175 },
      { coords: [-110.0, 21.2], seconds: 230 },
      { coords: [-100.5, 22.2], seconds: 249 },
      { coords: [ -91.5, 22.8], seconds: 240 },
      { coords: [ -83.5, 23.2], seconds: 215 },
    ],
  },

  '2057': {
    type: 'total',
    year: '2057',
    label: '2057 Feb 5 — Patagonia · South Atlantic',
    date: '2057-02-05',
    peakUTC: '14:50',
    defaultCenter: [-40, -42],
    defaultZoom: 3,
    umbraWidth: 280,
    // approx — path crosses southern Argentina and South Atlantic
    centerLineCoords: [
      [-80.0, -40.5],
      [-75.0, -41.0],
      [-70.0, -41.5], // southern Argentina (La Pampa / Neuquén)
      [-65.0, -42.0], // Patagonia (near Bahía Blanca)
      [-60.0, -42.5],
      [-55.0, -42.8],
      [-50.0, -43.0], // South Atlantic
      [-45.0, -43.0],
      [-40.0, -42.8],
      [-35.0, -42.5],
      [-28.0, -42.0],
      [-20.0, -41.5],
      [-10.0, -41.0],
      [ -2.0, -40.5],
    ],
    durationAtPoints: [
      { coords: [-70.0, -41.5], seconds: 150 },
      { coords: [-65.0, -42.0], seconds: 175 },
      { coords: [-50.0, -43.0], seconds: 168 },
      { coords: [-28.0, -42.0], seconds: 125 },
    ],
  },

  // ── 2060s ────────────────────────────────────────────────────────────────

  '2060': {
    type: 'total',
    year: '2060',
    label: '2060 Apr 30 — N Africa · Libya · Mediterranean',
    date: '2060-04-30',
    peakUTC: '12:08',
    defaultCenter: [20, 28],
    defaultZoom: 4,
    umbraWidth: 240,
    // approx — greatest ~5m49s near 28°N, 21°E (Libya)
    centerLineCoords: [
      [-22.0, 26.0],
      [-14.0, 27.0],
      [ -6.0, 27.5],
      [  0.0, 27.8],
      [  5.0, 27.9],
      [ 10.0, 28.0],
      [ 15.5, 28.0],
      [ 21.0, 28.0], // near greatest (Libya)
      [ 27.0, 27.8],
      [ 32.0, 27.5],
      [ 37.0, 27.0], // Egypt / Red Sea
      [ 43.0, 26.5],
      [ 50.0, 26.0],
      [ 56.0, 25.5],
    ],
    durationAtPoints: [
      { coords: [  0.0, 27.8], seconds: 270 },
      { coords: [ 10.0, 28.0], seconds: 335 },
      { coords: [ 21.0, 28.0], seconds: 349 },
      { coords: [ 32.0, 27.5], seconds: 315 },
      { coords: [ 43.0, 26.5], seconds: 265 },
    ],
  },

  '2064': {
    type: 'total',
    year: '2064',
    label: '2064 Mar 20 — Spain · Mediterranean · Turkey',
    date: '2064-03-20',
    peakUTC: '11:48',
    defaultCenter: [15, 40],
    defaultZoom: 4,
    umbraWidth: 130,
    // approx — greatest ~2m54s near 40°N, 0°E (Mediterranean near Spanish coast)
    centerLineCoords: [
      [-28.0, 38.0],
      [-20.0, 38.5],
      [-13.0, 39.0],
      [ -6.0, 39.5],
      [  0.0, 40.0], // near Barcelona / Spanish coast
      [  5.5, 40.3],
      [ 10.5, 40.5],
      [ 15.5, 40.5], // Sicily / S Italy
      [ 20.5, 40.3],
      [ 25.5, 40.0],
      [ 30.5, 39.5], // Turkey / Aegean
      [ 35.5, 39.0],
      [ 41.0, 38.5],
      [ 47.0, 38.0],
      [ 53.0, 37.5],
    ],
    durationAtPoints: [
      { coords: [  0.0, 40.0], seconds: 120 },
      { coords: [ 10.5, 40.5], seconds: 160 },
      { coords: [ 15.5, 40.5], seconds: 174 },
      { coords: [ 25.5, 40.0], seconds: 155 },
      { coords: [ 35.5, 39.0], seconds: 115 },
    ],
  },

  '2067': {
    type: 'hybrid',
    year: '2067',
    label: '2067 Dec 6 — Patagonia · South Atlantic',
    date: '2067-12-06',
    peakUTC: '15:32',
    defaultCenter: [-40, -45],
    defaultZoom: 4,
    umbraWidth: 120,
    // approx — hybrid eclipse through southern South America and South Atlantic
    centerLineCoords: [
      [-75.0, -44.5],
      [-70.0, -44.8],
      [-65.0, -45.0], // Patagonia (near Puerto Madryn)
      [-60.0, -45.2],
      [-55.0, -45.5],
      [-50.0, -45.5],
      [-45.0, -45.5],
      [-40.0, -45.2],
      [-35.0, -45.0],
      [-28.0, -44.5],
      [-22.0, -44.0],
      [-15.0, -43.5],
    ],
    durationAtPoints: [
      { coords: [-65.0, -45.0], seconds:  38 },
      { coords: [-55.0, -45.5], seconds:  72 },
      { coords: [-45.0, -45.5], seconds:  98 },
      { coords: [-35.0, -45.0], seconds:  82 },
    ],
  },

  // ── 2070s ────────────────────────────────────────────────────────────────

  '2070': {
    type: 'total',
    year: '2070',
    label: '2070 Apr 11 — India · SE Asia · Japan · Pacific',
    date: '2070-04-11',
    peakUTC: '02:55',
    defaultCenter: [120, 28],
    defaultZoom: 4,
    umbraWidth: 230,
    // approx — greatest ~5m19s near 29°N, 135°E (Ryukyu / south Japan)
    centerLineCoords: [
      [ 78.0, 22.0], // India (Rajasthan / Gujarat area)
      [ 84.0, 24.0],
      [ 90.0, 25.5], // Bangladesh / Myanmar
      [ 96.0, 26.5],
      [102.0, 27.0], // China (Yunnan / Guizhou)
      [108.0, 27.5],
      [114.0, 27.8],
      [120.0, 28.0], // East China Sea
      [126.0, 28.5],
      [132.0, 28.8],
      [137.0, 29.0], // near greatest (Ryukyu)
      [142.0, 29.0],
      [148.0, 28.8],
      [154.5, 28.5],
      [161.0, 28.0],
    ],
    durationAtPoints: [
      { coords: [ 84.0, 24.0], seconds: 190 },
      { coords: [ 96.0, 26.5], seconds: 270 },
      { coords: [108.0, 27.5], seconds: 310 },
      { coords: [120.0, 28.0], seconds: 318 },
      { coords: [137.0, 29.0], seconds: 319 },
      { coords: [148.0, 28.8], seconds: 295 },
    ],
  },

  '2071': {
    type: 'total',
    year: '2071',
    label: '2071 Sep 23 — Central America · Caribbean · Atlantic',
    date: '2071-09-23',
    peakUTC: '17:40',
    defaultCenter: [-75, 14],
    defaultZoom: 4,
    umbraWidth: 160,
    // approx — greatest ~3m26s near 14°N, -77°W (Jamaica / Caribbean)
    centerLineCoords: [
      [-100.0, 11.0], // Pacific off Guatemala coast
      [ -94.0, 11.8],
      [ -89.0, 12.5], // Guatemala / Honduras
      [ -85.0, 13.0],
      [ -81.0, 13.5], // Nicaragua / Costa Rica
      [ -77.5, 14.0], // near greatest (Jamaica area)
      [ -74.0, 14.5],
      [ -70.0, 15.0],
      [ -66.0, 15.5], // Puerto Rico
      [ -62.0, 16.0], // Lesser Antilles
      [ -57.0, 16.5],
      [ -51.0, 17.0],
      [ -45.0, 17.5], // Atlantic
    ],
    durationAtPoints: [
      { coords: [-89.0, 12.5], seconds: 120 },
      { coords: [-81.0, 13.5], seconds: 185 },
      { coords: [-77.5, 14.0], seconds: 206 },
      { coords: [-70.0, 15.0], seconds: 185 },
      { coords: [-62.0, 16.0], seconds: 140 },
    ],
  },

  '2078': {
    type: 'total',
    year: '2078',
    label: '2078 May 11 — Mexico · Gulf Coast · Atlantic',
    date: '2078-05-11',
    peakUTC: '17:10',
    defaultCenter: [-88, 28],
    defaultZoom: 4,
    umbraWidth: 295,
    // approx — greatest ~6m47s near 28°N, -94°W (Gulf of Mexico / Texas coast)
    centerLineCoords: [
      [-117.0, 22.0], // Pacific (off Mexico)
      [-112.0, 23.0],
      [-107.5, 24.0],
      [-103.5, 25.2],
      [-100.0, 26.5],
      [ -96.5, 27.8],
      [ -93.5, 28.8], // near greatest (Texas Gulf Coast)
      [ -90.5, 29.8], // Louisiana coast
      [ -87.5, 30.8],
      [ -84.5, 32.0], // Georgia
      [ -81.0, 33.0],
      [ -77.0, 34.0], // Carolinas
      [ -72.0, 35.0],
      [ -66.0, 36.0], // Atlantic
      [ -59.0, 37.0],
    ],
    durationAtPoints: [
      { coords: [-107.5, 24.0], seconds: 320 },
      { coords: [-100.0, 26.5], seconds: 385 },
      { coords: [ -93.5, 28.8], seconds: 407 },
      { coords: [ -87.5, 30.8], seconds: 395 },
      { coords: [ -81.0, 33.0], seconds: 360 },
      { coords: [ -72.0, 35.0], seconds: 295 },
    ],
  },

  // ── 2080s ────────────────────────────────────────────────────────────────

  '2088': {
    type: 'total',
    year: '2088',
    label: '2088 Apr 21 — N Africa · Sicily · Mediterranean · Arabia',
    date: '2088-04-21',
    peakUTC: '11:30',
    defaultCenter: [20, 36],
    defaultZoom: 4,
    umbraWidth: 225,
    // approx — greatest ~5m05s near 36°N, 15°E (Sicily / Libya)
    centerLineCoords: [
      [-18.0, 33.0],
      [-10.0, 33.5],
      [ -3.0, 34.0],
      [  3.0, 34.5],
      [  8.0, 35.0],
      [ 13.0, 35.5],
      [ 17.0, 36.0], // Sicily / Mediterranean
      [ 22.0, 36.3], // near greatest
      [ 27.0, 36.5], // Greece / Crete
      [ 32.0, 36.5], // Cyprus / Turkey
      [ 37.0, 36.3],
      [ 42.0, 36.0],
      [ 48.0, 35.5], // Iran / Persian Gulf
      [ 54.0, 35.0],
      [ 60.0, 34.5],
    ],
    durationAtPoints: [
      { coords: [  3.0, 34.5], seconds: 225 },
      { coords: [ 13.0, 35.5], seconds: 285 },
      { coords: [ 22.0, 36.3], seconds: 305 },
      { coords: [ 32.0, 36.5], seconds: 280 },
      { coords: [ 42.0, 36.0], seconds: 230 },
      { coords: [ 54.0, 35.0], seconds: 165 },
    ],
  },

  // ── 2090s ────────────────────────────────────────────────────────────────

  '2099': {
    type: 'total',
    year: '2099',
    label: '2099 Sep 14 — Central America · Caribbean · Atlantic',
    date: '2099-09-14',
    peakUTC: '17:55',
    defaultCenter: [-65, 22],
    defaultZoom: 4,
    umbraWidth: 200,
    // approx — greatest ~4m22s near 23°N, -63°W (E Caribbean)
    centerLineCoords: [
      [-93.0, 17.0], // Pacific off Guatemala
      [-87.5, 17.5],
      [-82.5, 18.0], // Caribbean coast
      [-77.5, 18.8], // Jamaica
      [-73.0, 19.5],
      [-68.5, 20.5], // Dominican Republic / Haiti
      [-64.5, 21.5],
      [-61.0, 22.5], // near greatest (E Caribbean)
      [-57.0, 23.5],
      [-52.0, 24.5],
      [-46.0, 25.5],
      [-40.0, 26.5], // Atlantic
    ],
    durationAtPoints: [
      { coords: [-82.5, 18.0], seconds: 130 },
      { coords: [-73.0, 19.5], seconds: 215 },
      { coords: [-64.5, 21.5], seconds: 262 },
      { coords: [-57.0, 23.5], seconds: 240 },
      { coords: [-46.0, 25.5], seconds: 190 },
    ],
  },
}

export const ECLIPSE_YEARS = [
  '2024', '2026', '2027', '2028',
  '2030', '2031', '2033', '2034', '2035',
  '2037', '2038',
  '2041', '2042', '2044', '2045', '2046',
  '2052', '2057',
  '2060', '2064', '2067',
  '2070', '2071', '2078',
  '2088',
  '2099',
]
