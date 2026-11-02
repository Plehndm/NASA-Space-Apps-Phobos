"""Multi-sol dust devil layer with a shared reference sol (REF_SOL; dev module; final code goes into the notebook).

Conventions
- `grid` is a dict: shape (H, W), transform (a, b, c, d, e, f) as in meta.json, and float arrays of shape (H, W):
  lat (deg, pixel centre, from the transform), slope (deg), aspect (deg, downslope azimuth clockwise from N),
  albedo (albedo_mean), ti (THEMIS TIU, NaN where missing), dem (m). Missing pixels are NaN.
- `day` is one sol's rows of rems_binned_all_sols.csv, sorted by bin.
- `cfg` uses the notebook's config names (upper case), e.g. SLOPE_SCALE_DEG, DAY_LTST, SCORE_CAP, REF_SOL, TAU_BAND.
- The score is a heuristic, not a probability.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------- solar geometry (copied unchanged from the current notebook) ----------------
SOL_DAYS = 1.0274912517
LANDING_JD_TT = 2456145.7 + 69.184/86400     # MSL landing 2012-08-06, sol 0 (approx.)


def ls_deg(sol):
    """Ls (deg) of a sol, Allison & McEwen 2000 style, as in the current notebook."""
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
    """Unit vector to the Sun in local (East, North, Up). lat_deg may be an array."""
    dec = np.arcsin(np.sin(np.radians(25.19)) * np.sin(np.radians(ls)))
    lat, h = np.radians(lat_deg), np.radians((ltst_hr - 12.0) * 15.0)
    sin_alt = np.sin(lat)*np.sin(dec) + np.cos(lat)*np.cos(dec)*np.cos(h)
    cos_alt = np.sqrt(np.clip(1 - sin_alt**2, 0, 1))
    cos_alt_safe = np.where(cos_alt < 1e-6, 1e-6, cos_alt)
    east  = -np.cos(dec) * np.sin(h) / cos_alt_safe
    north = (np.sin(dec) - sin_alt*np.sin(lat)) / (cos_alt_safe*np.cos(lat))
    return east*cos_alt, north*cos_alt, sin_alt


def solar_const(ls):
    nu = np.radians(ls - 251.0)                   # perihelion near Ls 251
    r = 1.52368 * (1 - 0.0934**2) / (1 + 0.0934*np.cos(nu))
    return 589.0 * (1.52368 / r)**2               # W/m2 at Mars distance


# Fixed LTST grid for the maps and the reference (user decision Oct 30): the 96 quarter-hour REMS bin centres.
# The daily mean uses the 28 inside DAY_LTST (9.125..15.875); the daily max and the reference percentile use all 96.
# Each sol's own REMS bins are used only for the rover check, so REMS coverage gaps cannot change the maps.
MAP_LTST = np.arange(96) * 0.25 + 0.125


def want(flag, output):
    assert flag in (True, False, "auto"), f"flag must be True, False or 'auto', got {flag!r}"
    return (not Path(output).exists()) if flag == "auto" else flag


# ---------------- inputs ----------------

def load_grid(features_csv, meta_json):
    """Read the stage-1 feature table onto the template grid (see `grid` above). meta.json gives only shape and transform."""
    meta = json.loads(Path(meta_json).read_text())
    shape = tuple(meta["template_shape"])
    transform = tuple(meta["template_transform"])
    a, b, c, d, e, f = transform
    assert b == 0 and d == 0 and e < 0, "template is not a north-up lon/lat grid"
    feat = pd.read_csv(features_csv, usecols=["pixel_id", "row", "col", "elev_m", "slope_deg", "aspect_deg", "ti_themis_tiu", "albedo_mean"])
    assert feat.pixel_id.is_unique, "duplicate pixel_id in the features CSV"
    assert (feat.pixel_id == feat.row * shape[1] + feat.col).all(), "pixel_id does not match row/col for this template shape"
    assert feat.row.between(0, shape[0]-1).all() and feat.col.between(0, shape[1]-1).all(), "row/col outside the template"
    rr, cc = feat.row.to_numpy(), feat.col.to_numpy()

    def layer(column):
        out = np.full(shape, np.nan, "float32")
        out[rr, cc] = feat[column].to_numpy("float32")
        return out

    lat = (f + (np.arange(shape[0]) + 0.5) * e)[:, None] * np.ones((1, shape[1]), "float32")   # from the transform, as the notebook
    return dict(shape=shape, transform=transform, lat=lat, slope=layer("slope_deg"), aspect=layer("aspect_deg"),
                albedo=layer("albedo_mean"), ti=layer("ti_themis_tiu"), dem=layer("elev_m"))


def sols_with_min_bins(rems, min_bins):
    """Sorted list of sols in `rems` with at least `min_bins` REMS bins."""
    n = rems.groupby("sol").size()
    return sorted(int(s) for s in n.index[n >= min_bins])


def rover_pixel(day, transform, shape):
    """(row, col) of the rover for this sol from its REMS lat/lon: col = floor((lon - c)/a), row = floor((lat - f)/e).
    Asserts the rover is static within the sol and inside the template."""
    assert len(day) > 0, "no REMS rows for this sol"
    sol = int(day.sol.iloc[0])
    assert day.latitude_deg.nunique() == 1 and day.longitude_deg_e.nunique() == 1, f"rover moved during sol {sol}"
    a, _, c, _, e, f = transform
    col = int(np.floor((day.longitude_deg_e.iloc[0] - c) / a))      # col from lon, row from lat
    row = int(np.floor((day.latitude_deg.iloc[0] - f) / e))
    assert 0 <= row < shape[0] and 0 <= col < shape[1], f"sol {sol}: rover pixel (row {row}, col {col}) is outside the template {shape}"
    return row, col


def tau_for_sol(sol, ls, tau_table, max_gap_sols, clim_ls_window, clim_exclude, clim_min_sols):
    """(tau, tau_source) for one sol.
    Mastcam: np.interp over the table rows within max_gap_sols of `sol`.
    Otherwise climatology: median tau of rows with circular |ls_deg - ls| <= clim_ls_window, excluding sols in
    clim_exclude (inclusive range); asserts at least clim_min_sols rows and names the sol on failure.
    tau_source for climatology is exactly f"climatology Ls±{window:g}, n={k} sols"."""
    t = tau_table.sort_values("sol")
    assert t.sol.is_unique, "duplicate sols in the tau table"
    near = t[(t.sol - sol).abs() <= max_gap_sols]
    if len(near) > 0:
        tau = float(np.interp(sol, near.sol, near.tau))
        return tau, f"Mastcam {t.band.iloc[0]} nm, nearest {int((near.sol - sol).abs().min())} sol(s) away"
    d = (t.ls_deg - ls).abs() % 360
    d = np.minimum(d, 360 - d)
    storm = t.sol.between(clim_exclude[0], clim_exclude[1])
    sel = t[(d <= clim_ls_window) & ~storm]
    assert len(sel) >= clim_min_sols, (f"sol {sol}: no Mastcam tau within {max_gap_sols} sols and only {len(sel)} sols within "
                                       f"Ls {ls:.1f} ± {clim_ls_window:g} (need {clim_min_sols})")
    return float(sel.tau.median()), f"climatology Ls±{clim_ls_window:g}, n={len(sel)} sols"


# ---------------- model ----------------

def _surface(grid):
    """Per-run constants: surface normals, 1/sqrt(clip(ti)) denominator, latitude column."""
    lat = grid["lat"]
    assert np.all(lat == lat[:, :1]), "lat must vary by row only (north-up grid)"
    sl, asr = np.radians(grid["slope"]), np.radians(grid["aspect"])
    return dict(nE=np.sin(sl)*np.sin(asr), nN=np.sin(sl)*np.cos(asr), nU=np.cos(sl), lat_col=lat[:, :1],
                absorb=1 - grid["albedo"], sqrt_ti=np.sqrt(np.clip(grid["ti"], 50, None)))


def _proxy(s, ls, ltst_hr, tau):
    """Same arithmetic and dtypes as notebook cells 11-12: float32 flux, then absorbed flux / sqrt(ti)."""
    S0 = solar_const(ls)
    sE, sN, sU = sun_vector(ls, s["lat_col"], ltst_hr)              # (H, 1), broadcast over columns
    cos_i = np.clip(s["nE"]*sE + s["nN"]*sN + s["nU"]*sU, 0, None)
    up = sU > 0.02
    direct = np.where(up, S0 * cos_i * np.exp(-tau / np.clip(sU, 0.05, 1)), 0)
    diffuse = np.where(up, 0.15 * S0 * sU * (1 - np.exp(-tau)) * (1 + s["nU"]) / 2, 0)   # crude sky term
    flux = (direct + diffuse).astype("float32")
    p = s["absorb"] * flux
    p /= s["sqrt_ti"]
    return p


def bin_proxy(grid, ls, ltst_hr, tau):
    """Unitless proxy for one REMS bin: (1 - albedo) * tilted flux / sqrt(clip(ti, 50)), float32 (H, W)."""
    return _proxy(_surface(grid), ls, ltst_hr, tau)


def slope_weight(slope, slope_scale_deg):
    """exp(-(slope / slope_scale_deg)^2), NaN slope -> 90 deg, float32."""
    return np.exp(-(np.nan_to_num(slope, nan=90) / slope_scale_deg)**2).astype("float32")


def reference_proxy(grid, ls, ltst_centers, tau):
    """nanpercentile of the proxy over all bins x all pixels, 99.5 (numpy's default linear interpolation).
    Bins that are zero everywhere (sun down) are counted, not stored: zeros are the smallest values (proxy >= 0),
    so they only shift the rank. This keeps memory at the lit bins x valid pixels."""
    q = 99.5
    s = _surface(grid)
    valid = np.isfinite(_proxy(s, ls, 12.0, tau))
    n = int(valid.sum())
    lit = []
    for hr in ltst_centers:
        p = _proxy(s, ls, hr, tau)
        assert np.array_equal(np.isfinite(p), valid), "proxy NaN pattern changes between bins"
        if np.any(p[valid] != 0):
            lit.append(hr)
    n_dark = len(ltst_centers) - len(lit)
    assert lit, "no sunlit bin: the reference is undefined"
    buf = np.empty(len(lit) * n, "float32")
    for k, hr in enumerate(lit):
        buf[k*n:(k+1)*n] = _proxy(s, ls, hr, tau)[valid]
    assert buf.min() >= 0, "negative proxy: the zero-skipping rank shift is invalid"
    j = q / 100 * (len(ltst_centers) * n - 1) - n_dark * n         # rank inside the stored (lit) values
    lo = int(np.floor(j))
    assert lo >= 0, "the percentile falls among the dark bins"
    hi = min(lo + 1, buf.size - 1)
    part = np.partition(buf, [lo, hi])
    v_lo, v_hi = float(part[lo]), float(part[hi])
    return v_lo + (j - lo) * (v_hi - v_lo)


def score_maps(grid, ls, ltst_centers, tau, ref_proxy, slope_scale_deg, day_ltst, score_cap):
    """Per bin: clip(proxy / ref_proxy, 0, score_cap) * slope_weight, accumulated one bin at a time
    (never a (bins, H, W) array). Returns dict likelihood_mean (bins with LTST in day_ltst, NaN where ti is NaN),
    likelihood_max (all bins), frac_at_cap. score_cap=None disables the cap. The maps pass MAP_LTST.
    frac_at_cap: fraction of valid pixels (finite ti) whose uncapped ratio proxy / ref_proxy reaches score_cap in at
    least one bin (any bin, not only the day window); 0 when score_cap is None. Decided by the user, Oct 30."""
    ltst_centers = np.asarray(ltst_centers, float)
    dm = (ltst_centers >= day_ltst[0]) & (ltst_centers <= day_ltst[1])
    assert dm.any(), f"no REMS bin inside the day window {day_ltst}"
    assert ref_proxy > 0, f"reference proxy must be positive, got {ref_proxy}"
    s = _surface(grid)
    flat = slope_weight(grid["slope"], slope_scale_deg)
    valid = np.isfinite(grid["ti"])
    ref = np.float32(ref_proxy)
    total = np.zeros(grid["shape"], "float64")
    mx, at_cap = None, np.zeros(grid["shape"], bool)
    for k, hr in enumerate(ltst_centers):
        ratio = _proxy(s, ls, hr, tau)
        ratio /= ref
        if score_cap is not None:
            at_cap |= ratio >= score_cap
            np.clip(ratio, 0, score_cap, out=ratio)
        else:
            np.clip(ratio, 0, None, out=ratio)
        ratio *= flat
        if dm[k]:
            total += ratio
        mx = ratio if mx is None else np.maximum(mx, ratio)
    mean = (total / dm.sum()).astype("float32")
    mean[~valid] = np.nan
    return dict(likelihood_mean=mean, likelihood_max=mx,
                frac_at_cap=float(at_cap[valid].mean()) if score_cap is not None else 0.0)


def rover_series(grid, row, col, ls, ltst_centers, tau, ref_proxy, slope_scale_deg, score_cap):
    """Per-bin proxy and score at one pixel, for the sol's own REMS bins (rover check only).
    Uses a 1 x 1 slice of the grid, so the arithmetic is the same as the full-grid scoring."""
    px = {k: v[row:row+1, col:col+1] for k, v in grid.items() if isinstance(v, np.ndarray)}
    s = _surface(px)
    flat = slope_weight(px["slope"], slope_scale_deg)
    ref = np.float32(ref_proxy)
    proxy, score = [], []
    for hr in ltst_centers:
        p = _proxy(s, ls, hr, tau)
        proxy.append(p[0, 0])
        ratio = p / ref
        ratio = np.clip(ratio, 0, score_cap) if score_cap is not None else np.clip(ratio, 0, None)
        score.append((ratio * flat)[0, 0])
    return np.array(proxy, "float32"), np.array(score, "float32")


def rover_check(proxy_rover, gap_obs_k):
    """Per-sol rover calibration: dict scale_k (proxy -> K, max/max as now) and corr (model vs observed gap).
    Uses bins with an observed gap and a positive modelled proxy (no sun -> excluded)."""
    x = np.asarray(proxy_rover, "float64")
    y = np.asarray(gap_obs_k, "float64")
    ok = np.isfinite(y) & (x > 0)
    assert ok.any(), "no usable bins at the rover pixel (need an observed gap and modelled sunlight)"
    x, y = x[ok], y[ok]
    assert x.std() > 0 and y.std() > 0, "rover check needs variation in both the model and the observed gap"
    scale = float(y.max() / x.max())
    corr = float(np.mean((x - x.mean()) * (y - y.mean())) / (x.std() * y.std()))   # no np.corrcoef: it calls BLAS
    return dict(scale_k=scale, corr=corr)


def _settings(cfg):
    """Settings the reference depends on, including the LTST grid it was scored on (MAP_LTST) and LIKELY_TOP_PCT,
    which sets the threshold."""
    cap = cfg["SCORE_CAP"]
    return dict(ref_sol=int(cfg["REF_SOL"]), tau_band=str(cfg["TAU_BAND"]), slope_scale_deg=float(cfg["SLOPE_SCALE_DEG"]),
                day_ltst=[float(cfg["DAY_LTST"][0]), float(cfg["DAY_LTST"][1])], score_cap=None if cap is None else float(cap),
                likely_top_pct=float(cfg["LIKELY_TOP_PCT"]), map_ltst=MAP_LTST.tolist())


def _assert_same_settings(reference, cfg):
    for k, v in _settings(cfg).items():
        assert k in reference, f"reference has no {k!r} (built by an older version); rebuild it (RUN_REFERENCE = True)"
        got = list(reference[k]) if k in ("day_ltst", "map_ltst") else reference[k]
        assert got == v, f"reference was built with {k}={got!r} but the config has {v!r}; rebuild it (RUN_REFERENCE = True)"


def build_reference(grid, day, ls, tau, tau_source, cfg):
    """Reference dict for cfg["REF_SOL"]: ref_sol, ref_proxy_p995, threshold (90th pct of its daily mean),
    tau, tau_source, tau_band, slope_scale_deg, day_ltst, score_cap. Scored on MAP_LTST; `day` only identifies the sol."""
    assert (day.sol == cfg["REF_SOL"]).all(), f"reference must be built from sol {cfg['REF_SOL']}"
    ref_proxy = reference_proxy(grid, ls, MAP_LTST, tau)
    m = score_maps(grid, ls, MAP_LTST, tau, ref_proxy, cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"], cfg["SCORE_CAP"])
    threshold = float(np.nanpercentile(m["likelihood_mean"], 100 - cfg["LIKELY_TOP_PCT"]))
    return dict(ref_proxy_p995=ref_proxy, threshold=threshold, tau=float(tau), tau_source=str(tau_source), **_settings(cfg))


def save_reference(path, reference):
    """Write the reference dict as JSON."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(reference, indent=2, ensure_ascii=False), encoding="utf-8")


def load_reference(path, cfg):
    """Read the reference JSON; assert ref_sol, tau_band, slope_scale_deg, day_ltst, score_cap, likely_top_pct and
    map_ltst equal cfg (and MAP_LTST)."""
    reference = json.loads(Path(path).read_text(encoding="utf-8"))
    _assert_same_settings(reference, cfg)
    return reference


def run_sol(sol, day, grid, ls, tau, tau_source, reference, cfg):
    """One sol against the shared reference. Returns dict: likelihood_mean, likelihood_max, rover_row, rover_col,
    rover_scale_k, rover_corr, frac_above_threshold, frac_at_cap, dem_minus_rems_m, table (per-bin rover DataFrame)."""
    assert (day.sol == sol).all(), f"day table holds sols other than {sol}"
    _assert_same_settings(reference, cfg)
    r, c = rover_pixel(day, grid["transform"], grid["shape"])
    m = score_maps(grid, ls, MAP_LTST, tau, reference["ref_proxy_p995"], cfg["SLOPE_SCALE_DEG"], cfg["DAY_LTST"], cfg["SCORE_CAP"])

    # rover check on the sol's own REMS bins; the kelvin scale never enters the maps
    proxy_rover, score_rover = rover_series(grid, r, c, ls, day.ltst_bin_center_hr.to_numpy(), tau, reference["ref_proxy_p995"],
                                            cfg["SLOPE_SCALE_DEG"], cfg["SCORE_CAP"])
    gap_obs = (day.ground_temp_k - day.air_temp_k).to_numpy()
    rc = rover_check(proxy_rover, gap_obs)
    tbl = day[["sol", "bin", "ltst_bin_center_hr", "air_temp_k", "ground_temp_k", "pressure_pa"]].copy()
    tbl["gap_obs_k"] = gap_obs
    tbl["ls_deg"], tbl["tau"] = ls, tau
    tbl["gap_model_k_rover"] = proxy_rover * np.float32(rc["scale_k"])
    tbl["score_rover"] = score_rover

    mean = m["likelihood_mean"]
    return dict(sol=int(sol), ls_deg=float(ls), tau=float(tau), tau_source=str(tau_source), n_bins=int(len(day)),
                likelihood_mean=mean, likelihood_max=m["likelihood_max"], rover_row=r, rover_col=c,
                rover_lat=float(day.latitude_deg.iloc[0]), rover_lon=float(day.longitude_deg_e.iloc[0]),
                rover_scale_k=rc["scale_k"], rover_corr=rc["corr"],
                frac_above_threshold=float(np.mean(mean[np.isfinite(mean)] >= reference["threshold"])),
                frac_at_cap=m["frac_at_cap"], dem_minus_rems_m=float(grid["dem"][r, c]) - float(day.elevation_m.iloc[0]),
                table=tbl)


# ---------------- outputs ----------------

def write_geotiff(path, res, reference, template_tif, day_ltst):
    import rasterio
    with rasterio.open(template_tif) as t:
        crs, tf, shape = t.crs, t.transform, (t.height, t.width)
    assert shape == res["likelihood_mean"].shape, "template and score maps come from different grids"
    assert crs.is_geographic, "template should be lon/lat"
    ref = reference["ref_sol"]
    profile = dict(driver="GTiff", dtype="float32", count=2, height=shape[0], width=shape[1], crs=crs, transform=tf, nodata=np.nan)
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(res["likelihood_mean"].astype("float32"), 1)
        dst.set_band_description(1, f"score_mean_{day_ltst[0]:g}-{day_ltst[1]:g}LTST_shared_ref_sol{ref}")
        dst.write(res["likelihood_max"].astype("float32"), 2)
        dst.set_band_description(2, f"score_max_over_day_shared_ref_sol{ref}")


class Previews:
    """Loads each preview once, crops it to the template and caches resized copies by width."""

    def __init__(self, cfg, shape, transform):
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = None
        self.H, self.W = shape
        a, _, x0, _, e, y0 = transform
        self.west, self.east, self.south, self.north = x0, x0 + a*self.W, y0 + e*self.H, y0
        self.cache, self.images = {}, {}
        for tag in ("imagery", "hillshade"):
            path = Path(cfg[f"{tag.upper()}_PREVIEW"])
            assert path.exists(), f"preview not found: {path}"
            assert path.suffix.lower() in (".png", ".jpg", ".jpeg"), f"{path.name}: export the preview as .png or .jpg"
            img = Image.open(path).convert("RGB")
            if cfg["PREVIEW_BOUNDS"] is not None:                    # crop the preview to the template extent
                bw, be, bs, bn = cfg["PREVIEW_BOUNDS"]
                assert bw <= self.west and be >= self.east and bs <= self.south and bn >= self.north, "PREVIEW_BOUNDS must contain the template"
                sx, sy = img.width / (be - bw), img.height / (bn - bs)
                img = img.crop((round((self.west-bw)*sx), round((bn-self.north)*sy), round((self.east-bw)*sx), round((bn-self.south)*sy)))
            self.images[tag] = img

    def base(self, tag, w):
        from PIL import Image
        if (tag, w) not in self.cache:
            self.cache[(tag, w)] = np.asarray(self.images[tag].resize((w, round(w * self.H / self.W)), Image.LANCZOS), dtype="float32")
        return self.cache[(tag, w)]

    def panel(self, tag, w, mask, rover_lon, rover_lat, rgb, alpha):
        from PIL import Image, ImageDraw
        ph = round(w * self.H / self.W)
        m = np.asarray(Image.fromarray(mask.astype("uint8") * 255).resize((w, ph), Image.NEAREST), dtype="float32")[..., None] / 255
        out = self.base(tag, w) * (1 - alpha * m) + np.array(rgb, "float32") * (alpha * m)
        im = Image.fromarray(out.round().astype("uint8"))
        d = ImageDraw.Draw(im)
        px = (rover_lon - self.west) / (self.east - self.west) * w
        py = (self.north - rover_lat) / (self.north - self.south) * ph
        rr = max(10, w // 110)
        d.ellipse([px-rr, py-rr, px+rr, py+rr], outline=(0, 0, 0), width=rr // 2 + 1)
        d.ellipse([px-rr, py-rr, px+rr, py+rr], outline=(0, 255, 255), width=max(3, rr // 4))
        return im


def write_overlays(out_dir, res, reference, previews, cfg):
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.load_default()
    sol, ref, thr = res["sol"], reference["ref_sol"], reference["threshold"]
    rgb = tuple(int(cfg["HIGHLIGHT"][i:i+2], 16) for i in (1, 3, 5))
    mean = res["likelihood_mean"]
    mask = np.isfinite(mean) & (mean >= thr)
    d0, d1 = cfg["DAY_LTST"]
    title = (f"Dust devil activity heuristic, sol {sol}, Ls {res['ls_deg']:.1f}, mean {d0:g}-{d1:g} LTST, tau={res['tau']:.2f} "
             f"({res['tau_source']}). Shared reference sol {ref}. Relative score, not a probability.")
    legend = f"score >= {thr:.3f} (top {cfg['LIKELY_TOP_PCT']:g}% of sol {ref}); {res['frac_above_threshold']:.1%} of this sol"
    bounds = f"lon {previews.west:.3f}..{previews.east:.3f} E, lat {previews.south:.3f}..{previews.north:.3f}"
    args = (mask, res["rover_lon"], res["rover_lat"], rgb, cfg["ALPHA"])

    pw = cfg["PANEL_W"]
    ph = round(pw * previews.H / previews.W)
    head, foot, gap = 54, 40, 12
    canvas = Image.new("RGB", (2*pw + gap, head + ph + foot), "white")
    for k, tag in enumerate(("imagery", "hillshade")):
        canvas.paste(previews.panel(tag, pw, *args), (k*(pw + gap), head))
    d = ImageDraw.Draw(canvas)
    d.text((8, 8), title, fill="black", font=font)
    d.text((8, 28), f"Left: CTX imagery   Right: hillshade   |   {bounds}", fill="black", font=font)
    d.rectangle([8, head+ph+12, 28, head+ph+28], fill=rgb)
    d.text((36, head+ph+14), legend, fill="black", font=font)
    canvas.save(Path(out_dir) / f"likelihood_overlay_sol{sol}.png")

    for tag, name in (("imagery", "CTX imagery"), ("hillshade", "Hillshade")):
        im = previews.panel(tag, cfg["SEPARATE_W"], *args)
        head, foot = 56, 48
        sheet = Image.new("RGB", (im.width, head + im.height + foot), "white")
        sheet.paste(im, (0, head))
        d = ImageDraw.Draw(sheet)
        d.text((8, 8), f"{name}: {title}", fill="black", font=font)
        d.text((8, 30), bounds, fill="black", font=font)
        y = head + im.height + 14
        d.rectangle([8, y, 28, y+16], fill=rgb)
        d.text((36, y+2), legend, fill="black", font=font)
        sheet.save(Path(out_dir) / f"likelihood_overlay_sol{sol}_{tag}.png")


def gif_frame(res, reference, previews, cfg):
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.load_default()
    mean = res["likelihood_mean"]
    mask = np.isfinite(mean) & (mean >= reference["threshold"])
    rgb = tuple(int(cfg["HIGHLIGHT"][i:i+2], 16) for i in (1, 3, 5))
    im = previews.panel("hillshade", cfg["GIF_W"], mask, res["rover_lon"], res["rover_lat"], rgb, cfg["ALPHA"])
    head = 44
    frame = Image.new("RGB", (im.width, head + im.height), "white")
    frame.paste(im, (0, head))
    d = ImageDraw.Draw(frame)
    d.text((8, 6), f"sol {res['sol']}   Ls {res['ls_deg']:.1f}   tau {res['tau']:.2f} ({res['tau_source']})   "
                   f"{res['frac_above_threshold']:.1%} above threshold", fill="black", font=font)
    d.text((8, 24), f"score >= {reference['threshold']:.3f} (top {cfg['LIKELY_TOP_PCT']:g}% of sol {reference['ref_sol']}). "
                    f"Heuristic, not a probability.", fill="black", font=font)
    return frame


SUMMARY_COLS = ["sol", "ls_deg", "tau", "tau_source", "n_bins", "frac_above_threshold", "frac_at_cap", "rover_corr",
                "rover_scale_k", "dem_minus_rems_m"]


# ---------------- end to end ----------------

def run_multisol(cfg):
    """Run cfg["SOLS"]: reference (RUN_REFERENCE flag), then per sol npz + 2-band GeoTIFF + rover table + overlays,
    summary CSV and one GIF, all in cfg["OUT_DIR"]. Returns the summary DataFrame."""
    out = Path(cfg["OUT_DIR"])
    out.mkdir(parents=True, exist_ok=True)
    sols = sorted(int(s) for s in cfg["SOLS"])
    assert len(sols) == len(set(sols)) and len(sols) > 0, f"SOLS must be a non-empty list of distinct sols: {cfg['SOLS']}"

    rems = pd.read_csv(cfg["BINNED_CSV"])
    ok_sols = sols_with_min_bins(rems, cfg["MIN_BINS"])
    short = [s for s in sols + [cfg["REF_SOL"]] if s not in ok_sols]
    assert not short, f"sols with fewer than {cfg['MIN_BINS']} REMS bins: {short}"
    tau_table = pd.read_csv(cfg["TAU_CSV"])
    assert tau_table.band.astype(str).nunique() == 1 and str(tau_table.band.iloc[0]) == str(cfg["TAU_BAND"]), \
        f"tau table band {tau_table.band.unique()} differs from TAU_BAND {cfg['TAU_BAND']}: rebuild stage 0"
    grid = load_grid(cfg["FEATURES_CSV"], cfg["META_JSON"])

    def day_of(s):
        d = rems[rems.sol == s].sort_values("bin").reset_index(drop=True)
        assert len(d) > 0, f"sol {s} not in {cfg['BINNED_CSV']}"
        return d

    def tau_of(s):
        return tau_for_sol(s, float(ls_deg(s)), tau_table, cfg["MAX_TAU_GAP_SOLS"], cfg["TAU_CLIM_LS_WINDOW"],
                           cfg["TAU_CLIM_EXCLUDE"], cfg["TAU_CLIM_MIN_SOLS"])

    ref_json = Path(cfg["REFERENCE_JSON"])
    if want(cfg["RUN_REFERENCE"], ref_json):
        s = cfg["REF_SOL"]
        reference = build_reference(grid, day_of(s), float(ls_deg(s)), *tau_of(s), cfg)
        save_reference(ref_json, reference)
        print(f"built reference from sol {s}: ref_proxy_p995 {reference['ref_proxy_p995']:.4f}, threshold {reference['threshold']:.4f}, "
              f"tau {reference['tau']:.3f} ({reference['tau_source']}) -> {ref_json}")
    else:
        reference = load_reference(ref_json, cfg)
        print(f"loaded reference {ref_json}: threshold {reference['threshold']:.4f}")

    previews = Previews(cfg, grid["shape"], grid["transform"])
    rows, frames = [], []
    for s in sols:
        ls = float(ls_deg(s))
        tau, src = tau_of(s)
        res = run_sol(s, day_of(s), grid, ls, tau, src, reference, cfg)
        np.savez_compressed(out / f"gale_dust_devil_likelihood_sol{s}.npz",
                            likelihood_mean=res["likelihood_mean"].astype("float32"), likelihood_max=res["likelihood_max"].astype("float32"),
                            sol=s, ls_deg=ls, tau=tau, tau_source=src, ref_sol=reference["ref_sol"], ref_proxy=reference["ref_proxy_p995"],
                            threshold=reference["threshold"], score_cap=np.nan if cfg["SCORE_CAP"] is None else float(cfg["SCORE_CAP"]),
                            day_ltst=np.array(cfg["DAY_LTST"]), rover_row=res["rover_row"], rover_col=res["rover_col"])
        write_geotiff(out / f"gale_dust_devil_likelihood_sol{s}.tif", res, reference, cfg["TEMPLATE_TIF"], cfg["DAY_LTST"])
        res["table"].to_csv(out / f"rover_sol{s}_table.csv", index=False)
        write_overlays(out, res, reference, previews, cfg)
        frames.append(gif_frame(res, reference, previews, cfg))
        rows.append({k: res[k] for k in SUMMARY_COLS})
        print(f"sol {s}: Ls {ls:.1f}, tau {tau:.3f} ({src}), {res['n_bins']} bins, above threshold {res['frac_above_threshold']:.1%}, "
              f"at cap {res['frac_at_cap']:.1%}, rover (row {res['rover_row']}, col {res['rover_col']}) corr {res['rover_corr']:.2f}, "
              f"scale {res['rover_scale_k']:.3f} K, DEM - REMS {res['dem_minus_rems_m']:+.1f} m")
        del res

    summary = pd.DataFrame(rows, columns=SUMMARY_COLS)
    summary.to_csv(out / f"dust_devil_multisol_summary_{sols[0]}-{sols[-1]}.csv", index=False)   # by range, like the GIF
    frames[0].save(out / f"dust_devil_multisol_{sols[0]}-{sols[-1]}.gif", save_all=True, append_images=frames[1:],
                   duration=cfg["GIF_MS"], loop=0)
    return summary
