"""Synthetic inputs for the dust devil multi-sol gates: small synthetic grids near Gale, synthetic REMS sols,
and a builder that writes a complete synthetic input set (features CSV, meta.json, REMS CSV, tau CSV,
template GeoTIFF, preview PNGs) into a temp folder."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
DD_DIR = Path(__file__).resolve().parents[1]
REPO = DD_DIR.parent
PROC = REPO / "processed_data"
BASELINE_DIR = PROC / "baseline_sol800"

import dd_oracle  # noqa: E402

H, W = 24, 30
TRANSFORM = (0.001687051876845213, 0.0, 137.35, 0.0, -0.0016870993139129456, -4.64)   # (a, b, c, d, e, f), north-up
DROPPED = [(0, 0), (17, 23)]                    # pixels absent from the features CSV (NaN everywhere)
BINS = [b for b in range(96) if b % 3 != 0]     # 64 bins, gaps like the real REMS coverage
REMS_COLS = ["sol", "bin", "ltst_bin_start_hr", "ltst_bin_center_hr", "air_temp_k", "ground_temp_k", "pressure_pa",
             "latitude_deg", "longitude_deg_e", "elevation_m"]


def pixel_centre(row, col, transform=TRANSFORM):
    a, _, c, _, e, f = transform
    return f + (row + 0.5) * e, c + (col + 0.5) * a          # (lat, lon)


def make_grid(seed=0):
    """Synthetic grid with the same dtypes as the notebook: float32 layers, float64 lat from the transform.
    Slopes stay at or below 20 deg (see test_dd_shared_reference for why)."""
    rng = np.random.default_rng(seed)
    a, _, c, _, e, f = TRANSFORM
    slope = rng.uniform(0, 20, (H, W)).astype("float32")
    aspect = rng.uniform(0, 360, (H, W)).astype("float32")
    albedo = rng.uniform(0.10, 0.27, (H, W)).astype("float32")
    ti = rng.uniform(100, 800, (H, W)).astype("float32")
    dem = rng.uniform(-4700, -4300, (H, W)).astype("float32")
    for r, cc in DROPPED:
        for arr in (slope, aspect, albedo, ti, dem):
            arr[r, cc] = np.nan
    lat = (f + (np.arange(H) + 0.5) * e)[:, None] * np.ones((1, W), "float32")
    return dict(shape=(H, W), transform=TRANSFORM, lat=lat, slope=slope, aspect=aspect, albedo=albedo, ti=ti, dem=dem)


def make_day(sol, row, col, gap_amp_k=25.0, elev_m=-4461.2, move=False, transform=TRANSFORM):
    """One synthetic REMS sol, rover static at the centre of (row, col). Observed ground-air gap peaks near noon."""
    lat, lon = pixel_centre(row, col, transform)
    b = np.array(BINS)
    start = b / 4
    centre = np.round(start + 0.125, 2)
    gap = gap_amp_k * np.clip(np.sin(np.pi * (centre - 6) / 12), 0, None) - 8.0
    air = 220.0 + 15 * np.sin(np.pi * (centre - 8) / 12)
    lats = np.full(len(b), lat)
    if move:
        lats[len(b) // 2:] += 3 * transform[4]                # three pixels south for the second half of the sol
    return pd.DataFrame({"sol": sol, "bin": b, "ltst_bin_start_hr": start, "ltst_bin_center_hr": centre,
                         "air_temp_k": np.round(air, 2), "ground_temp_k": np.round(air + gap, 2), "pressure_pa": 900.0,
                         "latitude_deg": lats, "longitude_deg_e": lon, "elevation_m": elev_m})[REMS_COLS]


def base_cfg(**over):
    cfg = dict(REF_SOL=800, SCORE_CAP=1.0, SLOPE_SCALE_DEG=10.0, DAY_LTST=(9.0, 16.0), LIKELY_TOP_PCT=10, CLASS_TOP_PCTS=(50, 30, 10), TAU_BAND="880",
               MAX_TAU_GAP_SOLS=5, TAU_CLIM_LS_WINDOW=10.0, TAU_CLIM_EXCLUDE=(2082, 2133), TAU_CLIM_MIN_SOLS=5, MIN_BINS=40)
    cfg.update(over)
    return cfg


def write_synthetic_inputs(folder, sols_positions, grid):
    """Write every input run_multisol reads. sols_positions: {sol: (row, col)}. Returns the path part of the config.
    Sols 796-804 get Mastcam tau; any other sol has no measurement within 5 sols and falls back to the climatology rows."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    rows, cols = np.meshgrid(np.arange(H), np.arange(W), indexing="ij")
    lat_c, lon_c = pixel_centre(rows, cols)
    feat = pd.DataFrame({"pixel_id": (rows * W + cols).ravel(), "row": rows.ravel(), "col": cols.ravel(),
                         "lon": lon_c.ravel(), "lat": lat_c.ravel(), "elev_m": grid["dem"].ravel(),
                         "slope_deg": grid["slope"].ravel(), "aspect_deg": grid["aspect"].ravel(),
                         "ti_themis_tiu": grid["ti"].ravel(), "albedo_my24": grid["albedo"].ravel(),
                         "albedo_my25": grid["albedo"].ravel(), "albedo_my26": grid["albedo"].ravel(),
                         "albedo_mean": grid["albedo"].ravel()})
    feat = feat.dropna().reset_index(drop=True)
    feat.to_csv(folder / "features.csv", index=False)
    (folder / "meta.json").write_text(json.dumps(dict(demo_sol=800, template_shape=[H, W], template_transform=list(TRANSFORM))))

    pd.concat([make_day(s, r, c) for s, (r, c) in sorted(sols_positions.items())]).to_csv(folder / "rems.csv", index=False)

    mast = pd.DataFrame({"sol": [796, 799, 801, 803, 804], "tau": [1.471, 1.517, 1.478, 1.442, 1.468]})
    mast["ls_deg"] = dd_oracle.ls_deg(mast.sol)
    clim_rows = []
    for s in sols_positions:
        if s not in range(791, 810):
            ls_s = float(dd_oracle.ls_deg(s))
            for k, d_ls in enumerate([-8, -4, 0, 3, 6, 9]):
                clim_rows.append(dict(sol=s + 2000 + k, tau=0.60 + 0.02 * k, ls_deg=(ls_s + d_ls) % 360))
    t = pd.concat([mast, pd.DataFrame(clim_rows, columns=["sol", "tau", "ls_deg"])]).sort_values("sol")
    t["n"], t["tau_min"], t["tau_max"], t["band"] = 1, t.tau, t.tau, "880"
    t[["sol", "tau", "n", "tau_min", "tau_max", "ls_deg", "band"]].to_csv(folder / "tau.csv", index=False)

    import rasterio
    from rasterio.transform import Affine
    profile = dict(driver="GTiff", dtype="float32", count=1, height=H, width=W, crs="EPSG:4326",
                   transform=Affine(*TRANSFORM), nodata=np.nan)
    with rasterio.open(folder / "template.tif", "w", **profile) as dst:
        dst.write(grid["ti"], 1)

    from PIL import Image
    ramp = np.linspace(40, 220, 2 * W, dtype="float32")[None, :, None] * np.ones((2 * H, 1, 3), "float32")
    Image.fromarray(ramp.astype("uint8")).save(folder / "imagery.png")
    Image.fromarray((255 - ramp).astype("uint8")).save(folder / "hillshade.png")

    return dict(BINNED_CSV=folder / "rems.csv", FEATURES_CSV=folder / "features.csv", META_JSON=folder / "meta.json",
                TAU_CSV=folder / "tau.csv", TEMPLATE_TIF=folder / "template.tif", IMAGERY_PREVIEW=folder / "imagery.png",
                HILLSHADE_PREVIEW=folder / "hillshade.png", PREVIEW_BOUNDS=None,
                OUT_DIR=folder / "out", REFERENCE_JSON=folder / "out" / "dust_devil_reference_sol800.json",
                LEVEL_COLOURS=("#FACC15", "#F97316", "#DC2626"), ALPHA=0.55, PANEL_W=200, SEPARATE_W=300, GIF_W=1000, GIF_MS=800)


def multisol_cfg(folder, sols_positions, grid, **over):
    cfg = base_cfg(SOLS=sorted(sols_positions), RUN_REFERENCE=True)
    cfg.update(write_synthetic_inputs(folder, sols_positions, grid))
    cfg.update(over)
    return cfg
