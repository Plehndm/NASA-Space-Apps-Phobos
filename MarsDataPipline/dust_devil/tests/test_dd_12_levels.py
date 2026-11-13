"""Gate 12: three fixed levels (user decision). Cuts at the top CLASS_TOP_PCTS (50 / 30 / 10) % of the reference
sol's daily-mean map, the same cut values for every sol; the high cut is the existing threshold. Overlays shade
low / moderate / high in LEVEL_COLOURS."""
import json

import numpy as np
import pandas as pd
import pytest

from dd_synth import H, W, base_cfg, make_day, multisol_cfg

LS, TAU = 150.0, 1.5


def _ref_and_mean(ms, grid, cfg):
    ref = ms.build_reference(grid, make_day(800, 5, 7), LS, TAU, "test", cfg)
    m = ms.score_maps(grid, LS, ms.MAP_LTST, TAU, ref["ref_proxy_p995"], cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"], cfg["SCORE_CAP"])
    return ref, m["likelihood_mean"]


def test_cuts_are_reference_percentiles(ms, grid):
    ref, mean = _ref_and_mean(ms, grid, base_cfg())
    assert ref["class_top_pcts"] == [50.0, 30.0, 10.0]
    assert ref["class_cuts"] == [float(np.nanpercentile(mean, q)) for q in (50, 70, 90)]
    assert ref["class_cuts"][-1] == ref["threshold"], "the high cut must be the existing threshold, exactly"
    assert ref["class_cuts"] == sorted(ref["class_cuts"])


@pytest.mark.parametrize("pcts", [(30, 50, 10), (50, 30, 20), (50, 50, 10), (50, 30)])
def test_bad_class_top_pcts_fail(ms, grid, pcts):
    """Must be strictly decreasing, three levels, and end with LIKELY_TOP_PCT (10)."""
    with pytest.raises(AssertionError):
        ms.build_reference(grid, make_day(800, 5, 7), LS, TAU, "test", base_cfg(CLASS_TOP_PCTS=pcts))


def test_cache_with_other_levels_fails(ms, grid, tmp_path):
    ref, _ = _ref_and_mean(ms, grid, base_cfg())
    p = tmp_path / "ref.json"
    ms.save_reference(p, ref)
    assert ms.load_reference(p, base_cfg())["class_cuts"] == ref["class_cuts"]
    with pytest.raises(AssertionError):
        ms.load_reference(p, base_cfg(CLASS_TOP_PCTS=(60, 30, 10)))


def test_score_levels_boundaries_and_nan(ms):
    """A pixel is in a level when its score is >= that level's cut. The real cuts are percentiles of a float32 map, so
    they are float32 values; the test uses float32-representable cuts too, so the boundaries are exact."""
    cuts = [float(np.float32(x)) for x in (0.348, 0.474, 0.59)]
    below = lambda x: float(np.nextafter(np.float32(x), np.float32(0)))
    mean = np.array([[np.nan, 0.1, below(cuts[0]), cuts[0], below(cuts[1]), cuts[1], below(cuts[2]), cuts[2], 0.95]], "float32")
    lv = ms.score_levels(mean, cuts)
    assert lv.dtype == np.uint8 and lv.shape == mean.shape
    assert lv[0].tolist() == [0, 0, 0, 1, 1, 2, 2, 3, 3]


def test_level_shares(ms):
    cuts = [0.3, 0.5, 0.7]
    mean = np.array([np.nan, 0.1, 0.2, 0.35, 0.45, 0.55, 0.75, 0.8, 0.9, 0.99, 0.0], "float32")
    sh = ms.level_shares(mean, cuts)
    assert sh == dict(frac_low=0.2, frac_moderate=0.1, frac_high=0.4)


@pytest.fixture
def run(ms, grid, tmp_path):
    cfg = multisol_cfg(tmp_path, {800: (10, 12), 801: (11, 14)}, grid)
    return cfg, ms.run_multisol(cfg)


def test_summary_and_npz_levels(run):
    cfg, summary = run
    csv = pd.read_csv(cfg["OUT_DIR"] / "dust_devil_heating_index_summary_800-801.csv").set_index("sol")
    assert {"frac_low", "frac_moderate", "frac_high"} <= set(csv.columns)
    assert np.allclose(csv.frac_high, csv.frac_above_threshold)
    assert (csv[["frac_low", "frac_moderate", "frac_high"]].sum(axis=1) <= 1 + 1e-12).all()
    # the reference sol has 20 / 20 / 10 % by construction (ties on a 718-pixel grid allow a little slack)
    assert abs(csv.frac_low[800] - 0.2) < 0.01 and abs(csv.frac_moderate[800] - 0.2) < 0.01 and abs(csv.frac_high[800] - 0.1) < 0.01
    ref = json.loads(cfg["REFERENCE_JSON"].read_text(encoding="utf-8"))
    for s in (800, 801):
        z = np.load(cfg["OUT_DIR"] / f"gale_dust_devil_heating_index_sol{s}.npz")
        assert z["class_cuts"].tolist() == ref["class_cuts"]


def test_panel_blends_each_level_colour(ms, grid, tmp_path):
    cfg = multisol_cfg(tmp_path, {800: (10, 12)}, grid)
    pv = ms.Previews(cfg, (H, W), cfg_transform(cfg))
    levels = np.zeros((H, W), "uint8")
    levels[2, 2], levels[2, 5], levels[2, 8] = 1, 2, 3
    colours = [tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) for h in cfg["LEVEL_COLOURS"]]
    im = np.asarray(pv.panel("hillshade", W, levels, pv.west - 1.0, pv.north + 1.0, colours, cfg["ALPHA"]))   # rover ring off-canvas
    base = pv.base("hillshade", W)
    a = cfg["ALPHA"]
    for (r, c), k in (((2, 2), 1), ((2, 5), 2), ((2, 8), 3)):
        want = np.round(base[r, c] * (1 - a) + np.array(colours[k - 1], "float32") * a).astype("uint8")
        assert im[r, c].tolist() == want.tolist(), (r, c, k)
    assert im[10, 10].tolist() == np.round(base[10, 10]).astype("uint8").tolist(), "level 0 must stay unshaded"


def cfg_transform(cfg):
    return tuple(json.loads(cfg["META_JSON"].read_text())["template_transform"])
