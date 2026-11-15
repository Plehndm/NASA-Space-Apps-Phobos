"""Fixed LTST grid (user decision): maps and the reference are scored on 96 quarter-hour bin centres
(daily mean over the 28 inside 9-16 LTST), independent of which REMS bins a sol has. REMS bins are used only for
the rover check. The sanity run on sols 799-804 showed REMS coverage, not tau, drove the day-to-day changes."""
import numpy as np
import pytest

import dd_oracle
from dd_synth import base_cfg, make_day

LS = float(dd_oracle.ls_deg(800))


def sparse(day, keep_every=3):
    """Drop most bins, including inside the 9-16 window, like a sol with poor REMS coverage."""
    return day.iloc[::keep_every].reset_index(drop=True)


def test_map_grid_constants(ms):
    assert len(ms.MAP_LTST) == 96
    np.testing.assert_allclose(np.diff(ms.MAP_LTST), 0.25)
    assert ms.MAP_LTST[0] == 0.125 and ms.MAP_LTST[-1] == 23.875
    day = ms.MAP_LTST[(ms.MAP_LTST >= 9) & (ms.MAP_LTST <= 16)]
    assert len(day) == 28 and day[0] == 9.125 and day[-1] == 15.875


def test_maps_do_not_depend_on_rems_bins(ms, grid):
    cfg = base_cfg()
    full = make_day(800, 10, 12)
    few = sparse(full)
    ref = ms.build_reference(grid, full, LS, 1.5, "test", cfg)
    a = ms.run_sol(800, full, grid, LS, 1.5, "test", ref, cfg)
    b = ms.run_sol(800, few, grid, LS, 1.5, "test", ref, cfg)
    np.testing.assert_array_equal(a["likelihood_mean"], b["likelihood_mean"])
    np.testing.assert_array_equal(a["likelihood_max"], b["likelihood_max"])
    assert a["frac_above_threshold"] == b["frac_above_threshold"] and a["frac_at_cap"] == b["frac_at_cap"]
    assert len(b["table"]) == len(few) < len(a["table"])
    assert b["n_bins"] == len(few)


def test_reference_does_not_depend_on_rems_bins(ms, grid):
    cfg = base_cfg()
    full = make_day(800, 10, 12)
    r1 = ms.build_reference(grid, full, LS, 1.5, "test", cfg)
    r2 = ms.build_reference(grid, sparse(full), LS, 1.5, "test", cfg)
    assert r1["ref_proxy_p995"] == r2["ref_proxy_p995"] and r1["threshold"] == r2["threshold"]


def test_reference_is_fixed_grid_percentile(ms, grid):
    P = np.stack([ms.bin_proxy(grid, LS, h, 1.5) for h in ms.MAP_LTST])
    ref = ms.build_reference(grid, make_day(800, 10, 12), LS, 1.5, "test", base_cfg())
    assert ref["ref_proxy_p995"] == pytest.approx(float(np.nanpercentile(P, 99.5)), rel=1e-6)


def test_rover_columns_use_rems_bins(ms, grid):
    cfg = base_cfg()
    day = sparse(make_day(800, 10, 12), keep_every=2)
    ref = ms.build_reference(grid, make_day(800, 10, 12), LS, 1.5, "test", cfg)
    res = ms.run_sol(800, day, grid, LS, 1.5, "test", ref, cfg)
    t = res["table"]
    np.testing.assert_array_equal(t.ltst_bin_center_hr.to_numpy(), day.ltst_bin_center_hr.to_numpy())
    p = np.array([ms.bin_proxy(grid, LS, h, 1.5)[10, 12] for h in day.ltst_bin_center_hr], "float32")
    np.testing.assert_allclose(t.gap_model_k_rover.to_numpy(), p * np.float32(res["rover_scale_k"]), rtol=1e-6)
    w = ms.slope_weight(grid["slope"], cfg["SLOPE_SCALE_DEG"])[10, 12]
    np.testing.assert_allclose(t.score_rover.to_numpy(), np.clip(p / np.float32(ref["ref_proxy_p995"]), 0, 1) * w, rtol=1e-6)
