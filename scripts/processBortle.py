#!/usr/bin/env python3
"""
Download and process VIIRS light pollution data into a compact Bortle lookup PNG.

Usage:
  python3 scripts/processBortle.py               # downloads 2025 data automatically
  python3 scripts/processBortle.py path/to.tif   # use already-extracted TIF

Output: public/bortle_2025.png
  4320×2160 grayscale PNG (~0.083°/pixel equirectangular, ~9km at equator)
  Pixel value = Bortle class 1–9

Strategy
--------
1. Downsample using Resampling.max (not average) so scattered towns in rural
   areas are preserved rather than washed out by surrounding dark pixels.
2. Apply a Gaussian blur (sigma ≈ 54 km) to simulate atmospheric light
   spreading — this creates smooth gradients and makes the map feel realistic.
3. Take max(original, blurred) so city centres keep their peak value while
   surrounding areas get realistic glow halos.
4. Convert float32 nW/cm²/sr → Bortle class 1-9.

Source: lightpollutionmap.info VIIRS 2025 (CC0), calibrated radiance.
"""

import sys
import pathlib
import zipfile
import subprocess
import shutil
import tempfile
import numpy as np

try:
    import rasterio
    from rasterio.enums import Resampling
except ImportError:
    sys.exit("Install rasterio first:  pip3 install rasterio")

try:
    from scipy.ndimage import gaussian_filter
except ImportError:
    sys.exit("Install scipy first:  pip3 install scipy")

try:
    from PIL import Image
except ImportError:
    sys.exit("Install Pillow first:  pip3 install Pillow")

# ── Configuration ─────────────────────────────────────────────────────────────

VIIRS_URL  = 'https://www2.lightpollutionmap.info/data/v2/viirs_2025_raw.zip'
PUBLIC_DIR = pathlib.Path(__file__).parent.parent / 'public'
OUTPUT     = PUBLIC_DIR / 'bortle_2025.png'

OUT_W, OUT_H = 4320, 2160   # ~9 km/pixel at equator

TGT_LEFT, TGT_RIGHT = -180.0, 180.0
TGT_TOP,  TGT_BOTTOM =  90.0, -90.0

# Gaussian blur sigma in output pixels.
# At 9 km/pixel, sigma=6 → ~54 km spread, which matches typical
# atmospheric scattering distances for city glow.
BLUR_SIGMA = 6.0

# Bortle thresholds in nW/cm²/sr (calibrated VIIRS radiance).
# These apply AFTER the max-resample + blur, so values reflect the
# actual peak-influenced sky brightness at each location.
BORTLE_THRESHOLDS = [
    (0.5,    1),   # pristine sky (ocean, Antarctic, deep wilderness)
    (2.0,    2),   # very dark (outback, Sahara, Amazon)
    (5.0,    3),   # rural (farmland, small towns visible on horizon)
    (12.0,   4),   # rural/suburban transition
    (30.0,   5),   # suburban
    (80.0,   6),   # bright suburban
    (200.0,  7),   # urban
    (500.0,  8),   # city sky
]

def radiance_to_bortle(data: np.ndarray) -> np.ndarray:
    out = np.full(data.shape, 9, dtype=np.uint8)
    for threshold, cls in reversed(BORTLE_THRESHOLDS):
        out[data < threshold] = cls
    out[data <= 0] = 1   # truly dark / ocean
    return out

# ── Download ──────────────────────────────────────────────────────────────────

def download_and_extract(tmpdir: str) -> pathlib.Path:
    zip_path = pathlib.Path(tmpdir) / 'viirs_2025_raw.zip'
    print(f'Downloading {VIIRS_URL}')
    print('(~928 MB — please wait…)')
    subprocess.run(
        ['curl', '-L', '--progress-bar', '-o', str(zip_path), VIIRS_URL],
        check=True,
    )
    print('\nExtracting…')
    with zipfile.ZipFile(zip_path) as z:
        tifs = [n for n in z.namelist() if n.lower().endswith('.tif')]
        if not tifs:
            sys.exit('No .tif file found in the downloaded ZIP.')
        z.extract(tifs[0], tmpdir)
        return pathlib.Path(tmpdir) / tifs[0]

# ── Process ───────────────────────────────────────────────────────────────────

