"""Gate 7: loading a cached reference built with a different config fails (maps would not be comparable)."""
import pytest

from dd_synth import base_cfg

REF = dict(ref_sol=800, ref_proxy_p995=1.234567, threshold=0.4321, tau=1.4975, tau_source="Mastcam 880 nm, nearest 1 sol(s) away",
           tau_band="880", slope_scale_deg=10.0, day_ltst=[9.0, 16.0], score_cap=1.0)


def test_roundtrip_with_same_config(ms, tmp_path):
    p = tmp_path / "ref.json"
    ms.save_reference(p, REF)
    got = ms.load_reference(p, base_cfg())
    assert got["ref_proxy_p995"] == REF["ref_proxy_p995"] and got["threshold"] == REF["threshold"]
    assert got["tau"] == REF["tau"] and got["tau_source"] == REF["tau_source"]
    assert list(got["day_ltst"]) == REF["day_ltst"]


@pytest.mark.parametrize("change", [dict(TAU_BAND="440"), dict(SLOPE_SCALE_DEG=12.0), dict(DAY_LTST=(10.0, 16.0)),
                                    dict(SCORE_CAP=None), dict(SCORE_CAP=2.0), dict(REF_SOL=801)])
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
