"""Gate 2: the shared reference makes sols comparable. The same synthetic sol with a higher tau scores
pointwise lower or equal, and fewer pixels clear the fixed threshold.

Why the synthetic slopes stop at 20 deg: the model's diffuse term 0.15*S0*mu*(1-exp(-tau)) GROWS with tau.
Where the direct beam is weak (shaded steep slopes, low sun) total flux can rise with tau, so "pointwise <=" is
not a property of the model everywhere. On gentle slopes over 9-16 LTST the direct loss dominates."""
import numpy as np
import pytest

import dd_oracle
from dd_synth import base_cfg, make_day

LS = float(dd_oracle.ls_deg(800))


def test_higher_tau_scores_lower_with_shared_reference(ms, grid):
    cfg = base_cfg()
    day = make_day(800, 10, 12)
    ref = ms.build_reference(grid, day, LS, 0.5, "test", cfg)
    lo = ms.run_sol(800, day, grid, LS, 0.5, "test", ref, cfg)
    hi = ms.run_sol(800, day, grid, LS, 1.5, "test", ref, cfg)
    np.testing.assert_array_equal(np.isnan(hi["likelihood_mean"]), np.isnan(lo["likelihood_mean"]))
    ok = np.isfinite(lo["likelihood_mean"])
    assert np.all(hi["likelihood_mean"][ok] <= lo["likelihood_mean"][ok] + 1e-7), "a pixel scores higher under more dust"
    assert hi["frac_above_threshold"] < lo["frac_above_threshold"], (hi["frac_above_threshold"], lo["frac_above_threshold"])


def test_clearer_sol_than_reference_saturates_and_is_reported(ms, grid):
    day = make_day(800, 10, 12)
    capped = base_cfg(SCORE_CAP=1.0)
    ref = ms.build_reference(grid, day, LS, 1.5, "test", capped)
    clear = ms.run_sol(800, day, grid, LS, 0.3, "test", ref, capped)
    assert clear["frac_at_cap"] > 0, "a sol clearer than the reference should hit the cap somewhere"
    assert np.nanmax(clear["likelihood_max"]) <= 1.0

    uncapped = base_cfg(SCORE_CAP=None)
    ref_u = ms.build_reference(grid, day, LS, 1.5, "test", uncapped)
    clear_u = ms.run_sol(800, day, grid, LS, 0.3, "test", ref_u, uncapped)
    assert np.nanmax(clear_u["likelihood_max"]) > 1.0, "SCORE_CAP=None must not clip"
    assert clear_u["frac_at_cap"] == 0


def test_threshold_is_not_recomputed_per_sol(ms, grid):
    cfg = base_cfg()
    day = make_day(800, 10, 12)
    ref = ms.build_reference(grid, day, LS, 0.5, "test", cfg)
    hi = ms.run_sol(800, day, grid, LS, 1.5, "test", ref, cfg)
    m = hi["likelihood_mean"]
    assert hi["frac_above_threshold"] == pytest.approx(float(np.mean(m[np.isfinite(m)] >= ref["threshold"])))
