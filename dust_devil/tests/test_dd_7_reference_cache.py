"""Gate 7: loading a cached reference built with a different config fails (maps would not be comparable).
The cache also records LIKELY_TOP_PCT (the threshold depends on it) and the LTST grid the reference was scored on
(user decision Nov 2), so a reference from the old per-sol REMS-bin scheme cannot be loaded by mistake."""
import numpy as np
import pytest

from dd_synth import base_cfg

REF = dict(ref_sol=800, ref_proxy_p995=1.234567, threshold=0.4321, tau=1.4975, tau_source="Mastcam 880 nm, nearest 1 sol(s) away",
           tau_band="880", slope_scale_deg=10.0, day_ltst=[9.0, 16.0], score_cap=1.0, likely_top_pct=10.0,
           map_ltst=(np.arange(96) * 0.25 + 0.125).tolist(), class_top_pcts=[50.0, 30.0, 10.0],
           class_cuts=[0.2, 0.3, 0.4321])


def test_roundtrip_with_same_config(ms, tmp_path):
    p = tmp_path / "ref.json"
    ms.save_reference(p, REF)
    got = ms.load_reference(p, base_cfg())
    assert got["ref_proxy_p995"] == REF["ref_proxy_p995"] and got["threshold"] == REF["threshold"]
    assert got["tau"] == REF["tau"] and got["tau_source"] == REF["tau_source"]
    assert list(got["day_ltst"]) == REF["day_ltst"]
    assert got["likely_top_pct"] == REF["likely_top_pct"] and got["map_ltst"] == REF["map_ltst"]


@pytest.mark.parametrize("change", [dict(TAU_BAND="440"), dict(SLOPE_SCALE_DEG=12.0), dict(DAY_LTST=(10.0, 16.0)),
                                    dict(SCORE_CAP=None), dict(SCORE_CAP=2.0), dict(REF_SOL=801),
                                    dict(LIKELY_TOP_PCT=5)])
def test_mismatched_config_fails(ms, tmp_path, change):
    p = tmp_path / "ref.json"
    ms.save_reference(p, REF)
    with pytest.raises(AssertionError):
        ms.load_reference(p, base_cfg(**change))


def test_cached_uncapped_reference_loads_with_uncapped_config(ms, tmp_path):
    p = tmp_path / "ref.json"
    ms.save_reference(p, dict(REF, score_cap=None))
    assert ms.load_reference(p, base_cfg(SCORE_CAP=None))["score_cap"] is None
    with pytest.raises(AssertionError):
        ms.load_reference(p, base_cfg(SCORE_CAP=1.0))


@pytest.mark.parametrize("map_ltst", [None, (np.arange(48) * 0.5 + 0.25).tolist()],
                         ids=["old_scheme_no_grid_recorded", "different_grid"])
def test_reference_from_another_ltst_grid_fails(ms, tmp_path, map_ltst):
    ref = {k: v for k, v in REF.items() if k != "map_ltst"}
    if map_ltst is not None:
        ref["map_ltst"] = map_ltst
    p = tmp_path / "ref.json"
    ms.save_reference(p, ref)
    with pytest.raises(AssertionError):
        ms.load_reference(p, base_cfg())


def test_built_reference_records_grid_and_top_pct(ms, grid):
    from dd_synth import make_day
    cfg = base_cfg()
    ref = ms.build_reference(grid, make_day(800, 5, 7), 150.0, 1.5, "test", cfg)
    assert ref["likely_top_pct"] == 10.0 and ref["map_ltst"] == REF["map_ltst"]
