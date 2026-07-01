#!/usr/bin/env python3
"""
Generate public/eclipseCatalog.json from NASA Besselian elements + 5MCSE catalog.

Algorithm:
- Besselian elements define shadow geometry in the fundamental plane.
- Oblate Earth correction: use geodetic latitude for accurate ground track.
- Delta-T correction: mu polynomial uses UT, not TD.
- Binary search for exact tau_enter/tau_exit (where shadow edge meets Earth limb).
- Antimeridian splitting when consecutive longitudes differ by > 180°.
"""

import csv, json, math, re, sys
from pathlib import Path

# Paths
ROOT = Path(__file__).parent
BESSELIAN = ROOT / "besselian.csv"
CATALOG_TXT = ROOT / "5MCSEcatalog.txt"
OUTPUT = ROOT.parent.parent / "public" / "eclipseCatalog.json"

DEG = math.pi / 180
RHO_E = 0.99664719          # b/a for WGS-84 oblate Earth
N_PATH_POINTS = 80          # centerline samples between tau_enter and tau_exit


# ---------------------------------------------------------------------------
# Besselian element evaluation
# ---------------------------------------------------------------------------

def eval_elements(row, tau):
    """Return (x, y, d_deg, mu_deg) at time offset tau (hours from t0, TD)."""
    x = float(row['x0']) + tau * (float(row['x1']) + tau * (float(row['x2']) + tau * float(row['x3'])))
    y = float(row['y0']) + tau * (float(row['y1']) + tau * (float(row['y2']) + tau * float(row['y3'])))
    d = float(row['d0']) + tau * (float(row['d1']) + tau * float(row['d2']))
    dt = float(row['dt'])                   # seconds
    tau_UT = tau - dt / 3600.0              # UT time offset (mu uses UT, not TD)
    mu = float(row['mu0']) + float(row['mu1']) * tau_UT
    return x, y, d, mu


def shadow_on_earth(row, tau):
    """
    Return True if the shadow axis intersects Earth at time tau.
    Primary check: x²+y² < 1 in the fundamental plane.
    """
    x, y, d, mu = eval_elements(row, tau)
    return (x * x + y * y) < 1.0


def tau_to_lonlat(row, tau):
    """Convert tau (TD hours from t0) to (longitude, latitude) on Earth."""
    x, y, d, mu = eval_elements(row, tau)
    d_rad = d * DEG
    sin_d, cos_d = math.sin(d_rad), math.cos(d_rad)

    tau_z2 = 1.0 - x * x - y * y
    if tau_z2 < 0:
        return None     # shadow off Earth
    tau_z = math.sqrt(tau_z2)

    sin_phi1 = y * cos_d + tau_z * sin_d
    cos_phi1 = math.sqrt(max(0.0, 1.0 - sin_phi1 * sin_phi1))

    # Geodetic (geographic) latitude via oblate Earth correction
    phi_geo = math.atan2(sin_phi1, cos_phi1 * RHO_E * RHO_E)
    lat = phi_geo / DEG

    # Local hour angle → longitude
    H = math.atan2(x, tau_z * cos_d - y * sin_d)
    lon = H / DEG - mu
    # Normalise to [-180, 180]
    lon = ((lon + 180.0) % 360.0) - 180.0
    return lon, lat


# ---------------------------------------------------------------------------
# Binary search for exact shadow contact times
# ---------------------------------------------------------------------------

def find_tau_contact(row, t_inside, t_outside, n_iter=80):
    """
    Binary search for the tau where shadow_on_earth transitions.
    t_inside: tau known to have shadow on Earth.
    t_outside: tau known to have shadow off Earth.
    """
    for _ in range(n_iter):
        mid = (t_inside + t_outside) / 2.0
        if shadow_on_earth(row, mid):
            t_inside = mid
        else:
            t_outside = mid
    return (t_inside + t_outside) / 2.0


