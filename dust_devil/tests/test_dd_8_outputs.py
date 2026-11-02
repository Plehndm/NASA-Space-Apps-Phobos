"""Gate 8: outputs. One npz / tif / rover table / overlay set per sol, named by sol; GeoTIFF grid equals the
template; GIF frame count equals the number of sols; summary CSV has one row per sol. Runs end to end on synthetic
inputs (sols 800 and 801 get Mastcam tau, sol 900 falls back to the climatology)."""
import numpy as np
import pandas as pd
import pytest

from dd_synth import H, W, TRANSFORM, multisol_cfg

SOLS = {800: (10, 12), 801: (11, 14), 900: (3, 27)}
SUMMARY_COLS = ["sol", "ls_deg", "tau", "tau_source", "n_bins", "frac_above_threshold", "frac_at_cap", "rover_corr",
                "rover_scale_k", "dem_minus_rems_m", "frac_low", "frac_moderate", "frac_high"]
NPZ_KEYS = {"likelihood_mean", "likelihood_max", "sol", "ls_deg", "tau", "tau_source", "ref_sol", "ref_proxy", "threshold",
            "rover_row", "rover_col"}
TABLE_COLS = ["sol", "bin", "ltst_bin_center_hr", "air_temp_k", "ground_temp_k", "pressure_pa", "gap_obs_k", "ls_deg", "tau",
              "gap_model_k_rover", "score_rover"]


@pytest.fixture
def run(ms, grid, tmp_path):
    cfg = multisol_cfg(tmp_path, SOLS, grid)
    summary = ms.run_multisol(cfg)
    return cfg, summary


def test_per_sol_files(run):
    cfg, _ = run
    out = cfg["OUT_DIR"]
    for s in SOLS:
        for name in (f"gale_dust_devil_likelihood_sol{s}.npz", f"gale_dust_devil_likelihood_sol{s}.tif", f"rover_sol{s}_table.csv",
                     f"likelihood_overlay_sol{s}.png", f"likelihood_overlay_sol{s}_imagery.png", f"likelihood_overlay_sol{s}_hillshade.png"):
            assert (out / name).exists(), f"missing {name}"
    assert cfg["REFERENCE_JSON"].exists()


def test_npz_contents(run):
    cfg, _ = run
    for s, (r, c) in SOLS.items():
        z = np.load(cfg["OUT_DIR"] / f"gale_dust_devil_likelihood_sol{s}.npz")
        assert NPZ_KEYS <= set(z.files), NPZ_KEYS - set(z.files)
        assert int(z["sol"]) == s and int(z["ref_sol"]) == 800 and (int(z["rover_row"]), int(z["rover_col"])) == (r, c)
        assert z["likelihood_mean"].shape == (H, W) and z["likelihood_mean"].dtype == np.float32
    z900 = np.load(cfg["OUT_DIR"] / "gale_dust_devil_likelihood_sol900.npz")
    assert str(z900["tau_source"]) == "climatology Ls±10, n=6 sols", str(z900["tau_source"])


def test_geotiff_matches_template(run):
    import rasterio
    cfg, _ = run
    with rasterio.open(cfg["TEMPLATE_TIF"]) as t:
        t_tf, t_crs, t_shape = t.transform, t.crs, (t.height, t.width)
    for s in SOLS:
        with rasterio.open(cfg["OUT_DIR"] / f"gale_dust_devil_likelihood_sol{s}.tif") as d:
            assert (d.height, d.width) == t_shape and d.count == 2
            assert d.transform == t_tf and d.crs == t_crs
            assert all(desc and "800" in desc and "ref" in desc.lower() for desc in d.descriptions), d.descriptions
            z = np.load(cfg["OUT_DIR"] / f"gale_dust_devil_likelihood_sol{s}.npz")
            np.testing.assert_array_equal(d.read(1), z["likelihood_mean"])
            np.testing.assert_array_equal(d.read(2), z["likelihood_max"])


def test_rover_tables(run):
    cfg, _ = run
    for s in SOLS:
        t = pd.read_csv(cfg["OUT_DIR"] / f"rover_sol{s}_table.csv")
        assert set(TABLE_COLS) <= set(t.columns), set(TABLE_COLS) - set(t.columns)
        assert (t.sol == s).all() and len(t) > 0


def test_summary_csv(run):
    cfg, summary = run
    csv = pd.read_csv(cfg["OUT_DIR"] / "dust_devil_multisol_summary_800-900.csv")   # named by sol range, like the GIF (Nov 2)
    assert not (cfg["OUT_DIR"] / "dust_devil_multisol_summary.csv").exists()
    assert list(csv.columns) == SUMMARY_COLS
    assert csv.sol.tolist() == sorted(SOLS) and len(csv) == len(SOLS)
    assert summary.sol.tolist() == csv.sol.tolist()
    src = csv.set_index("sol").tau_source
    assert src[800].startswith("Mastcam") and src[801].startswith("Mastcam")
    assert src[900] == "climatology Ls±10, n=6 sols"
    assert csv.frac_above_threshold.between(0, 1).all() and csv.frac_at_cap.between(0, 1).all()


def test_gif(run):
    from PIL import Image
    cfg, _ = run
    gif = cfg["OUT_DIR"] / "dust_devil_multisol_800-900.gif"
    assert gif.exists()
    with Image.open(gif) as im:
        assert im.n_frames == len(SOLS)
        assert abs(im.width - cfg["GIF_W"]) <= 2
        assert im.info.get("loop") == 0 and im.info.get("duration") == cfg["GIF_MS"]
