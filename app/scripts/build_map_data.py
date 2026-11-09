"""
Turn the pipeline's outputs into the files the app loads, in app/data/ (git-ignored).

  python scripts/build_map_data.py                   # every stage
  python scripts/build_map_data.py terrain heat      # only some stages

Then serve them with `npm run data` (scripts/serve-data.mjs). Needs numpy and Pillow (with WebP).

Inputs, at their usual places in ../MarsDataPipline (download them from the team Drive, see the
root README; the imagery tiles come from scripts/fetch_imagery.py):

  stage      reads
  imagery    gale_tiles/out_tiles/imagery/{z}/{row}/{col}.png + manifest.json
  terrain    processed_data/gale_dem_20m.tif + gale_slope_20m.tif (needs rasterio)
  strata     (the terrain stage's grid)
  heat       heatmap/outputs/maps/{ground,air}/raw/*.u16 + map_manifest.json
  dustdevil  dust_devil/outputs/gale_dust_devil_heating_index_sol{N}.npz + reference json

Everything is on the app's world grid: the pipeline's 100 m grid, 1477 x 1436 cells (see src/map/geo.ts).
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from tint_map import tint  # noqa: E402

APP = Path(__file__).resolve().parents[1]
PIPE = APP.parent / "MarsDataPipline"
OUT = APP / "data"

# --- the world grid (must equal src/map/geo.ts GRID) ---
W, H = 1477, 1436
LON0, DLON = 136.7490510333193, 0.001687051876845213
LAT0, DLAT = -4.148577212911933, -0.0016870993139129456

# --- settings ---
IMAGERY_JPEG_QUALITY = 80
ELEV_NODATA = -32768
SLOPE_SCALE, SLOPE_NODATA = 0.25, 255          # slope stored as uint8 in quarter degrees
STRATA_EDGES_M = (-4000.0, -2000.0)            # L3 below -4 km, L2 -4 to -2 km, L1 above -2 km
STRATA_RAMP = ("#4a3401", "#2db11c", "#0e0cca")  # summit -> floor, the design's strata gradient
WEBP_QUALITY = 80
HEAT_KINDS = {"ground": "tsurf", "air": "tair"}
DUST_SOLS = (1850, 800)                        # clear-season reference sol first, then the dusty sol
DUST_COLOURS = ("#FACC15", "#F97316", "#DC2626")  # low / moderate / high, as the pipeline's overlays
DUST_ALPHA = (0.42, 0.55, 0.7)


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


def check_grid_transform(gdal, scale=1):
    a, _, c, _, e, f = gdal
    assert math.isclose(c, LON0, abs_tol=1e-9) and math.isclose(f, LAT0, abs_tol=1e-9), "grid origin differs from geo.ts"
    assert math.isclose(a, DLON * scale, rel_tol=1e-9) and math.isclose(e, DLAT * scale, rel_tol=1e-9), "grid step differs"


def save_webp(rgba, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(path, "WEBP", quality=WEBP_QUALITY, method=4)


# --- stages ---------------------------------------------------------------

def stage_imagery():
    src = PIPE / "gale_tiles/out_tiles/imagery"
    meta = json.loads((src / "manifest.json").read_text())
    n = 0
    for z in range(meta["zoom_range"][0], meta["zoom_range"][1] + 1):
        for f in sorted((src / str(z)).glob("*/*.png")):
            dst = OUT / "imagery" / str(z) / f.parent.name / f"{f.stem}.jpg"
            if dst.exists() and dst.stat().st_mtime > f.stat().st_mtime:
                n += 1
                continue
            rgb = np.asarray(Image.open(f).convert("RGB")).astype(np.float64) / 255
            dst.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray((tint(rgb) * 255 + 0.5).astype(np.uint8)).save(dst, quality=IMAGERY_JPEG_QUALITY, optimize=True)
            n += 1
    print(f"imagery: {n} tiles")
    return {
        "path": "imagery/{z}/{row}/{col}.jpg",
        "zooms": meta["zoom_range"],
        "per_zoom": meta["per_zoom"],
        "tint": "design map tint baked in (scripts/tint_map.py)",
        "attribution": "Imagery NASA/JPL-Caltech/MSSS",
    }


def load_terrain():
    """(elev_m, slope_deg, slope_q3_deg) on the world grid, from the 20 m CTX DTM rasters.

    gale_dem_20m.tif and gale_slope_20m.tif (MarsDataPipline/processed_data, from the team Drive) are
    resampled onto the 100 m world grid: elevation and slope by area average, plus the upper-quartile
    slope of the ~5 x 5 raster pixels in each cell, so the router sees steep ground that a 100 m mean
    hides. Needs rasterio (pip install rasterio, or the pipeline's gale-env).
    """
    import rasterio
    from rasterio.transform import Affine
    from rasterio.warp import Resampling, reproject

    dem, slope_tif = PIPE / "processed_data/gale_dem_20m.tif", PIPE / "processed_data/gale_slope_20m.tif"
    cache = OUT / "_cache_terrain.npz"
    if cache.exists() and cache.stat().st_mtime > max(dem.stat().st_mtime, slope_tif.stat().st_mtime):
        d = np.load(cache)
        if "slope_q3" in d.files:
            return d["elev"], d["slope"], d["slope_q3"]
    dst_transform = Affine(DLON, 0, LON0, 0, DLAT, LAT0)

    def resample(path, how):
        out = np.full((H, W), np.nan, np.float32)
        with rasterio.open(path) as src:
            assert src.crs and abs(src.crs.to_dict().get("R", src.crs.to_dict().get("a", 3396190)) - 3396190) < 1, "DTM is not on the Mars sphere"
            reproject(rasterio.band(src, 1), out, src_transform=src.transform, src_crs=src.crs, dst_transform=dst_transform,
                      dst_crs=src.crs, resampling=how, src_nodata=np.nan, dst_nodata=np.nan)
        return out.astype(np.float64)

    elev = resample(dem, Resampling.average)
    slope = resample(slope_tif, Resampling.average)
    slope_q3 = resample(slope_tif, Resampling.q3)
    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache, elev=elev, slope=slope, slope_q3=slope_q3)
    return elev, slope, slope_q3


def stage_terrain():
    elev, slope, slope_q3 = load_terrain()
    as_u8 = lambda a: np.where(np.isfinite(a), np.clip(np.round(a / SLOPE_SCALE), 0, SLOPE_NODATA - 1), SLOPE_NODATA).astype(np.uint8)
    e = np.where(np.isfinite(elev), np.round(elev), ELEV_NODATA).astype("<i2")
    (OUT / "terrain.bin").write_bytes(e.tobytes() + as_u8(slope).tobytes() + as_u8(slope_q3).tobytes())
    ok = np.isfinite(elev)
    print(f"terrain: {ok.sum()} cells, {(~ok).sum()} nodata, elev {np.nanmin(elev):.0f} to {np.nanmax(elev):.0f} m")
    return {
        "path": "terrain.bin",
        "layout": "elev int16 LE (H*W, row-major), then slope uint8 (H*W), then slope_q3 uint8 (H*W)",
        "elev": {"dtype": "int16", "units": "m", "nodata": ELEV_NODATA},
        "slope": {"dtype": "uint8", "scale_deg": SLOPE_SCALE, "nodata": SLOPE_NODATA, "what": "mean of the 20 m slope raster"},
        "slope_q3": {"dtype": "uint8", "scale_deg": SLOPE_SCALE, "nodata": SLOPE_NODATA, "what": "upper-quartile 20 m slope in the cell"},
        "elev_range_m": [float(np.nanmin(elev)), float(np.nanmax(elev))],
        "source": "MarsDataPipline processed_data/gale_dem_20m.tif + gale_slope_20m.tif (CTX stereo DTMs, NHM), resampled to 100 m",
    }


def hillshade(elev, az=315.0, alt=45.0, z_factor=2.0):
    e = np.where(np.isfinite(elev), elev, np.nanmean(elev))
    gy, gx = np.gradient(e * z_factor, 100.0)  # rows go south, so gy is the southward gradient
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)                # downslope azimuth, clockwise from north
    a, z = np.radians(az), np.radians(90 - alt)
    return np.clip(np.cos(z) * np.cos(slope) + np.sin(z) * np.sin(slope) * np.cos(a - aspect), 0, 1)


def stage_strata():
    elev, _, _ = load_terrain()
    lo, hi = float(np.nanmin(elev)), float(np.nanmax(elev))
    # Colour: the design's ramp over the full elevation range, shaded so the terrain reads.
    t = np.clip((hi - elev) / (hi - lo), 0, 1)           # 0 at the summit, 1 on the floor
    ramp = np.stack([hex_rgb(h) for h in STRATA_RAMP])
    seg = np.where(t < 0.5, 0, 1)
    u = np.where(t < 0.5, t * 2, (t - 0.5) * 2)[..., None]
    rgb = ramp[seg] * (1 - u) + ramp[seg + 1] * u
    rgb = rgb * (0.45 + 0.75 * hillshade(elev))[..., None]
    rgb = np.clip(np.nan_to_num(rgb), 0, 255).astype(np.uint8)
    edges = (-np.inf, *STRATA_EDGES_M, np.inf)
    levels = []
    for n, (a, b) in zip((3, 2, 1), zip(edges[:-1], edges[1:])):
        band = np.isfinite(elev) & (elev >= a) & (elev < b)
        rgba = np.dstack([rgb, np.where(band, 255, 0).astype(np.uint8)])
        save_webp(rgba, OUT / "strata" / f"l{n}.webp")
        levels.append({"level": n, "path": f"strata/l{n}.webp", "min_m": None if a == -np.inf else a,
                       "max_m": None if b == np.inf else b, "share": round(float(band.sum() / np.isfinite(elev).sum()), 3)})
    levels.sort(key=lambda d: d["level"])
    print("strata: " + ", ".join(f"L{d['level']} {d['share']:.0%}" for d in levels))
    return {"levels": levels, "ramp": list(STRATA_RAMP), "elev_range_m": [lo, hi], "rect": [0, 0, W, H]}


def stage_heat():
    lut = np.array(json.loads((APP / "scripts/inferno_lut.json").read_text())["rgb"], dtype=np.uint8)
    kinds, seasons, frames, range_k = {}, None, None, None
    for kind, name in HEAT_KINDS.items():
        src = PIPE / f"heatmap/outputs/maps/{kind}"
        man = json.loads((src / "map_manifest.json").read_text())
        grid = man["grid"] if "grid" in man else json.loads((PIPE / "heatmap/outputs/maps/ground/map_manifest.json").read_text())["grid"]
        check_grid_transform(grid["transform_gdal"], scale=2)
        D, C = man["encodings"]["D"], man["encodings"]["C"]
        assert C["colormap"] == "inferno" and C["levels"] == 256
        range_k = range_k or tuple(C["range_k"])
        assert tuple(C["range_k"]) == range_k, "ground and air colour ranges differ"
        frames = man["frames"]["labels"]
        seasons = [{"tag": s["tag"], "ls": s["ls_deg"], "tau": round(s["tau"], 2)} for s in man["scenarios"]]
        lo, hi = range_k
        step = (hi - lo) / 255
        stats = {}
        for sc in man["scenarios"]:
            codes = np.fromfile(src / "raw" / f"gale_{name}_{sc['tag']}.u16", dtype="<u2").reshape(D["shape"])
            ok = codes != D["nodata"]
            T = D["offset_k"] + D["scale_k"] * codes.astype(np.float64)
            stats[sc["tag"]] = [round(float(T[ok].min()), 1), round(float(T[ok].max()), 1)]
            for j, lab in enumerate(frames):
                idx = np.round((np.clip(T[j], lo, hi) - lo) / step).astype(np.intp)
                rgba = np.zeros(T.shape[1:] + (4,), np.uint8)
                rgba[..., :3] = lut[idx]
                rgba[..., 3] = np.where(ok[j], 255, 0)
                save_webp(rgba, OUT / "heat" / kind / sc["tag"] / f"{lab}.webp")
        kinds[kind] = {"title": man["title"], "range_by_season_k": stats, "caveats": man.get("caveats")}
        print(f"heat {kind}: {len(man['scenarios'])} seasons x {len(frames)} frames, " +
              ", ".join(f"{k} {v[0]}-{v[1]} K" for k, v in stats.items()))
    stops = [("#%02x%02x%02x" % tuple(lut[i])) for i in np.linspace(0, 255, 9).round().astype(int)]
    return {
        "kinds": kinds, "seasons": seasons, "frames": frames,
        "path": "heat/{kind}/{season}/{frame}.webp",
        # 200 m pixels: 738 x 718 cover world x 0-1476, y 0-1436 (the pipeline drops the odd last column)
        "rect": [0, 0, 1476, 1436],
        "range_k": list(range_k), "colormap": "inferno", "legend_stops": stops,
        "credit": "Model: Team Phobos (physics baseline + REMS-fitted correction); THEMIS/TES NASA/JPL-Caltech/ASU",
    }


def stage_dustdevil():
    src = PIPE / "dust_devil/outputs"
    ref = json.loads(next(src.glob("dust_devil_heating_index_reference_sol*.json")).read_text())
    cuts = ref["class_cuts"]
    sols = []
    for sol in DUST_SOLS:
        d = np.load(src / f"gale_dust_devil_heating_index_sol{sol}.npz")
        m = d["likelihood_mean"]
        assert m.shape == (H, W), "dust devil grid shape"
        assert np.allclose(d["class_cuts"], cuts), "sol was scored against a different reference"
        cls = np.digitize(np.nan_to_num(m, nan=-1), cuts)  # 0 none, 1 low, 2 moderate, 3 high
        rgba = np.zeros((H, W, 4), np.uint8)
        for k in (1, 2, 3):
            rgba[cls == k] = [*hex_rgb(DUST_COLOURS[k - 1]).astype(np.uint8), round(255 * DUST_ALPHA[k - 1])]
        save_webp(rgba, OUT / "dustdevil" / f"sol{sol}.webp")
        (OUT / "dustdevil" / f"sol{sol}_level.bin").write_bytes(cls.astype(np.uint8).tobytes())  # 0-3 per cell, for the router
        ok = np.isfinite(m)
        share = [round(float((cls[ok] == k).mean()), 3) for k in (1, 2, 3)]
        sols.append({"sol": int(d["sol"]), "ls": round(float(d["ls_deg"]), 1), "tau": round(float(d["tau"]), 2),
                     "tau_source": str(d["tau_source"]), "path": f"dustdevil/sol{sol}.webp", "levels_path": f"dustdevil/sol{sol}_level.bin", "share_low_mod_high": share})
        print(f"dust devil sol {sol}: tau {float(d['tau']):.2f}, low/moderate/high {share}")
    return {
        "sols": sols, "ref_sol": ref["ref_sol"], "class_cuts": cuts, "colours": list(DUST_COLOURS), "alpha": list(DUST_ALPHA),
        "levels": ["low", "moderate", "high"], "day_ltst": ref["day_ltst"], "rect": [0, 0, W, H],
        "meaning": "Dust Devil Heating Index: how strongly the Sun heats the ground (9:00-16:00 LTST), relative to sol "
                   f"{ref['ref_sol']}. Levels are the top 50 / 30 / 10% of that sol. A heuristic, not a probability.",
    }


STAGES = {"imagery": stage_imagery, "terrain": stage_terrain, "strata": stage_strata, "heat": stage_heat, "dustDevil": stage_dustdevil}


def main(names):
    names = names or list(STAGES)
    unknown = set(names) - set(STAGES)
    assert not unknown, f"unknown stages {unknown}; choose from {list(STAGES)}"
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "manifest.json"
    man = json.loads(path.read_text()) if path.exists() else {}
    man.update({"version": 1, "grid": {"W": W, "H": H, "LON0": LON0, "DLON": DLON, "LAT0": LAT0, "DLAT": DLAT}})
    for n in names:
        t = time.time()
        man[n] = STAGES[n]()
        print(f"  ({time.time() - t:.0f} s)")
    man["built"] = time.strftime("%Y-%m-%d %H:%M")
    path.write_text(json.dumps(man, indent=1))
    print(f"wrote {path}")


if __name__ == "__main__":
    main(sys.argv[1:])
