"""Gate 6: the rover pixel comes from each sol's own REMS position; it asserts if the rover moves within
the sol or falls outside the template."""
import pandas as pd
import pytest

import dd_oracle
from dd_synth import PROC, TRANSFORM, H, W, base_cfg, make_day

LS = float(dd_oracle.ls_deg(800))


def test_pixel_from_each_sols_position(ms):
    assert ms.rover_pixel(make_day(800, 10, 12), TRANSFORM, (H, W)) == (10, 12)
    assert ms.rover_pixel(make_day(801, 3, 27), TRANSFORM, (H, W)) == (3, 27)


def test_run_sol_uses_that_sols_rover(ms, grid):
    cfg = base_cfg()
    day_a, day_b = make_day(800, 10, 12), make_day(801, 3, 27)
    ref = ms.build_reference(grid, day_a, LS, 1.5, "test", cfg)
    ra = ms.run_sol(800, day_a, grid, LS, 1.5, "test", ref, cfg)
    rb = ms.run_sol(801, day_b, grid, LS, 1.5, "test", ref, cfg)
    assert (ra["rover_row"], ra["rover_col"]) == (10, 12)
    assert (rb["rover_row"], rb["rover_col"]) == (3, 27)
    assert rb["dem_minus_rems_m"] == pytest.approx(float(grid["dem"][3, 27]) - float(day_b.elevation_m[0]), abs=1e-3)


def test_rover_moving_within_sol_fails(ms):
    with pytest.raises(AssertionError):
        ms.rover_pixel(make_day(800, 10, 12, move=True), TRANSFORM, (H, W))


@pytest.mark.parametrize("dlat_px, dlon_px", [(0, W + 3), (-3, 0), (H + 2, 0), (-0.3, 5)])
def test_rover_outside_template_fails(ms, dlat_px, dlon_px):
    """(-0.3, 5) is 0.3 pixel north of the north edge: int() truncation would wrongly map it to row 0."""
    a, _, c, _, e, f = TRANSFORM
    day = make_day(800, 0, 0)
    day["latitude_deg"] = f + dlat_px * e
    day["longitude_deg_e"] = c + (dlon_px + 0.5) * a
    with pytest.raises(AssertionError):
        ms.rover_pixel(day, TRANSFORM, (H, W))


@pytest.mark.realdata
def test_real_sol800_rover_pixel(ms):
    import json
    meta = json.loads((PROC / "gale_dust_devil_meta.json").read_text())
    rems = pd.read_csv(PROC / "rems_binned_all_sols.csv")
    day = rems[rems.sol == 800].sort_values("bin").reset_index(drop=True)
    assert ms.rover_pixel(day, tuple(meta["template_transform"]), tuple(meta["template_shape"])) == (304, 372)