def compute_centerline(row):
    """
    Return (coords, tau_enter, tau_exit) where coords is [[lon,lat], ...].
    Returns (None, None, None) if the eclipse is partial or has no valid path.
    """
    tmin = float(row['tmin'])
    tmax = float(row['tmax'])

    # Scan for a tau where shadow is on Earth
    t_inside = None
    for i in range(200):
        tau = tmin + i * (tmax - tmin) / 199.0
        if shadow_on_earth(row, tau):
            t_inside = tau
            break

    if t_inside is None:
        return None, None, None

    # Find exact entry and exit
    tau_enter = find_tau_contact(row, t_inside, tmin)
    tau_exit  = find_tau_contact(row, t_inside, tmax)

    if tau_exit <= tau_enter:
        return None, None, None

    # Sample N_PATH_POINTS along [tau_enter, tau_exit]
    pts = []
    for i in range(N_PATH_POINTS):
        tau = tau_enter + i * (tau_exit - tau_enter) / (N_PATH_POINTS - 1)
        result = tau_to_lonlat(row, tau)
        if result is not None:
            pts.append([round(result[0], 2), round(result[1], 2)])

    if len(pts) < 2:
        return None, None, None

    # Split on antimeridian crossings (longitude jump > 180°).
    segments = []
    seg = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - seg[-1][0]) > 180.0:
            segments.append(seg)
            seg = [p]
        else:
            seg.append(p)
    segments.append(seg)

    # Return single segment or list of segments
    valid_segs = [s for s in segments if len(s) >= 2]
    if not valid_segs:
        return None, None, None
    if len(valid_segs) == 1:
        return valid_segs[0], tau_enter, tau_exit
    return valid_segs, tau_enter, tau_exit


# ---------------------------------------------------------------------------
# Hybrid eclipse transition points
# ---------------------------------------------------------------------------

def surface_l2(row, tau):
    """
    Effective umbral radius at the shadow-Earth intersection on the center line.
    L2 = l2(tau) - zeta * tan_f2
    L2 < 0 → total (umbra tip has passed through); L2 > 0 → annular.
    Returns None if shadow is off Earth.
    """
    x, y, d, mu = eval_elements(row, tau)
    rho2 = x * x + y * y
    if rho2 >= 1.0:
        return None
    zeta = math.sqrt(1.0 - rho2)
    l20 = float(row['l20']); l21 = float(row['l21']); l22 = float(row['l22'])
    l2 = l20 + tau * (l21 + tau * l22)
    tan_f2 = float(row['tan_f2'])
    return l2 - zeta * tan_f2


def find_hybrid_transition(row, t_annular, t_total, n_iter=80):
    """Binary search for the tau where surface_l2 crosses zero."""
    for _ in range(n_iter):
        mid = (t_annular + t_total) / 2.0
        val = surface_l2(row, mid)
        if val is None or val > 0:
            t_annular = mid
        else:
            t_total = mid
    return (t_annular + t_total) / 2.0


def compute_hybrid_transitions(row):
    """
    For hybrid eclipses, find the two tau values where surface_l2 = 0
    (annular→total and total→annular transitions along the center line).
    Returns [[lon1,lat1], [lon2,lat2]] or None.
    """
    tmin = float(row['tmin'])
    tmax = float(row['tmax'])

    # Scan the visible window and collect sign changes in surface_l2
    N_SCAN = 400
    taus = [tmin + i * (tmax - tmin) / (N_SCAN - 1) for i in range(N_SCAN)]
    vals = []
    for t in taus:
        v = surface_l2(row, t)
        if v is not None and shadow_on_earth(row, t):
            vals.append((t, v))

    if not vals:
        return None

    # Collect sign-change intervals
    transitions = []
    for i in range(len(vals) - 1):
        t1, v1 = vals[i]
        t2, v2 = vals[i + 1]
        if v1 * v2 < 0:
            # Determine which side is annular (L2 > 0) and which is total (L2 < 0)
            if v1 > 0:
                tau_cross = find_hybrid_transition(row, t1, t2)
            else:
                tau_cross = find_hybrid_transition(row, t2, t1)
            transitions.append(tau_cross)

    if len(transitions) < 2:
        return None

    pts = []
    for t in transitions[:2]:
        result = tau_to_lonlat(row, t)
        if result is not None:
            pts.append([round(result[0], 2), round(result[1], 2)])

    return pts if len(pts) == 2 else None


