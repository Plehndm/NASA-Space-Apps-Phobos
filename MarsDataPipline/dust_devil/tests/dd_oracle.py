"""Oracle for the regression gate: the CURRENT single-sol stage 2 of dust_devil_pipeline.ipynb (commit a8de56f),
with the same arithmetic and dtypes, taking arrays instead of notebook globals. Do not "improve" this file:
its job is to stay equal to the code that produced dust_devil/outputs/_dev/baseline_sol800/."""
import numpy as np

SOL_DAYS = 1.0274912517
LANDING_JD_TT = 2456145.7 + 69.184/86400


def ls_deg(sol):
    jd = LANDING_JD_TT + np.asarray(sol, float) * SOL_DAYS
    dj = jd - 2451545.0
    M = np.radians(19.3871 + 0.52402073 * dj)
    alpha = 270.3863 + 0.52403840 * dj
    pbs = (0.0071*np.cos(np.radians(0.985626*dj/2.2353+49.409)) + 0.0057*np.cos(np.radians(0.985626*dj/2.7543+168.173))
           + 0.0039*np.cos(np.radians(0.985626*dj/1.1177+191.837)) + 0.0037*np.cos(np.radians(0.985626*dj/15.7866+21.736))
           + 0.0021*np.cos(np.radians(0.985626*dj/2.1354+15.704)) + 0.0020*np.cos(np.radians(0.985626*dj/2.4694+95.528))
           + 0.0018*np.cos(np.radians(0.985626*dj/32.8493+49.095)))
    eoc = (10.691 + 3.0e-7*dj)*np.sin(M) + 0.623*np.sin(2*M) + 0.050*np.sin(3*M) + 0.005*np.sin(4*M) + 0.0005*np.sin(5*M) + pbs
    return (alpha + eoc) % 360


def sun_vector(ls, lat_deg, ltst_hr):
    dec = np.arcsin(np.sin(np.radians(25.19)) * np.sin(np.radians(ls)))
    lat, h = np.radians(lat_deg), np.radians((ltst_hr - 12.0) * 15.0)
    sin_alt = np.sin(lat)*np.sin(dec) + np.cos(lat)*np.cos(dec)*np.cos(h)
    cos_alt = np.sqrt(np.clip(1 - sin_alt**2, 0, 1))
    cos_alt_safe = np.where(cos_alt < 1e-6, 1e-6, cos_alt)
    east  = -np.cos(dec) * np.sin(h) / cos_alt_safe
    north = (np.sin(dec) - sin_alt*np.sin(lat)) / (cos_alt_safe*np.cos(lat))
    return east*cos_alt, north*cos_alt, sin_alt


def solar_const(ls):
    nu = np.radians(ls - 251.0)
    r = 1.52368 * (1 - 0.0934**2) / (1 + 0.0934*np.cos(nu))
    return 589.0 * (1.52368 / r)**2


def single_sol(grid, ls, tau, ltst_centers, gap_obs, r, c, slope_scale_deg, day_ltst):
    """Returns (likelihood_mean, likelihood_max, scale) exactly as notebook cells 11-12."""
    slope, aspect, alb, ti, lat = grid["slope"], grid["aspect"], grid["albedo"], grid["ti"], grid["lat"]
    S0 = solar_const(ls)
    sl, asr = np.radians(slope), np.radians(aspect)
    nE, nN, nU = np.sin(sl)*np.sin(asr), np.sin(sl)*np.cos(asr), np.cos(sl)
    flux = np.zeros((len(ltst_centers),) + slope.shape, "float32")
    for k, hr in enumerate(ltst_centers):
        sE, sN, sU = sun_vector(ls, lat, hr)
        cos_i = np.clip(nE*sE + nN*sN + nU*sU, 0, None)
        up = sU > 0.02
        direct = np.where(up, S0 * cos_i * np.exp(-tau / np.clip(sU, 0.05, 1)), 0)
        diffuse = np.where(up, 0.15 * S0 * sU * (1 - np.exp(-tau)) * (1 + nU) / 2, 0)
        flux[k] = direct + diffuse

    gap_proxy = (1 - alb)[None] * flux
    gap_proxy /= np.sqrt(np.clip(ti, 50, None))[None]
    gap_rover_proxy = gap_proxy[:, r, c]
    obs = np.asarray(gap_obs)
    ok = np.isfinite(obs) & (gap_rover_proxy > 0)
    assert ok.any(), "no usable bins at the rover pixel"
    scale = float(np.nanmax(obs[ok]) / np.nanmax(gap_rover_proxy[ok]))
    gap_proxy *= np.float32(scale)
    gap_k = gap_proxy
    flat = np.exp(-(np.nan_to_num(slope, nan=90) / slope_scale_deg)**2).astype("float32")
    gap_ref = np.float32(np.nanpercentile(gap_k, 99.5))
    score_t = gap_k / gap_ref
    np.clip(score_t, 0, 1, out=score_t)
    score_t *= flat[None]

    ltst_centers = np.asarray(ltst_centers)
    dm = (ltst_centers >= day_ltst[0]) & (ltst_centers <= day_ltst[1])
    likelihood_mean = score_t[dm].mean(axis=0)
    likelihood_max = score_t.max(axis=0)
    likelihood_mean[~np.isfinite(ti)] = np.nan
    return likelihood_mean, likelihood_max, scale
