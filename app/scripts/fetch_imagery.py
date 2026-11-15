"""
Download the CTX base-map tiles for Gale Crater from NASA Mars Trek.

This is the same source and tile grid as MarsDataPipline/gale_tiles/gale_tiles.ipynb (cell 6),
without the notebook's DTM steps, so the app's base map can be rebuilt on any machine.
Tiles land where the pipeline keeps them, and files already on disk are skipped:

  python scripts/fetch_imagery.py                       # zooms 7-11 into ../MarsDataPipline/gale_tiles/out_tiles/imagery
  python scripts/fetch_imagery.py --zmax 12             # add zoom 12 (about 3,250 more tiles)

Then run scripts/build_map_data.py to turn them into the app's tiles.
Credit on the map: "Imagery NASA/JPL-Caltech/MSSS".
"""
import argparse
import json
import math
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PRODUCT = "Gale_CTX_BlockAdj_dd"
TEMPLATE = "https://trek.nasa.gov/tiles/Mars/EQ/" + PRODUCT + "/1.0.0/default/default028mm/{z}/{row}/{col}.png"
BBOX = (136.75, -6.57, 139.24, -4.15)  # lon_min, lat_min, lon_max, lat_max: the pipeline's map box
AGENT = "mars-navigator/0.2 (NASA Space Apps 2026)"
OUT = Path(__file__).resolve().parents[2] / "MarsDataPipline/gale_tiles/out_tiles/imagery"


def tile_range(z):
    """Rows and columns covering BBOX at zoom z. Tiles are 180 / 2^z degrees; row 0 is at 90 N, col 0 at 180 W."""
    deg = 180 / 2**z
    west, south, east, north = BBOX
    rows = range(math.floor((90 - north) / deg), math.floor((90 - south) / deg) + 1)
    cols = range(math.floor((west + 180) / deg), math.floor((east + 180) / deg) + 1)
    return rows, cols


def fetch(job):
    z, row, col = job
    path = OUT / str(z) / str(row) / f"{col}.png"
    if path.exists():
        return "cached"
    url = TEMPLATE.format(z=z, row=row, col=col)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": AGENT}), timeout=30) as r:
                body = r.read()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
            return "ok"
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return "no_coverage"
            status = f"error_{e.code}"
        except (urllib.error.URLError, TimeoutError) as e:
            status = f"error_{type(e).__name__}"
        time.sleep(1.5 * (attempt + 1))
    return status


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zmin", type=int, default=7)
    ap.add_argument("--zmax", type=int, default=11)
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    per_zoom, summary = {}, {}
    for z in range(args.zmin, args.zmax + 1):
        rows, cols = tile_range(z)
        per_zoom[z] = {"rows": [rows.start, rows.stop - 1], "cols": [cols.start, cols.stop - 1]}
        jobs = [(z, r, c) for r in rows for c in cols]
        with ThreadPoolExecutor(args.workers) as pool:
            results = list(pool.map(fetch, jobs))
        counts = {k: results.count(k) for k in sorted(set(results))}
        summary[z] = counts
        print(f"zoom {z}: {len(jobs)} tiles {counts}", flush=True)

    manifest = {
        "layer": "imagery",
        "product": PRODUCT,
        "source": TEMPLATE,
        "retrieved": time.strftime("%Y-%m-%d"),
        "bbox_lonlat": BBOX,
        "ext": "png",
        "tile_size": 256,
        "scheme": "z/row/col; tile = 180/2^z degrees; row 0 at 90 N, col 0 at 180 W",
        "zoom_range": [args.zmin, args.zmax],
        "per_zoom": per_zoom,
        "summary_by_zoom": summary,
        "attribution": "NASA/JPL-Caltech/MSSS",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    errors = sum(n for c in summary.values() for k, n in c.items() if k.startswith("error"))
    print(f"wrote {OUT / 'manifest.json'}" + (f"; {errors} errors, run again to retry" if errors else ""))


if __name__ == "__main__":
    main()
