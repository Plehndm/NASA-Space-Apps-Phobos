"""Gate 11: the reference sol is a setting (user decision Nov 2: REF_SOL = 1850; sol 800 stays as a dusty-season example).
With REF_SOL = 801 on synthetic inputs, the reference, threshold, npz, GeoTIFF band descriptions and file names all follow
sol 801, and sol 800 is scored against it like any other sol."""
import json

import numpy as np
import pandas as pd
import rasterio

from dd_synth import multisol_cfg

SOLS = {800: (10, 12), 801: (11, 14)}


def test_reference_follows_ref_sol(ms, grid, tmp_path):
    cfg = multisol_cfg(tmp_path, SOLS, grid, REF_SOL=801)
    cfg["REFERENCE_JSON"] = cfg["OUT_DIR"] / "dust_devil_reference_sol801.json"
    summary = ms.run_multisol(cfg).set_index("sol")
    out = cfg["OUT_DIR"]

    ref = json.loads(cfg["REFERENCE_JSON"].read_text(encoding="utf-8"))
    assert ref["ref_sol"] == 801
    z801 = np.load(out / "gale_dust_devil_heating_index_sol801.npz")
    assert ref["threshold"] == float(np.nanpercentile(z801["likelihood_mean"], 90)), "threshold is not the top 10% of sol 801"
    assert abs(summary.frac_above_threshold[801] - 0.10) < 0.01, "the reference sol should have about 10% above its own threshold"

    for s in SOLS:
        z = np.load(out / f"gale_dust_devil_heating_index_sol{s}.npz")
        assert int(z["ref_sol"]) == 801 and float(z["threshold"]) == ref["threshold"]
        with rasterio.open(out / f"gale_dust_devil_heating_index_sol{s}.tif") as t:
            assert all("ref_sol801" in d for d in t.descriptions), t.descriptions
    assert pd.read_csv(out / "dust_devil_heating_index_summary_800-801.csv").sol.tolist() == [800, 801]


def test_ref_sol_need_not_be_in_sols(ms, grid, tmp_path):
    """The reference sol only needs REMS rows; the run itself may leave it out (as the dusty-season run does)."""
    cfg = multisol_cfg(tmp_path, SOLS, grid, REF_SOL=801, SOLS=[800])
    summary = ms.run_multisol(cfg)
    assert summary.sol.tolist() == [800]
    assert json.loads(cfg["REFERENCE_JSON"].read_text(encoding="utf-8"))["ref_sol"] == 801
