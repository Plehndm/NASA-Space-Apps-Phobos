"""Step 6: the full-grid surface-temperature map. Spec: docs/plan.md.

T = T_base + f. The physics baseline (thermal1d) runs once per Ls in its own process, chunk
by chunk with checkpoints (run_ls); the residual flann_safe_no_ti is added after, and the
float32 master is encoded as a COG (A), 16-bit PNGs (B), coloured PNGs (C) and raw uint16 (D).
Uses numpy, pandas, scikit-learn (through residual.py), rasterio, Pillow and matplotlib.

Shapes: maps are (N_FRAMES, n_rows, n_cols), row 0 at the north edge, NaN as nodata.
Per-pixel inputs are flat (n_pix,) over the valid pixels of a window, in C order. A window
is (r0, r1, r_step, c0, c1, c_step) on the 200 m grid.
"""
import ctypes
import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from ctypes import wintypes
from pathlib import Path

import numpy as np
import pandas as pd

import residual as r
import thermal1d as t

# --- grid -----------------------------------------------------------------
SRC_SHAPE = (1436, 1477)      # 100 m feature table, rows x cols
BLOCK = 2                     # 100 m pixels per 200 m pixel along each axis
MAP_SHAPE = (SRC_SHAPE[0] // BLOCK, SRC_SHAPE[1] // BLOCK)   # (718, 738); the odd last 100 m column is dropped
FULL_WINDOW = (0, MAP_SHAPE[0], 1, 0, MAP_SHAPE[1], 1)
STATIC_COLUMNS = ["slope_deg", "aspect_deg", "ti_themis_tiu", "albedo_mean", "elev_m"]
CRS_AUTHORITY = "IAU_2015:49900"   # Mars 2000 geographic, sphere of radius 3,396,190 m

# --- scenarios ------------------------------------------------------------
MAP_LS_DEG = (15.0, 75.0, 195.0, 255.0, 340.0)
TAU_WINDOW_DEG = 15.0         # deg of Ls either side of each map Ls for the median per-sol tau
FIT_PARAMS_LABEL = "all training blocks"   # row of fit_params.csv used for the map
SUSPECT_SOLS = (3763, 3778)   # DEM slope and elevation suspect; excluded from the residual fit

# --- frames: instants every 30 min of LTST, at the solver step ending at each instant ---
FRAME_MINUTES = 30
N_FRAMES = 24 * 60 // FRAME_MINUTES
FRAME_HOURS = np.arange(N_FRAMES) * FRAME_MINUTES / 60.0

# --- run ------------------------------------------------------------------
CHUNK_COLS = 1000             # columns per solver call and per checkpoint file; dry run (Oct 28), 5 workers:
                              # 13.4 ms/col at 1000, 16.7 at 500, 18.3 at 2000, 38 at 10000 (cache-bound)
THREAD_ENV = ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS")

# --- residual -------------------------------------------------------------
RESIDUAL_VARIANT = "flann_safe_no_ti"

# --- encodings (T = offset + scale * code) --------------------------------
COG_OFFSET_K, COG_SCALE_K, COG_NODATA = 200.0, 0.01, -32768    # A: int16
U16_OFFSET_K, U16_SCALE_K, U16_NODATA = 100.0, 0.01, 0         # B and D: uint16
COLOR_MAP = "inferno"         # C
COLOR_RANGE_K = (150.0, 300.0)
COLOR_LEVELS = 256
LOSSLESS_TOL_K = 0.005        # decoded A, B, D vs the float32 master


def ls_tag(ls):
    return f"ls{int(round(ls)):03d}"


def frame_label(hour):
    return f"{int(hour):02d}{int(round(hour % 1 * 60)):02d}"


def frame_steps(n_steps=t.STEPS_PER_SOL):
    """Index of the solver step that ends at each frame instant; 00:00 is the last step of the sol."""
    per = n_steps * FRAME_MINUTES / (24 * 60)
    assert per == int(per), "frame spacing must be a whole number of steps"
    idx = (np.arange(N_FRAMES) * int(per) - 1) % n_steps
    assert np.allclose(t.step_ltst(n_steps)[idx] % 24.0, FRAME_HOURS), "frame step does not end at the frame instant"
    return idx


FRAME_STEPS = frame_steps()


# --- inputs ---------------------------------------------------------------

def load_meta(meta_path):
    """gale_dust_devil_meta.json, checked against the grid shape and thermal1d's latitude constants."""
    meta = json.loads(Path(meta_path).read_text())
    a, b, c, d, e, f = meta["template_transform"]
    assert tuple(meta["template_shape"]) == SRC_SHAPE, f"template shape {meta['template_shape']} != {SRC_SHAPE}"
    assert b == 0.0 and d == 0.0, "rotated transform"
    assert np.isclose(f, t.LAT_TOP_DEG) and np.isclose(e, t.LAT_STEP_DEG), "meta transform disagrees with thermal1d"
    return meta


def map_transform(meta, window=FULL_WINDOW):
    """GDAL-order affine (a, b, c, d, e, f) of a window of the 200 m grid: lon = c + a col, lat = f + e row at pixel corners."""
    a, _, c, _, e, f = meta["template_transform"]
    a, e = a * BLOCK, e * BLOCK
    r0, _, rs, c0, _, cs = window
    return (a * cs, 0.0, c + c0 * a, 0.0, e * rs, f + r0 * e)


def lonlat_to_rowcol(transform, lon, lat):
    a, _, c, _, e, f = transform
    return int(np.floor((lat - f) / e)), int(np.floor((lon - c) / a))


def build_static_grid(features_path, meta):
    """200 m static inputs as a dict of (718, 738) arrays, plus 'valid' and 'lat_deg' (per row, (718,)).

    Slope, TI, albedo and elevation are 2x2 block means; aspect is the circular mean (atan2 of
    the mean sin and cos). A 200 m pixel is nodata if any of its four 100 m pixels is absent
    from the table. The last 100 m column is dropped (1477 is odd).
    """
    df = pd.read_csv(features_path, usecols=["row", "col"] + STATIC_COLUMNS)
    assert not df.duplicated(["row", "col"]).any(), "duplicate pixels in the feature table"
    assert df[STATIC_COLUMNS].notna().all().all(), "NaN in the feature table"
    src = {}
    for col in STATIC_COLUMNS:
        g = np.full(SRC_SHAPE, np.nan)
        g[df.row.to_numpy(), df.col.to_numpy()] = df[col].to_numpy()
        src[col] = g
    n_absent = int(np.isnan(src["slope_deg"]).sum())
    H, W = MAP_SHAPE

    def block_mean(g):
        return g[:H * BLOCK, :W * BLOCK].reshape(H, BLOCK, W, BLOCK).mean(axis=(1, 3))

    out = {col: block_mean(src[col]) for col in STATIC_COLUMNS if col != "aspect_deg"}
    asp = np.radians(src["aspect_deg"])
    out["aspect_deg"] = np.mod(np.degrees(np.arctan2(block_mean(np.sin(asp)), block_mean(np.cos(asp)))), 360.0)
    valid = np.all([np.isfinite(v) for v in out.values()], axis=0)
    assert np.all(out["ti_themis_tiu"][valid] > 0), "non-positive TI"
    assert np.all((out["albedo_mean"][valid] > 0) & (out["albedo_mean"][valid] < 1)), "albedo outside (0, 1)"
    assert np.all((out["slope_deg"][valid] >= 0) & (out["slope_deg"][valid] < 90)), "slope outside [0, 90)"
    _, _, _, _, e, f = map_transform(meta)
    out["lat_deg"] = f + (np.arange(H) + 0.5) * e
    out["valid"] = valid
    print(f"{n_absent} of {SRC_SHAPE[0] * SRC_SHAPE[1]} 100 m pixels absent from the table; "
          f"{int((~valid).sum())} of {valid.size} 200 m pixels are nodata; "
          f"100 m column {SRC_SHAPE[1] - 1} dropped")
    return out


def window_inputs(static, window):
    """Flat per-pixel inputs over the valid pixels of window, and the window's valid mask."""
    r0, r1, rs, c0, c1, cs = window
    sl = (slice(r0, r1, rs), slice(c0, c1, cs))
    valid = static["valid"][sl]
    lat = np.broadcast_to(static["lat_deg"][r0:r1:rs, None], valid.shape)
    flat = {col: static[col][sl][valid] for col in STATIC_COLUMNS}
    flat["lat_deg"] = lat[valid]
    return flat, valid


def map_tau(tbl, ls_values=MAP_LS_DEG, window_deg=TAU_WINDOW_DEG):
    """Median per-sol tau of the training sols within +-window_deg of each Ls (circular), placeholder sols excluded.

    tbl: the loaded training table (sealed test already dropped). Returns a DataFrame by Ls.
    """
    assert (tbl.split_role == "train").all(), "sealed-test rows in the table"
    assert (tbl.groupby("sol")[["ls_deg", "tau", "tau_is_placeholder"]].nunique() == 1).all().all(), "per-sol values vary"
    sols = tbl[~tbl.tau_is_placeholder].groupby("sol")[["ls_deg", "tau", "block"]].first()
    rows = []
    for ls in ls_values:
        near = sols[np.abs(np.mod(sols.ls_deg - ls + 180.0, 360.0) - 180.0) <= window_deg]
        assert len(near) > 0, f"no training sols within {window_deg} deg of Ls {ls}"
        rows.append({"ls_deg": ls, "n_sols": len(near), "blocks": ",".join(str(b) for b in sorted(near.block.unique())),
                     "tau": near.tau.median(), "tau_q25": near.tau.quantile(0.25), "tau_q75": near.tau.quantile(0.75),
                     "tau_min": near.tau.min(), "tau_max": near.tau.max()})
    return pd.DataFrame(rows).set_index("ls_deg")


# --- baseline -------------------------------------------------------------

def run_chunk(inp, ls, tau, params):
    """Baseline surface temperature (K) at the frame instants, (n_pix, N_FRAMES) float32, and the spin-up sols."""
    n = len(inp["lat_deg"])
    g_diff, f_ir, ti_scale = params
    Ts, n_sols, _ = t.simulate_sols(inp["lat_deg"], np.full(n, float(ls)), np.full(n, float(tau)),
                                    inp["slope_deg"], inp["aspect_deg"], inp["albedo_mean"], inp["ti_themis_tiu"],
                                    g_diff=g_diff, f_ir=f_ir, ti_scale=ti_scale)
    return Ts[:, FRAME_STEPS].astype(np.float32), n_sols


class _MemoryCounters(ctypes.Structure):
    _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]


