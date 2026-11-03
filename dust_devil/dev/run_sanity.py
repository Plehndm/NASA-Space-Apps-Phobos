"""SUPERSEDED (Nov 2): kept as the record of the Oct 30 sanity run (sol-800 reference). It predates the three levels
(CLASS_TOP_PCTS, LEVEL_COLOURS) and the heating_index file names, so it no longer runs as is; use the notebook.

Sanity run of the multi-sol path on the real data: sols 799-804 around the reference sol.
Writes to dust_devil/outputs/_dev/dust_devil_sanity/ (not the final output folder), then reports the sol-800 regression
diff against dust_devil/outputs/_dev/baseline_sol800/ and the day-to-day differences between consecutive sols.

Run from the project root:  gale-env/Scripts/python.exe dust_devil/dev/run_sanity.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

import multisol as ms

DD = Path(__file__).resolve().parents[1]
PROC = DD.parent / "processed_data"
TILES = DD.parent / "gale_tiles" / "out_tiles"
DEV_OUT = DD / "outputs" / "_dev"
OUT = DEV_OUT / "dust_devil_sanity"

SOLS_SANITY = [799, 800, 801, 802, 803, 804]

CFG = dict(
    SOLS=SOLS_SANITY, REF_SOL=800, SCORE_CAP=1.0, RUN_REFERENCE=True,
    SLOPE_SCALE_DEG=10.0, DAY_LTST=(9.0, 16.0), LIKELY_TOP_PCT=10, MIN_BINS=40,
    TAU_BAND="880", MAX_TAU_GAP_SOLS=5, TAU_CLIM_LS_WINDOW=10.0, TAU_CLIM_EXCLUDE=(2082, 2133), TAU_CLIM_MIN_SOLS=5,
    BINNED_CSV=PROC / "rems_binned_all_sols.csv", FEATURES_CSV=PROC / "gale_dust_devil_features_100m.csv",
    META_JSON=PROC / "gale_dust_devil_meta.json", TAU_CSV=PROC / "mastcam_tau_per_sol.csv",
    TEMPLATE_TIF=PROC / "gale_ti_night_themis100m_native.tif",
    IMAGERY_PREVIEW=TILES / "imagery_preview_z11.png", HILLSHADE_PREVIEW=TILES / "topo_preview_z11.png", PREVIEW_BOUNDS=None,
    OUT_DIR=OUT, REFERENCE_JSON=OUT / "dust_devil_reference_sol800.json",
    HIGHLIGHT="#EF4444", ALPHA=0.55, PANEL_W=1100, SEPARATE_W=2000, GIF_W=1000, GIF_MS=800,
)

summary = ms.run_multisol(CFG)
pd.set_option("display.width", 250)
print("\n" + summary.to_string(index=False))

# ---- regression: sol 800 against the single-sol baseline ----
base = np.load(DEV_OUT / "baseline_sol800" /"gale_dust_devil_likelihood_sol800.npz")
new = np.load(OUT / "gale_dust_devil_likelihood_sol800.npz")
print("\nsol 800, fixed LTST grid vs baseline_sol800/ (old REMS-bin scheme; an expected change, not a regression;"
      " the regression gates are in tests/test_dd_1_regression.py):")
for k in ("likelihood_mean", "likelihood_max"):
    same_nan = np.array_equal(np.isnan(new[k]), np.isnan(base[k]))
    d = np.abs(new[k].astype("float64") - base[k])
    print(f"  {k}: max abs diff {np.nanmax(d):.3g}, mean abs diff {np.nanmean(d):.3g}, NaN pattern identical: {same_nan}")
bt, nt = pd.read_csv(DEV_OUT / "baseline_sol800" /"rover_sol800_table.csv"), pd.read_csv(OUT / "rover_sol800_table.csv")
for col in ("gap_model_k_rover", "score_rover"):
    print(f"  rover table {col}: max abs diff {np.abs(nt[col] - bt[col]).max():.3g}")

# ---- day-to-day: consecutive sols in the list ----
rems = pd.read_csv(CFG["BINNED_CSV"])
win = rems[rems.ltst_bin_center_hr.between(*CFG["DAY_LTST"])]
print("\nREMS bins inside the 9-16 LTST window per sol (rover check only now; maps use the fixed 28):",
      win.groupby("sol").size().reindex(SOLS_SANITY).to_dict())
print("\nday-to-day differences of the daily-mean score (consecutive sols in SOLS_SANITY):")
maps = {s: np.load(OUT / f"gale_dust_devil_likelihood_sol{s}.npz") for s in SOLS_SANITY}
for a, b in zip(SOLS_SANITY[:-1], SOLS_SANITY[1:]):
    for k in ("likelihood_mean", "likelihood_max"):
        d = maps[b][k].astype("float64") - maps[a][k]
        ad = np.abs(d)
        i = np.unravel_index(np.nanargmax(ad), ad.shape)
        print(f"  sol {a} -> {b} {k:16s}: max |diff| {np.nanmax(ad):.4f} at (row {i[0]}, col {i[1]}), "
              f"mean |diff| {np.nanmean(ad):.4f}, p99 |diff| {np.nanpercentile(ad, 99):.4f}, mean diff {np.nanmean(d):+.4f}")
