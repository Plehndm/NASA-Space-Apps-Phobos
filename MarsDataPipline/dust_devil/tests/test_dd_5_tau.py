"""Gate 5: tau. Mastcam interpolation within 5 sols matches np.interp; climatology only when no measurement
is within 5 sols; storm sols excluded; the Ls window wraps at 360/0; fewer than 5 sols in the window fails."""
import numpy as np
import pandas as pd
import pytest

GAP, WIN, STORM, MIN_N = 5, 10.0, (2082, 2133), 5


def table(rows):
    t = pd.DataFrame(rows, columns=["sol", "tau", "ls_deg"])
    t["n"], t["tau_min"], t["tau_max"], t["band"] = 1, t.tau, t.tau, "880"
    return t.sort_values("sol").reset_index(drop=True)


MAST = [(796, 1.471, 226.0), (799, 1.517, 227.8), (801, 1.478, 229.0), (803, 1.442, 230.2), (804, 1.468, 230.8), (812, 0.90, 235.6)]


def call(ms, sol, ls, t):
    return ms.tau_for_sol(sol, ls, t, GAP, WIN, STORM, MIN_N)


def test_interpolation_matches_np_interp(ms):
    t = table(MAST)
    tau, src = call(ms, 800, 228.2, t)
    assert tau == pytest.approx(float(np.interp(800, t.sol, t.tau)), abs=1e-12)
    assert src.startswith("Mastcam"), src


def test_interpolation_uses_only_sols_within_gap(ms):
    t = table(MAST)
    near = t[(t.sol - 806).abs() <= GAP]                       # 801, 803, 804; sol 812 is 6 sols away
    tau, _ = call(ms, 806, 232.0, t)
    assert tau == pytest.approx(float(np.interp(806, near.sol, near.tau)), abs=1e-12)
    assert tau != pytest.approx(float(np.interp(806, t.sol, t.tau)), abs=1e-6)


CLIM = [(3000 + k, 0.60 + 0.02 * k, 100.0 + d) for k, d in enumerate([-8, -4, 0, 3, 6, 9])]   # 6 sols around Ls 100


def test_measurement_exactly_at_gap_is_mastcam(ms):
    t = table(CLIM + [(1505, 0.75, 101.0)])
    tau, src = call(ms, 1500, 100.0, t)
    assert src.startswith("Mastcam") and tau == pytest.approx(0.75)


def test_climatology_only_when_nothing_within_gap(ms):
    t = table(CLIM + [(1506, 0.75, 101.0)])
    tau, src = call(ms, 1500, 100.0, t)
    in_win = [r[1] for r in CLIM + [(1506, 0.75, 101.0)]]       # all 7 rows are within Ls +-10 of 100
    assert tau == pytest.approx(float(np.median(in_win)))
    assert src == "climatology Ls±10, n=7 sols", src


def test_storm_sols_are_excluded(ms):
    storm = [(2082, 8.6, 101.0), (2100, 7.0, 99.0), (2133, 5.0, 100.0)]
    tau, src = call(ms, 1500, 100.0, table(CLIM + storm))
    assert tau == pytest.approx(float(np.median([r[1] for r in CLIM])))
    assert src == "climatology Ls±10, n=6 sols", src


def test_ls_window_wraps(ms):
    rows = [(3000, 0.50, 3.0), (3001, 0.52, 3.5), (3002, 0.54, 5.0), (3003, 0.56, 350.0), (3004, 0.58, 346.0),
            (3005, 9.00, 340.0), (3006, 9.00, 10.0)]           # last two are 15 deg away: outside
    tau, src = call(ms, 1500, 355.0, table(rows))
    assert tau == pytest.approx(0.54)
    assert src == "climatology Ls±10, n=5 sols", src


def test_too_few_sols_in_window_fails_and_names_the_sol(ms):
    rows = [(3000 + k, 0.6, 100.0 + k) for k in range(4)] + [(3010, 0.6, 140.0)]
    with pytest.raises(AssertionError, match="1500"):
        call(ms, 1500, 100.0, table(rows))
