"""Gate 1: with SOLS = [800], the multi-sol path reproduces the single-sol daily mean and max.

Changed with the user's approval: maps are scored on a fixed LTST grid (96 quarter-hour bin centres; daily
mean over the 28 inside 9-16 LTST), not on each sol's REMS bins, so the old single-sol output is no longer the
target. The single-sol oracle is now run on that fixed grid (synthetic, and a real 300 x 300 crop that fits in
memory). dust_devil/outputs/_dev/baseline_sol800/ still checks two things: the core arithmetic, fed sol 800's REMS bins,
reproduces the old maps (< 1e-5), and the rover table's kelvin columns, which still use the REMS bins, are unchanged."""
import numpy as np
import pandas as pd
import pytest

import dd_oracle
from dd_synth import BASELINE_DIR, PROC, base_cfg, make_day, multisol_cfg

LS = float(dd_oracle.ls_deg(800))
TAU = 1.4975
SRC = "Mastcam 880 nm, nearest 1 sol(s) away"
MAP_LTST = np.arange(96) * 0.25 + 0.125          # independent of the module on purpose


def oracle_maps(grid, cfg, ls=LS, tau=TAU, r=10, c=12):
    """Single-sol maps on the fixed grid. The kelvin scale cancels in the maps, so any positive 'observed' gap works."""
    mean, mx, _ = dd_oracle.single_sol(grid, ls, tau, MAP_LTST, np.ones(len(MAP_LTST)), r, c, cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"])
    return mean, mx


def oracle_scale(grid, day, cfg, ls=LS, tau=TAU):
    """Single-sol rover scale: still from the sol's own REMS bins and observed gap."""
    a, _, c0, _, e, f = grid["transform"]
    r, c = int((day.latitude_deg[0] - f) / e), int((day.longitude_deg_e[0] - c0) / a)
    gap_obs = (day.ground_temp_k - day.air_temp_k).to_numpy()
    return dd_oracle.single_sol(grid, ls, tau, day.ltst_bin_center_hr.to_numpy(), gap_obs, r, c, cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"])[2]


def test_reference_sol_reproduces_single_sol(ms, grid):
    cfg = base_cfg()
    day = make_day(800, 10, 12)
    exp_mean, exp_max = oracle_maps(grid, cfg)
    ref = ms.build_reference(grid, day, LS, TAU, SRC, cfg)
    res = ms.run_sol(800, day, grid, LS, TAU, SRC, ref, cfg)
    np.testing.assert_array_equal(np.isnan(res["likelihood_mean"]), np.isnan(exp_mean))
    np.testing.assert_allclose(res["likelihood_mean"], exp_mean, atol=1e-6, rtol=0, equal_nan=True)
    np.testing.assert_allclose(res["likelihood_max"], exp_max, atol=1e-6, rtol=0, equal_nan=True)
    assert res["rover_scale_k"] == pytest.approx(oracle_scale(grid, day, cfg), rel=1e-6)


def test_reference_threshold_is_top_10_percent_of_ref_sol(ms, grid):
    cfg = base_cfg()
    day = make_day(800, 10, 12)
    exp_mean, _ = oracle_maps(grid, cfg)
    ref = ms.build_reference(grid, day, LS, TAU, SRC, cfg)
    assert ref["threshold"] == pytest.approx(float(np.nanpercentile(exp_mean, 90)), abs=1e-6)
    res = ms.run_sol(800, day, grid, LS, TAU, SRC, ref, cfg)
    n_valid = int(np.isfinite(exp_mean).sum())
    assert abs(res["frac_above_threshold"] - 0.10) <= 2 / n_valid, res["frac_above_threshold"]


def test_end_to_end_sols_800_matches_oracle(ms, grid, tmp_path):
    cfg = multisol_cfg(tmp_path, {800: (10, 12)}, grid)
    ms.run_multisol(cfg)
    z = np.load(cfg["OUT_DIR"] / "gale_dust_devil_heating_index_sol800.npz")
    loaded = ms.load_grid(cfg["FEATURES_CSV"], cfg["META_JSON"])
    tau = float(np.interp(800, [799, 801], [1.517, 1.478]))
    exp_mean, exp_max = oracle_maps(loaded, cfg, tau=tau)
    assert float(z["tau"]) == pytest.approx(tau, abs=1e-12)
    np.testing.assert_allclose(z["likelihood_mean"], exp_mean, atol=1e-6, rtol=0, equal_nan=True)
    np.testing.assert_allclose(z["likelihood_max"], exp_max, atol=1e-6, rtol=0, equal_nan=True)


def real_inputs(ms):
    for name in ("gale_dust_devil_likelihood_sol800.npz", "gale_dust_devil_likelihood_sol800.tif", "rover_sol800_table.csv"):
        assert (BASELINE_DIR / name).exists(), f"baseline missing: {BASELINE_DIR / name}"
    cfg = base_cfg()
    grid = ms.load_grid(PROC / "gale_dust_devil_features_100m.csv", PROC / "gale_dust_devil_meta.json")
    rems = pd.read_csv(PROC / "rems_binned_all_sols.csv")
    day = rems[rems.sol == 800].sort_values("bin").reset_index(drop=True)
    ls = float(ms.ls_deg(800))
    tau, src = ms.tau_for_sol(800, ls, pd.read_csv(PROC / "mastcam_tau_per_sol.csv"), cfg["MAX_TAU_GAP_SOLS"],
                              cfg["TAU_CLIM_LS_WINDOW"], cfg["TAU_CLIM_EXCLUDE"], cfg["TAU_CLIM_MIN_SOLS"])
    base = np.load(BASELINE_DIR / "gale_dust_devil_likelihood_sol800.npz")
    assert tau == pytest.approx(float(base["tau"]), abs=1e-12) and src.startswith("Mastcam"), (tau, src)
    return cfg, grid, day, ls, tau, src, base


@pytest.mark.realdata
def test_real_core_on_rems_bins_matches_baseline(ms):
    """Fed sol 800's own REMS bins (the old scheme), the per-bin scoring reproduces the single-sol baseline."""
    cfg, grid, day, ls, tau, src, base = real_inputs(ms)
    ltst = day.ltst_bin_center_hr.to_numpy()
    m = ms.score_maps(grid, ls, ltst, tau, ms.reference_proxy(grid, ls, ltst, tau), cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"], cfg["SCORE_CAP"])
    for key in ("likelihood_mean", "likelihood_max"):
        np.testing.assert_array_equal(np.isnan(m[key]), np.isnan(base[key]), err_msg=f"{key}: NaN pattern differs")
        diff = float(np.nanmax(np.abs(m[key].astype("float64") - base[key])))
        assert diff < 1e-5, f"{key}: max abs diff {diff:.3g} vs baseline"
    del m

    ref = ms.build_reference(grid, day, ls, tau, src, cfg)
    res = ms.run_sol(800, day, grid, ls, tau, src, ref, cfg)
    assert (res["rover_row"], res["rover_col"]) == (int(base["rover_row"]), int(base["rover_col"]))
    old, new = pd.read_csv(BASELINE_DIR / "rover_sol800_table.csv"), res["table"]
    np.testing.assert_array_equal(new.ltst_bin_center_hr.to_numpy(), old.ltst_bin_center_hr.to_numpy())
    for col in ("gap_obs_k", "gap_model_k_rover"):          # REMS-bin side, unchanged; score_rover moves with the reference
        np.testing.assert_allclose(new[col].to_numpy(float), old[col].to_numpy(float), atol=1e-4, err_msg=col)


@pytest.mark.realdata
def test_real_crop_fixed_grid_matches_oracle(ms):
    """Real inputs, 300 x 300 crop around the rover: multi-sol path vs the single-sol oracle on the fixed grid."""
    cfg, grid, day, ls, tau, src, _ = real_inputs(ms)
    r0, c0, n = 154, 222, 300                               # rover (304, 372) lands at (150, 150)
    a, b, c, d, e, f = grid["transform"]
    crop = {k: v[r0:r0+n, c0:c0+n].copy() for k, v in grid.items() if isinstance(v, np.ndarray)}
    crop.update(shape=(n, n), transform=(a, b, c + c0*a, d, e, f + r0*e))
    del grid
    exp_mean, exp_max = oracle_maps(crop, cfg, ls=ls, tau=tau, r=150, c=150)
    ref = ms.build_reference(crop, day, ls, tau, src, cfg)
    res = ms.run_sol(800, day, crop, ls, tau, src, ref, cfg)
    assert (res["rover_row"], res["rover_col"]) == (150, 150)
    np.testing.assert_allclose(res["likelihood_mean"], exp_mean, atol=1e-6, rtol=0, equal_nan=True)
    np.testing.assert_allclose(res["likelihood_max"], exp_max, atol=1e-6, rtol=0, equal_nan=True)
    assert res["rover_scale_k"] == pytest.approx(oracle_scale(crop, day, cfg, ls=ls, tau=tau), rel=1e-6)