def process(tif_path: pathlib.Path) -> np.ndarray:
    print(f'Reading {tif_path} …')
    with rasterio.open(tif_path) as src:
        src_left, src_bottom, src_right, src_top = src.bounds
        nodata = src.nodata
        print(f'  Size: {src.width}×{src.height}  '
              f'lat [{src_bottom:.0f}°, {src_top:.0f}°]  '
              f'lng [{src_left:.0f}°, {src_right:.0f}°]')

        def lat_to_row(lat):
            return round((TGT_TOP - lat) / (TGT_TOP - TGT_BOTTOM) * OUT_H)
        def lng_to_col(lng):
            return round((lng - TGT_LEFT) / (TGT_RIGHT - TGT_LEFT) * OUT_W)

        dst_row0 = lat_to_row(src_top)
        dst_row1 = lat_to_row(src_bottom)
        dst_col0 = lng_to_col(src_left)
        dst_col1 = lng_to_col(src_right)
        dst_h = dst_row1 - dst_row0
        dst_w = dst_col1 - dst_col0

        # rasterio.read() does not support Resampling.max; do it manually.
        # Scale is exactly 20× in both axes (86400→4320, 33600→1680).
        scale_x = src.width  // dst_w   # 20
        scale_y = src.height // dst_h   # 20
        print(f'  Max-pooling {src.width}×{src.height} → {dst_w}×{dst_h} '
              f'(block size {scale_x}×{scale_y})…')

        from rasterio.windows import Window
        data = np.zeros((dst_h, dst_w), dtype=np.float32)
        STRIP = 20   # output rows per read (= scale_y * STRIP source rows)

        for out_y0 in range(0, dst_h, STRIP):
            out_y1 = min(out_y0 + STRIP, dst_h)
            src_y0, src_y1 = out_y0 * scale_y, out_y1 * scale_y

            strip = src.read(
                1,
                window=Window(0, src_y0, src.width, src_y1 - src_y0),
            ).astype(np.float32)   # (src_rows, 86400)

            strip_rows = src_y1 - src_y0
            out_rows   = out_y1 - out_y0

            # max-pool X: (src_rows, 86400) → (src_rows, dst_w)
            x_pool = strip[:, :dst_w * scale_x].reshape(strip_rows, dst_w, scale_x)
            x_max  = x_pool.max(axis=2)

            # max-pool Y: (src_rows, dst_w) → (out_rows, dst_w)
            y_pool = x_max[:out_rows * scale_y].reshape(out_rows, scale_y, dst_w)
            data[out_y0:out_y1, :] = y_pool.max(axis=1)

            pct = out_y1 / dst_h * 100
            print(f'\r  {pct:5.1f}%', end='', flush=True)
        print()

    if nodata is not None:
        data[data == nodata] = 0.0
    data = np.nan_to_num(data, nan=0.0)
    data = np.clip(data, 0.0, None)

    # Embed into full-globe canvas (polar gaps → 0 = truly dark)
    globe = np.zeros((OUT_H, OUT_W), dtype=np.float32)
    globe[dst_row0:dst_row1, dst_col0:dst_col1] = data

    # Gaussian blur: simulates atmospheric scattering that spreads city glow
    print(f'  Applying Gaussian blur (sigma={BLUR_SIGMA} px ≈ {BLUR_SIGMA*9:.0f} km)…')
    blurred = gaussian_filter(globe, sigma=BLUR_SIGMA)

    # max(original, blurred) keeps city centres at full value while adding halos
    result = np.maximum(globe, blurred)
    return result

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) > 1:
        tif_path = pathlib.Path(sys.argv[1])
        if not tif_path.exists():
            sys.exit(f'File not found: {tif_path}')
        data = process(tif_path)
    else:
        tmpdir = tempfile.mkdtemp(prefix='bortle_')
        try:
            tif_path = download_and_extract(tmpdir)
            data = process(tif_path)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    print('Converting radiance → Bortle class …')
    bortle = radiance_to_bortle(data)

    total = OUT_W * OUT_H
    print('Distribution:')
    for cls in range(1, 10):
        pct = (bortle == cls).sum() / total * 100
        print(f'  Bortle {cls}: {pct:5.1f}%')

    labels = ['','Pristine','Very dark','Rural','Rural/suburban',
              'Suburban','Bright suburban','Urban','City sky','Inner city']
    spots = [
        ('Australian outback', -25,  135.0),
        ('Pacific Ocean',        0, -160.0),
        ('Sahara Desert',       23,   10.0),
        ('Rural India (MP)',    23,   79.0),
        ('Rural India (Raj)',   27,   73.0),
        ('Mumbai',             19.1,  72.9),
        ('Delhi',              28.6,  77.2),
        ('Bangladesh (Dhaka)', 23.7,  90.4),
        ('London',             51.5,  -0.1),
        ('Tokyo',              35.7, 139.7),
        ('Manhattan',          40.7,  -74.0),
        ('Las Vegas',          36.2, -115.1),
        ('Rural France',       46.0,    2.0),
        ('Rural Nebraska',     42.0, -100.0),
    ]
    print('\nSpot checks:')
    for name, lat, lng in spots:
        x = max(0, min(OUT_W-1, int((lng + 180) / 360 * OUT_W)))
        y = max(0, min(OUT_H-1, int((90 - lat) / 180 * OUT_H)))
        b = int(bortle[y, x])
        r = float(data[y, x])
        print(f'  {name:24s}: Bortle {b} — {labels[b]:16s}  ({r:.2f} nW/cm²/sr)')

    PUBLIC_DIR.mkdir(exist_ok=True)
    Image.fromarray(bortle).save(OUTPUT)
    size_kb = OUTPUT.stat().st_size // 1024
    print(f'\nSaved {OUTPUT}  ({size_kb} KB)')

if __name__ == '__main__':
    main()