def peak_memory_mb():
    """Peak working set of this process (MB), from the Win32 API (this project runs on Windows only)."""
    kernel32, psapi = ctypes.windll.kernel32, ctypes.windll.psapi
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(_MemoryCounters), wintypes.DWORD]
    pmc = _MemoryCounters()
    pmc.cb = ctypes.sizeof(_MemoryCounters)
    assert psapi.GetProcessMemoryInfo(kernel32.GetCurrentProcess(), ctypes.byref(pmc), pmc.cb), "GetProcessMemoryInfo failed"
    return pmc.PeakWorkingSetSize / 2 ** 20


def run_ls(ls, tau, params, static_path, out_dir, window, chunk_cols=CHUNK_COLS):
    """Worker: the baseline at one Ls over a window, saved chunk by chunk, then merged.

    Chunks already on disk are skipped, so a restart costs at most one chunk; a config file
    makes sure they come from the same run. Writes out_dir/master/{tag}_base.npy,
    (N_FRAMES, n_rows, n_cols) float32 with NaN nodata, and appends one line per chunk to
    out_dir/map_progress_{tag}.log. Returns a summary dict.
    """
    for v in THREAD_ENV:
        assert os.environ.get(v) == "1", f"{v} must be 1 in the worker (set by run_all_ls)"
    out_dir = Path(out_dir)
    master = out_dir / "master"
    master.mkdir(parents=True, exist_ok=True)
    tag = ls_tag(ls)
    inp, valid = window_inputs(dict(np.load(static_path)), window)
    n_pix = len(inp["lat_deg"])
    n_chunks = -(-n_pix // chunk_cols)
    config = {"ls_deg": float(ls), "tau": float(tau), "params": [float(p) for p in params],
              "window": [int(w) for w in window], "chunk_cols": int(chunk_cols), "n_pix": int(n_pix)}
    cfg_path = master / f"{tag}_config.json"
    if cfg_path.exists():
        assert json.loads(cfg_path.read_text()) == config, f"{cfg_path} is from a different run; delete {master} to start over"
    else:
        cfg_path.write_text(json.dumps(config, indent=1))
    log = out_dir / f"map_progress_{tag}.log"

    def note(line):
        with open(log, "a") as fh:
            fh.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {line}\n")

    note(f"start {tag} tau {tau:.4f} pixels {n_pix} chunks {n_chunks} pid {os.getpid()}")
    t_start = time.time()
    run_cols, max_sols = 0, 0
    for k in range(n_chunks):
        path = master / f"{tag}_chunk{k:03d}.npy"
        if path.exists():
            note(f"chunk {k:03d} on disk, skipped")
            continue
        sl = slice(k * chunk_cols, min(n_pix, (k + 1) * chunk_cols))
        t0 = time.time()
        frames, n_sols = run_chunk({key: v[sl] for key, v in inp.items()}, ls, tau, params)
        tmp = master / f"{tag}_chunk{k:03d}.tmp.npy"
        np.save(tmp, frames)
        os.replace(tmp, path)
        dt = time.time() - t0
        run_cols += len(frames)
        max_sols = max(max_sols, n_sols)
        note(f"chunk {k:03d}/{n_chunks} cols {len(frames)} {dt:.1f} s ({1e3 * dt / len(frames):.2f} ms/col) "
             f"spin-up {n_sols} sols, peak memory {peak_memory_mb():.0f} MB")
    frames = np.concatenate([np.load(master / f"{tag}_chunk{k:03d}.npy") for k in range(n_chunks)])
    assert frames.shape == (n_pix, N_FRAMES), f"merged chunks have shape {frames.shape}"
    assert np.all(np.isfinite(frames)), "non-finite baseline in the merged chunks"
    base = np.full((N_FRAMES,) + valid.shape, np.nan, dtype=np.float32)
    base[:, valid] = frames.T
    np.save(master / f"{tag}_base.npy", base)
    elapsed = time.time() - t_start
    note(f"done {tag}: {run_cols} columns run this session in {elapsed:.0f} s")
    return {"ls_deg": float(ls), "n_pix": n_pix, "n_chunks": n_chunks, "cols_run": run_cols,
            "elapsed_s": elapsed, "ms_per_col": 1e3 * elapsed / run_cols if run_cols else np.nan,
            "max_spinup_sols": max_sols, "peak_memory_mb": peak_memory_mb()}


def run_all_ls(ls_tau, params, static_path, out_dir, window, chunk_cols=CHUNK_COLS):
    """run_ls for every (ls, tau) in parallel, one process each. Returns the summaries in input order."""
    for v in THREAD_ENV:
        os.environ[v] = "1"   # inherited by the spawned workers, which import numpy only after start
    with ProcessPoolExecutor(max_workers=len(ls_tau)) as pool:
        futures = [pool.submit(run_ls, float(ls), float(tau), tuple(float(p) for p in params), str(static_path),
                               str(out_dir), tuple(int(w) for w in window), chunk_cols) for ls, tau in ls_tau]
        return [f.result() for f in futures]


# --- residual -------------------------------------------------------------

def residual_training_rows(tbl, params):
    """REMS rows for the map's residual model, with the all-blocks baseline as baseline_k.

    tbl: the loaded training table. Returns (frame, target, sols, Ts): frame and target are
    the fitting rows (no placeholder tau, no suspect sols), as in residual_flann_lobo.ipynb;
    sols holds the per-sol inputs and Ts (n_sol, STEPS_PER_SOL) the Step 4 model for them.
    """
    per_sol = ["ls_deg", "tau", "row", "slope_deg", "aspect_deg", "albedo_mean", "ti_themis_tiu", "tau_is_placeholder"]
    assert (tbl.groupby("sol")[per_sol].nunique() == 1).all().all(), "per-sol inputs vary within a sol"
    sols = tbl.groupby("sol")[per_sol].first().reset_index()
    g_diff, f_ir, ti_scale = params
    Ts, _, _ = t.simulate_sols(t.lat_from_row(sols.row.to_numpy()), sols.ls_deg.to_numpy(), sols.tau.to_numpy(),
                               sols.slope_deg.to_numpy(), sols.aspect_deg.to_numpy(), sols.albedo_mean.to_numpy(),
                               sols.ti_themis_tiu.to_numpy(), g_diff=g_diff, f_ir=f_ir, ti_scale=ti_scale)
    row_sol = pd.Series(np.arange(len(sols)), index=sols.sol)[tbl.sol].to_numpy()
    base = Ts[row_sol, t.bin_centre_step(tbl.bin.to_numpy())]
    fit_ok = ~tbl.tau_is_placeholder.to_numpy() & ~tbl.sol.between(*SUSPECT_SOLS).to_numpy()
    frame = tbl.assign(baseline_k=base, ltst_hr=(tbl.bin + 0.5) * t.BIN_HOURS, q_abs_wm2=0.0)
    target = tbl.ground_temp_k.to_numpy() - base
    return frame[fit_ok], target[fit_ok], sols, Ts


class MapResidual:
    """A clamped FLANN variant refit on all fitting rows: clamp ranges from those rows, then ridge on the clamped basis."""

    def __init__(self, frame, target, variant=RESIDUAL_VARIANT):
        self.static, clamp = r.FLANN_VARIANTS[variant]
        assert clamp, f"{variant} is not clamped; the map needs a clamped variant"
        self.variant = variant
        self.ranges = r.clamp_ranges(frame)
        self.pipe = r.make_flann_learner().fit(self.basis(frame)[0], target)

    def basis(self, frame):
        clamped, frac = r.apply_clamp(frame, self.ranges)
        return r.make_flann_basis(clamped, self.static), frac

    def predict(self, frame):
        B, frac = self.basis(frame)
        return self.pipe.predict(B), frac


def add_residual(base, inp, ls, tau, model):
    """Map temperature (N_FRAMES, n_pix) float32 = baseline + residual, and the clamped fractions.

    base: (N_FRAMES, n_pix) baseline at the frame instants. Returns (T, clamped): clamped maps
    each clamp column to the fraction of pixel-frames held at its range.
    """
    n = base.shape[1]
    static = pd.DataFrame({"ls_deg": np.full(n, float(ls)), "tau": np.full(n, float(tau)),
                           "ti_themis_tiu": inp["ti_themis_tiu"], "slope_deg": inp["slope_deg"],
                           "aspect_deg": inp["aspect_deg"], "albedo_mean": inp["albedo_mean"],
                           "elev_dem_m": inp["elev_m"], "q_abs_wm2": 0.0})
    T = np.empty_like(base)
    clamped = dict.fromkeys(model.ranges, 0.0)
    for j, hour in enumerate(FRAME_HOURS):
        pred, frac = model.predict(static.assign(ltst_hr=hour, baseline_k=base[j].astype(np.float64)))
        T[j] = (base[j] + pred).astype(np.float32)
        for c in clamped:
            clamped[c] += frac[c] / N_FRAMES
    assert np.all(np.isfinite(T)), "non-finite map temperature"
    return T, clamped


# --- encodings ------------------------------------------------------------

def quantize(T, offset, scale, nodata, dtype):
    """Integer codes round((T - offset) / scale), nodata where T is NaN. Nodata must be the dtype's minimum."""
    info = np.iinfo(dtype)
    assert nodata == info.min, "nodata must be the dtype minimum"
    ok = np.isfinite(T)
    v = np.round((T.astype(np.float64) - offset) / scale)
    assert np.all((v[ok] > info.min) & (v[ok] <= info.max)), f"temperature outside the {np.dtype(dtype).name} range"
    return np.where(ok, v, nodata).astype(dtype)


def dequantize(codes, offset, scale, nodata):
    return np.where(codes == nodata, np.nan, offset + scale * codes.astype(np.float64))


def color_lut():
    """(COLOR_LEVELS, 3) uint8 RGB of the colour map; asserts the colours are distinct, so C can be decoded."""
    import matplotlib
    lut = np.round(matplotlib.colormaps[COLOR_MAP].resampled(COLOR_LEVELS)(np.arange(COLOR_LEVELS))[:, :3] * 255)
    lut = lut.astype(np.uint8)
    assert len(np.unique(lut, axis=0)) == COLOR_LEVELS, "colour map has repeated colours"
    return lut


def color_step_k():
    return (COLOR_RANGE_K[1] - COLOR_RANGE_K[0]) / (COLOR_LEVELS - 1)


def color_rgba(T, lut):
    """(..., 4) uint8 RGBA of T on the fixed scale; transparent where T is NaN."""
    lo, hi = COLOR_RANGE_K
    ok = np.isfinite(T)
    idx = np.round((np.clip(np.where(ok, T, lo), lo, hi) - lo) / color_step_k()).astype(np.intp)
    rgba = np.zeros(T.shape + (4,), dtype=np.uint8)
    rgba[..., :3] = lut[idx]
    rgba[..., 3] = np.where(ok, 255, 0)
    rgba[~ok, :3] = 0
    return rgba


def export_ls(T, tag, out_dir, transform):
    """Write A, B, C and D for one Ls. T: (N_FRAMES, n_rows, n_cols) float32. Returns {format: [paths]}."""
    import rasterio
    from PIL import Image
    from rasterio.crs import CRS
    from rasterio.transform import Affine

    out_dir = Path(out_dir)
    labels = [frame_label(h) for h in FRAME_HOURS]
    files = {"A": [], "B": [], "C": [], "D": []}

    # A: COG, int16, one band per frame
    with rasterio.Env() as env:
        assert "COG" in env.drivers(), "GDAL COG driver not available"
    (out_dir / "cog").mkdir(parents=True, exist_ok=True)
    path = out_dir / "cog" / f"gale_tsurf_{tag}.tif"
    codes = quantize(T, COG_OFFSET_K, COG_SCALE_K, COG_NODATA, np.int16)
    profile = dict(driver="COG", width=T.shape[2], height=T.shape[1], count=N_FRAMES, dtype="int16",
                   crs=CRS.from_user_input(CRS_AUTHORITY), transform=Affine(*transform), nodata=COG_NODATA,
                   compress="DEFLATE", predictor=2)
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(codes)
        dst.scales = (COG_SCALE_K,) * N_FRAMES
        dst.offsets = (COG_OFFSET_K,) * N_FRAMES
        dst.units = ("K",) * N_FRAMES
        for i, lab in enumerate(labels, start=1):
            dst.set_band_description(i, f"LTST {lab[:2]}:{lab[2:]}")
    files["A"].append(path)

    # B: 16-bit grayscale PNG per frame, and D: raw uint16 little-endian, same codes
    codes = quantize(T, U16_OFFSET_K, U16_SCALE_K, U16_NODATA, np.uint16)
    (out_dir / "png16" / tag).mkdir(parents=True, exist_ok=True)
    for j, lab in enumerate(labels):
        path = out_dir / "png16" / tag / f"ltst_{lab}.png"
        Image.fromarray(codes[j]).save(path, optimize=True)
        files["B"].append(path)
    (out_dir / "raw").mkdir(parents=True, exist_ok=True)
    path = out_dir / "raw" / f"gale_tsurf_{tag}.u16"
    np.ascontiguousarray(codes, dtype="<u2").tofile(path)
    files["D"].append(path)

    # C: RGBA PNG per frame on the fixed colour scale
    lut = color_lut()
    (out_dir / "png_color" / tag).mkdir(parents=True, exist_ok=True)
    for j, lab in enumerate(labels):
        path = out_dir / "png_color" / tag / f"ltst_{lab}.png"
        Image.fromarray(color_rgba(T[j], lut)).save(path, optimize=True)
        files["C"].append(path)
    return files


def write_legend(out_dir):
    """png_color/legend.png: the fixed colour scale of format C."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    (Path(out_dir) / "png_color").mkdir(parents=True, exist_ok=True)
    path = Path(out_dir) / "png_color" / "legend.png"
    fig, ax = plt.subplots(figsize=(4.0, 0.9))
    norm = matplotlib.colors.Normalize(*COLOR_RANGE_K)
    cmap = matplotlib.colormaps[COLOR_MAP].resampled(COLOR_LEVELS)
    cb = fig.colorbar(matplotlib.cm.ScalarMappable(norm=norm, cmap=cmap), cax=ax, orientation="horizontal", extend="both")
    cb.set_label("Surface temperature (K)")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def check_exports(T, files, transform, rover_lonlat, rover_rowcol):
    """Decode A, B, C and D and compare with the master T; check the rover pixel's position.

    Lossless formats must match within LOSSLESS_TOL_K with the same nodata pattern; C within one
    colour step of T clipped to the colour range. Returns the largest errors (K).
    """
    import rasterio
    from PIL import Image

    nan = np.isnan(T)
    out = {}
    with rasterio.open(files["A"][0]) as ds:
        assert ds.count == N_FRAMES and ds.shape == T.shape[1:], "COG shape"
        assert np.allclose(tuple(ds.transform)[:6], transform, rtol=0, atol=1e-12), "COG transform"
        assert ds.crs.is_geographic, "COG CRS is not geographic"
        assert ds.scales == (COG_SCALE_K,) * N_FRAMES and ds.offsets == (COG_OFFSET_K,) * N_FRAMES, "COG scale/offset tags"
        assert ds.descriptions[0] == "LTST 00:00" and ds.descriptions[-1] == "LTST 23:30", "COG band descriptions"
        assert ds.index(*rover_lonlat) == tuple(rover_rowcol), f"rover at {ds.index(*rover_lonlat)} in the COG"
        dec = dequantize(ds.read(), COG_OFFSET_K, COG_SCALE_K, ds.nodata)
    assert np.array_equal(np.isnan(dec), nan), "COG nodata pattern"
    out["A_max_err_k"] = float(np.nanmax(np.abs(dec - T)))

    dec = np.stack([dequantize(np.asarray(Image.open(p)), U16_OFFSET_K, U16_SCALE_K, U16_NODATA) for p in files["B"]])
    assert np.array_equal(np.isnan(dec), nan), "PNG16 nodata pattern"
    out["B_max_err_k"] = float(np.nanmax(np.abs(dec - T)))

    raw = np.fromfile(files["D"][0], dtype="<u2").reshape(T.shape)
    dec = dequantize(raw, U16_OFFSET_K, U16_SCALE_K, U16_NODATA)
    assert np.array_equal(np.isnan(dec), nan), "raw nodata pattern"
    out["D_max_err_k"] = float(np.nanmax(np.abs(dec - T)))
    for f in ("A", "B", "D"):
        assert out[f"{f}_max_err_k"] <= LOSSLESS_TOL_K, f"format {f} differs from the master by {out[f'{f}_max_err_k']:.4f} K"

    lut = color_lut()
    key = (lut[:, 0].astype(np.int64) << 16) | (lut[:, 1].astype(np.int64) << 8) | lut[:, 2]
    order = np.argsort(key)
    lo, hi = COLOR_RANGE_K
    err = 0.0
    for j, p in enumerate(files["C"]):
        rgba = np.asarray(Image.open(p))
        assert rgba.shape == T.shape[1:] + (4,), "coloured PNG shape"
        assert np.array_equal(rgba[..., 3] == 0, nan[j]), "coloured PNG transparency pattern"
        k = (rgba[..., 0].astype(np.int64) << 16) | (rgba[..., 1].astype(np.int64) << 8) | rgba[..., 2]
        pos = np.searchsorted(key[order], k[~nan[j]])
        assert np.all(key[order][np.minimum(pos, COLOR_LEVELS - 1)] == k[~nan[j]]), "colour not in the colour map"
        dec = lo + order[pos] * color_step_k()
        err = max(err, float(np.max(np.abs(dec - np.clip(T[j][~nan[j]], lo, hi)))))
    assert err <= color_step_k(), f"coloured PNG off by {err:.3f} K, more than one colour step"
    out["C_max_err_k"] = err

    assert lonlat_to_rowcol(transform, *rover_lonlat) == tuple(rover_rowcol), "rover pixel through the manifest transform"
    return out


def folder_size_mb(paths):
    return sum(Path(p).stat().st_size for p in paths) / 2 ** 20