# ---------------------------------------------------------------------------
# Parse 5MCSE catalog
# ---------------------------------------------------------------------------

def parse_5mcse(path):
    """
    Return dict mapping cat_no (int) -> metadata dict.
    Fixed-width format from NASA 5MCSE catalog.
    """
    entries = {}
    data_start = False
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            # Data lines start with leading whitespace then a number
            stripped = line.rstrip('\n')
            if not stripped.strip():
                continue
            if stripped.strip().startswith('Cat.'):
                data_start = True
                continue
            if not data_start:
                continue
            # Try to parse: Cat No, Canon Plate, Calendar Date, TD, DT, Luna, Saros, Type, Gamma, Mag, ...
            # Example: "    1  001  -1999 Jun 12  03:14:51  46438 -49456    5   T   -0.2701  1.0733 ..."
            m = re.match(
                r'\s*(\d+)\s+(\S+)\s+(-?\d+)\s+(\w+)\s+(\d+)\s+(\d{2}:\d{2}:\d{2})'
                r'\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\S+)\s+(-?[\d.]+)\s+([\d.]+)'
                r'\s+([\d.]+)([NS])\s+([\d.]+)([EW])'
                r'\s+(\d+)\s+(\d+)'
                r'(?:\s+(-|[\d.]+)\s+(\S+))?',
                stripped
            )
            if m:
                cat = int(m.group(1))
                yr = int(m.group(3))
                mon_s = m.group(4)
                day = int(m.group(5))
                time_s = m.group(6)
                dt_s = int(m.group(7))
                luna = int(m.group(8))
                saros = int(m.group(9))
                etype = m.group(10)
                gamma = float(m.group(11))
                mag = float(m.group(12))
                lat_v = float(m.group(13))
                lat_s = m.group(14)
                lon_v = float(m.group(15))
                lon_s = m.group(16)
                lat_dd = lat_v if lat_s == 'N' else -lat_v
                lon_dd = lon_v if lon_s == 'E' else -lon_v
                w19 = m.group(19)
                width = float(w19) if w19 and w19 != '-' else None
                dur = m.group(20) if m.group(20) else None

                months = ['Jan','Feb','Mar','Apr','May','Jun',
                          'Jul','Aug','Sep','Oct','Nov','Dec']
                mon_i = months.index(mon_s) + 1
                date_str = f"{'-' if yr < 0 else ''}{abs(yr):04d}-{mon_i:02d}-{day:02d}"

                entries[cat] = {
                    'cat': cat,
                    'date': date_str,
                    'time': time_s,
                    'saros': saros,
                    'type': etype,
                    'gamma': round(gamma, 4),
                    'mag': round(mag, 4),
                    'greatest': [round(lon_dd, 2), round(lat_dd, 2)],
                    'widthKm': round(width, 1) if width else None,
                    'durationS': dur_to_s(dur),
                }
    return entries


