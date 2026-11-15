"""Gate 4: per-bin accumulation equals the full (bins x H x W) computation, for the daily mean and max,
and the reference percentile equals the percentile over the full array."""
import numpy as np
import pytest

import dd_oracle
from dd_synth import base_cfg, make_day

LS = float(dd_oracle.ls_deg(800))


def full_array(ms, grid, ltst, tau, ref_proxy, cfg):
    P = np.stack([ms.bin_proxy(grid, LS, h, tau) for h in ltst])
    S = P / ref_proxy
    S = np.clip(S, 0, cfg["SCORE_CAP"]) if cfg["SCORE_CAP"] is not None else np.clip(S, 0, None)
    S = S * ms.slope_weight(grid["slope"], cfg["SLOPE_SCALE_DEG"])[None]
    dm = (ltst >= cfg["DAY_LTST"][0]) & (ltst <= cfg["DAY_LTST"][1])
    mean = S[dm].mean(axis=0)
    mean[~np.isfinite(grid["ti"])] = np.nan
    return P, mean, S.max(axis=0)


@pytest.mark.parametrize("cap", [1.0, None])
def test_accumulated_equals_full_array(ms, grid, cap):
    cfg = base_cfg(SCORE_CAP=cap)
    ltst = make_day(800, 10, 12).ltst_bin_center_hr.to_numpy()
    ref_proxy = ms.reference_proxy(grid, LS, ltst, 1.5) * 0.8          # below p99.5 so the cap is exercised
    P, exp_mean, exp_max = full_array(ms, grid, ltst, 1.5, ref_proxy, cfg)
    got = ms.score_maps(grid, LS, ltst, 1.5, ref_proxy, cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"], cap)
    np.testing.assert_allclose(got["likelihood_mean"], exp_mean, atol=1e-6, rtol=0, equal_nan=True)
    np.testing.assert_allclose(got["likelihood_max"], exp_max, atol=1e-6, rtol=0, equal_nan=True)


def test_reference_proxy_is_full_array_percentile(ms, grid):
    ltst = make_day(800, 10, 12).ltst_bin_center_hr.to_numpy()
    P = np.stack([ms.bin_proxy(grid, LS, h, 1.5) for h in ltst])
    assert ms.reference_proxy(grid, LS, ltst, 1.5) == pytest.approx(float(np.nanpercentile(P, 99.5)), rel=1e-6)


def test_bin_proxy_is_unitless_formula(ms, grid):
    """proxy = (1 - albedo) * flux / sqrt(clip(ti, 50)), with the notebook's flux; no kelvin scale."""
    hr = 12.12
    S0 = dd_oracle.solar_const(LS)
    sl, asr = np.radians(grid["slope"]), np.radians(grid["aspect"])
    nE, nN, nU = np.sin(sl)*np.sin(asr), np.sin(sl)*np.cos(asr), np.cos(sl)
    sE, sN, sU = dd_oracle.sun_vector(LS, grid["lat"], hr)
    cos_i = np.clip(nE*sE + nN*sN + nU*sU, 0, None)
    up = sU > 0.02
    flux = (np.where(up, S0 * cos_i * np.exp(-1.5 / np.clip(sU, 0.05, 1)), 0)
            + np.where(up, 0.15 * S0 * sU * (1 - np.exp(-1.5)) * (1 + nU) / 2, 0)).astype("float32")
    exp = (1 - grid["albedo"]) * flux / np.sqrt(np.clip(grid["ti"], 50, None))
    got = ms.bin_proxy(grid, LS, hr, 1.5)
    assert got.dtype == np.float32 and got.shape == grid["shape"]
    np.testing.assert_allclose(got, exp, rtol=1e-6, equal_nan=True)
