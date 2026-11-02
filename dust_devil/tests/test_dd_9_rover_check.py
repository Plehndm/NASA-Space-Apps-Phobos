"""Rover check (added Oct 30 at the user's request): noisy and missing REMS ground temperatures.
The rover check must skip missing bins and night bins, and must never touch the maps. The scale is
max(observed)/max(model), so a single spike moves it; test_single_spike_moves_scale documents that weakness."""
import numpy as np
import pytest

import dd_oracle
from dd_synth import base_cfg, make_day

LS = float(dd_oracle.ls_deg(800))


def noisy_day(seed=3, sigma_k=1.0, n_missing=5):
    day = make_day(800, 10, 12)
    rng = np.random.default_rng(seed)
    day["ground_temp_k"] = day.ground_temp_k + rng.normal(0, sigma_k, len(day))
    daytime = day.index[(day.ltst_bin_center_hr > 9) & (day.ltst_bin_center_hr < 16)]
    day.loc[rng.choice(daytime, n_missing, replace=False), "ground_temp_k"] = np.nan
    return day


def test_noise_and_missing_bins_leave_maps_unchanged(ms, grid):
    cfg = base_cfg()
    clean, noisy = make_day(800, 10, 12), noisy_day()
    ref = ms.build_reference(grid, clean, LS, 1.5, "test", cfg)
    a = ms.run_sol(800, clean, grid, LS, 1.5, "test", ref, cfg)
    b = ms.run_sol(800, noisy, grid, LS, 1.5, "test", ref, cfg)
    np.testing.assert_array_equal(a["likelihood_mean"], b["likelihood_mean"])
    np.testing.assert_array_equal(a["likelihood_max"], b["likelihood_max"])
    t = b["table"]
    assert len(t) == len(noisy)
    np.testing.assert_array_equal(t.gap_obs_k.isna().to_numpy(), noisy.ground_temp_k.isna().to_numpy())
    assert t.gap_model_k_rover.notna().all() and t.score_rover.notna().all()
    assert np.isfinite(b["rover_scale_k"]) and -1 <= b["rover_corr"] <= 1


def test_missing_bins_are_skipped(ms):
    x = np.array([0.0, 0.0, 1.0, 2.0, 3.0, 2.5, 1.0, 0.0], "float32")
    y = np.array([-8.0, -7.0, 5.0, np.nan, 20.0, 15.0, 2.0, -6.0])
    ok = np.isfinite(y) & (x > 0)
    full, sub = ms.rover_check(x, y), ms.rover_check(x[ok], y[ok])
    assert full["scale_k"] == pytest.approx(sub["scale_k"]) and full["corr"] == pytest.approx(sub["corr"])


def test_rover_check_formula_excludes_night_bins(ms):
    x = np.array([0.0, 1.0, 2.0, 4.0, 3.0, 0.0], "float32")
    y = np.array([99.0, 4.0, 9.0, 20.0, 14.0, 99.0])          # the 99 K bins have no modelled sun: excluded
    got = ms.rover_check(x, y)
    xs, ys = x[1:5].astype(float), y[1:5]
    assert got["scale_k"] == pytest.approx(20.0 / 4.0)
    assert got["corr"] == pytest.approx(np.mean((xs - xs.mean()) * (ys - ys.mean())) / (xs.std() * ys.std()))


def test_single_spike_moves_scale(ms, grid):
    cfg = base_cfg()
    day = make_day(800, 10, 12)
    spiked = day.copy()
    k = int(np.argmax((spiked.ground_temp_k - spiked.air_temp_k).to_numpy()))
    spiked.loc[k, "ground_temp_k"] += 20.0
    ref = ms.build_reference(grid, day, LS, 1.5, "test", cfg)
    a = ms.run_sol(800, day, grid, LS, 1.5, "test", ref, cfg)
    b = ms.run_sol(800, spiked, grid, LS, 1.5, "test", ref, cfg)
    gap = (day.ground_temp_k - day.air_temp_k).max()
    assert b["rover_scale_k"] / a["rover_scale_k"] == pytest.approx((gap + 20.0) / gap, rel=1e-6)
    np.testing.assert_array_equal(a["likelihood_mean"], b["likelihood_mean"])


def test_no_usable_bins_fails(ms):
    x = np.array([0.0, 1.0, 2.0], "float32")
    with pytest.raises(AssertionError):
        ms.rover_check(x, np.array([np.nan, np.nan, np.nan]))
    with pytest.raises(AssertionError):
        ms.rover_check(np.zeros(3, "float32"), np.array([1.0, 2.0, 3.0]))