def dur_to_s(dur_str):
    """Convert '02m18s' or '00m45s' to seconds (float). Returns None if empty."""
    if not dur_str or dur_str == '-':
        return None
    m = re.match(r'(?:(\d+)m)?(\d+)s', dur_str)
    if not m:
        return None
    mins = int(m.group(1)) if m.group(1) else 0
    secs = int(m.group(2))
    return mins * 60 + secs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Reading 5MCSE catalog…", flush=True)
    meta = parse_5mcse(CATALOG_TXT)
    print(f"  {len(meta)} eclipse metadata entries", flush=True)

    print("Reading Besselian elements…", flush=True)
    bess_rows = {}
    with open(BESSELIAN, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cat = int(float(row['cat_no']))
            bess_rows[cat] = row
    print(f"  {len(bess_rows)} Besselian element rows", flush=True)

    # Central eclipse types (have umbral/annular paths)
    central_types = {'T', 'A', 'H', 'Hm', 'Te', 'An', 'As', 'Am',
                     'Tm', 'Th', 'Tn', 'Ts', 'Tb', 'Ab', 'Tp'}

    print("Computing centerlines…", flush=True)
    results = []
    n_central = 0
    n_paths = 0
    n_meta_missing = 0

    # Use all entries from Besselian CSV (they have the elements we need)
    for cat, row in sorted(bess_rows.items()):
        entry_meta = meta.get(cat)
        if entry_meta is None:
            n_meta_missing += 1
            # Build minimal metadata from Besselian row
            yr, mo, dy = int(row['year']), int(row['month']), int(row['day'])
            date_str = f"{'-' if yr < 0 else ''}{abs(yr):04d}-{mo:02d}-{dy:02d}"
            entry = {
                'cat': cat,
                'date': date_str,
                'time': row['td_ge'][:5] if row.get('td_ge') else '00:00',
                'saros': int(row['saros']),
                'type': row['eclipse_type'],
                'gamma': round(float(row['gamma']), 4),
                'mag': round(float(row['magnitude']), 4),
                'greatest': [round(float(row['lng_dd_ge']), 2), round(float(row['lat_dd_ge']), 2)],
                'widthKm': round(float(row['path_width']), 1) if row.get('path_width') else None,
                'durationS': round(float(row['duration_secs']), 1) if row.get('duration_secs') else None,
            }
        else:
            entry = dict(entry_meta)
            # Prefer besselian CSV values for widthKm and durationS (more precise)
            if row.get('path_width'):
                try:
                    w = float(row['path_width'])
                    if w > 0:
                        entry['widthKm'] = w
                except ValueError:
                    pass
            if row.get('duration_secs'):
                try:
                    entry['durationS'] = float(row['duration_secs'])
                except ValueError:
                    pass

        etype = row['eclipse_type']
        is_central = any(etype.startswith(t) for t in central_types) or etype[0] in 'TAH'
        is_hybrid = etype[0] == 'H'

        if is_central:
            n_central += 1
            cl, tau_enter, tau_exit = compute_centerline(row)
            entry['centerLine'] = cl
            if cl is not None:
                n_paths += 1
                # t0 ≈ time of greatest eclipse in TD hours from midnight.
                # tau=0 is at t0, so peakFrac = how far into the path the peak falls.
                dur = (tau_exit - tau_enter) * 3600.0
                frac = (0.0 - tau_enter) / (tau_exit - tau_enter)
                entry['pathDurationS'] = round(dur)
                entry['peakFrac'] = round(max(0.0, min(1.0, frac)), 4)
            else:
                entry['pathDurationS'] = None
                entry['peakFrac'] = None
        else:
            entry['centerLine'] = None
            entry['pathDurationS'] = None
            entry['peakFrac'] = None

        if is_hybrid:
            entry['hybridTransitions'] = compute_hybrid_transitions(row)
        else:
            entry['hybridTransitions'] = None

        results.append(entry)

        if len(results) % 1000 == 0:
            print(f"  {len(results)}/{len(bess_rows)}  paths={n_paths}", flush=True)

    print(f"Total: {len(results)} eclipses, {n_central} central, {n_paths} with paths", flush=True)
    print(f"  {n_meta_missing} entries used Besselian-only metadata", flush=True)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w') as f:
        json.dump(results, f, separators=(',', ':'))
    size_mb = OUTPUT.stat().st_size / 1e6
    print(f"Wrote {OUTPUT}  ({size_mb:.1f} MB)", flush=True)


if __name__ == '__main__':
    main()
