"""Gate 3: the rover's proxy-to-kelvin scale does not touch the maps. Changing the observed temperatures
changes the scale (and the rover table's kelvin columns) and leaves both maps bit-identical."""
import numpy as np
import pytest

import dd_oracle
from dd_synth import base_cfg, make_day

LS = float(dd_oracle.ls_deg(800))


def test_observed_temperatures_change_scale_not_maps(ms, grid):
    cfg = base_cfg()
    day1 = make_day(800, 10, 12, gap_amp_k=25.0)
    day2 = make_day(800, 10, 12, gap_amp_k=50.0)
    ref = ms.build_reference(grid, day1, LS, 1.5, "test", cfg)
    r1 = ms.run_sol(800, day1, grid, LS, 1.5, "test", ref, cfg)
    r2 = ms.run_sol(800, day2, grid, LS, 1.5, "test", ref, cfg)
    assert r2["rover_scale_k"] != pytest.approx(r1["rover_scale_k"], rel=1e-3), "scale should follow the observed gap"
    np.testing.assert_array_equal(r1["likelihood_mean"], r2["likelihood_mean"])
    np.testing.assert_array_equal(r1["likelihood_max"], r2["likelihood_max"])
    np.testing.assert_array_equal(r1["table"].score_rover, r2["table"].score_rover)
    ratio = r2["table"].gap_model_k_rover.max() / r1["table"].gap_model_k_rover.max()
    assert ratio == pytest.approx(r2["rover_scale_k"] / r1["rover_scale_k"], rel=1e-5)


def test_reference_does_not_depend_on_observed_temperatures(ms, grid):
    cfg = base_cfg()
    ref1 = ms.build_reference(grid, make_day(800, 10, 12, gap_amp_k=25.0), LS, 1.5, "test", cfg)
    ref2 = ms.build_reference(grid, make_day(800, 10, 12, gap_amp_k=50.0), LS, 1.5, "test", cfg)
    assert ref1["ref_proxy_p995"] == ref2["ref_proxy_p995"]
    assert ref1["threshold"] == ref2["threshold"]
