"""Gate 2: forcing checked against the training table (CLAUDE.md, Verification gates)."""
import numpy as np
import pytest

import paths
import thermal1d as t

FLUX_MIN_WM2 = 20.0   # flux checks only where the table flux is above this


@pytest.fixture(scope="module")
def table():
    return t.load_rems_table(paths.DATA_DIR / "gale_rems_training.csv")


@pytest.fixture(scope="module")
def computed(table):
    """Sun elevation and direct flux per row, evaluated one sol at a time at the table's LTST."""
    n = len(table["sol"])
    elev, flat, tilted = np.empty(n), np.empty(n), np.empty(n)
    for sol in np.unique(table["sol"]):
        m = table["sol"] == sol
        first = np.flatnonzero(m)[0]
        one = lambda key: table[key][first:first + 1]
        ltst = table["ltst_bin_center_hr"][m]
        mu0, _ = t.sun_position(t.lat_from_row(one("row")), one("ls_deg"), ltst)
        f, ft, _ = t.shortwave(t.lat_from_row(one("row")), one("ls_deg"), one("tau"),
                               one("slope_deg"), one("aspect_deg"), ltst)
        elev[m] = np.degrees(np.arcsin(np.clip(mu0[0], -1.0, 1.0)))
        flat[m], tilted[m] = f[0], ft[0]
    return {"elev": elev, "flat": flat, "tilted": tilted}


def ratio_pattern(table, ratio, use):
    """Print the computed / table ratio by 30-degree Ls bin and by LTST hour."""
    ls_bin = (table["ls_deg"][use] // 30 * 30).astype(int)
    hour = np.floor(table["ltst_bin_center_hr"][use]).astype(int)
    for name, key in (("Ls bin", ls_bin), ("LTST hour", hour)):
        print(f"  ratio by {name}:")
        for k in np.unique(key):
            r = ratio[use][key == k]
            print(f"    {k:4d}: n={len(r):5d} median {np.median(r):.5f} min {r.min():.5f} max {r.max():.5f}")


def test_gate2_sun_elevation(table, computed):
    diff = computed["elev"] - table["sun_elev_deg"]
    print(f"\nsun elevation: max |diff| {np.abs(diff).max():.4f} deg over {len(diff)} rows")
    assert np.abs(diff).max() < 0.5


@pytest.mark.parametrize("kind", ["flat", "tilted"])
def test_gate2_direct_flux(table, computed, kind):
    ref = table[f"flux_{kind}_wm2"]
    use = ref > FLUX_MIN_WM2
    ratio = np.full(len(ref), np.nan)
    ratio[use] = computed[kind][use] / ref[use]
    err = np.abs(ratio[use] - 1.0)
    print(f"\n{kind} direct flux: {use.sum()} rows above {FLUX_MIN_WM2} W m^-2, "
          f"ratio median {np.median(ratio[use]):.6f}, max |ratio - 1| {err.max():.6f}")
    if err.max() >= 0.01:
        ratio_pattern(table, ratio, use)
    assert err.max() < 0.01
