"""Step 5: residual model on top of the physics baseline.

T(x, t) = T_base(x, t) + f(covariates(x), LTST, Ls, tau). This module builds the predictors
and the learner for f, and the per-fold benchmark. Uses numpy, pandas and scikit-learn only.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

# --- learner settings, fixed before the first LOBO run (Oct 28); not tuned on scores ---
HGB_MAX_ITER = 300            # boosting rounds
HGB_LEARNING_RATE = 0.05
HGB_MAX_LEAF_NODES = 15
HGB_MIN_SAMPLES_LEAF = 50     # rows; about half a sol of 15-minute bins
HGB_L2 = 1.0
HGB_SEED = 0

HOURS_PER_SOL = 24.0          # LTST hours

# --- predictor sets for the ablation (fixed before running) ---
TIME = ["ltst_sin", "ltst_cos", "ls_sin", "ls_cos", "tau", "baseline_k"]
STATIC = ["ti_themis_tiu", "slope_deg", "aspect_sin", "aspect_cos", "albedo_mean"]
CONFIGS = {
    "full": TIME + STATIC + ["elev_dem_m"],
    "no_elev": TIME + STATIC,
    "time_only": TIME,
    "no_elev_flux": TIME + STATIC + ["q_abs_wm2"],
}


def make_features(df):
    """All candidate predictors as a DataFrame. df needs ltst_hr (bin centre, h), baseline_k and q_abs_wm2."""
    ltst = 2.0 * np.pi * df["ltst_hr"].to_numpy() / HOURS_PER_SOL
    ls = np.radians(df["ls_deg"].to_numpy())
    asp = np.radians(df["aspect_deg"].to_numpy())
    out = pd.DataFrame({
        "ltst_sin": np.sin(ltst), "ltst_cos": np.cos(ltst),
        "ls_sin": np.sin(ls), "ls_cos": np.cos(ls),
        "tau": df["tau"].to_numpy(), "baseline_k": df["baseline_k"].to_numpy(),
        "ti_themis_tiu": df["ti_themis_tiu"].to_numpy(), "slope_deg": df["slope_deg"].to_numpy(),
        "aspect_sin": np.sin(asp), "aspect_cos": np.cos(asp),
        "albedo_mean": df["albedo_mean"].to_numpy(), "elev_dem_m": df["elev_dem_m"].to_numpy(),
        "q_abs_wm2": df["q_abs_wm2"].to_numpy(),
    }, index=df.index)
    assert np.all(np.isfinite(out.to_numpy())), "non-finite predictor"
    return out


def make_learner():
    return HistGradientBoostingRegressor(
        max_iter=HGB_MAX_ITER, learning_rate=HGB_LEARNING_RATE, max_leaf_nodes=HGB_MAX_LEAF_NODES,
        min_samples_leaf=HGB_MIN_SAMPLES_LEAF, l2_regularization=HGB_L2,
        early_stopping=False, random_state=HGB_SEED)


def benchmark(train, test):
    """Mean REMS ground temperature per (bin, ls_bin) from train; per-bin mean where a cell is empty.

    Same rule as Step 4 (baseline_fit_lobo.ipynb). Returns (prediction, number of fallback rows).
    """
    cell = train.groupby(["bin", "ls_bin"]).ground_temp_k.mean()
    by_bin = train.groupby("bin").ground_temp_k.mean()
    pred = cell.reindex(pd.MultiIndex.from_arrays([test.bin, test.ls_bin])).to_numpy().copy()
    empty = np.isnan(pred)
    pred[empty] = by_bin.reindex(test.bin[empty]).to_numpy()
    assert np.all(np.isfinite(pred)), "benchmark has no value for some LTST bin"
    return pred, int(empty.sum())
