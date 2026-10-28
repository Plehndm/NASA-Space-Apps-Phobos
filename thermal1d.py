"""1D soil heat-conduction baseline for Gale Crater. numpy only. Spec: CLAUDE.md.

Shapes: per-column inputs are (n_col,), time series are (n_col, n_steps) and
temperature profiles are (n_col, n_nodes). Node 0 is the surface.
"""
import csv
from typing import NamedTuple

import numpy as np

# --- physical constants ---------------------------------------------------
P_SOL = 88775.244            # s, one Mars solar day
RHO_C = 1.2e6                # J m^-3 K^-1, volumetric heat capacity
SIGMA = 5.670374e-8          # W m^-2 K^-4
EPS = 0.95                   # surface emissivity, fixed

# --- orbit and solar ------------------------------------------------------
OBLIQUITY_DEG = 25.19        # deg
ECC = 0.0934                 # orbital eccentricity
A_AU = 1.5237                # AU, semi-major axis
LS_PERI_DEG = 251.0          # deg, Ls of perihelion
S0_1AU = 1361.0              # W m^-2, solar constant at 1 AU

# --- forcing parameters ---------------------------------------------------
B_TAU = 1.0                  # sky-IR growth with tau, fixed
G_DIFF = 0.5                 # diffuse fraction of scattered light, fitted, bounds [0, 1]
F_IR = 0.04                  # sky-IR fraction of noon flat sunlight, fitted, bounds [0, 0.15]
TI_SCALE = 1.0               # thermal-inertia scale factor, fitted, bounds [0.7, 1.3]

# --- latitude of a grid row (gale_dust_devil_meta.json transform) --------
LAT_TOP_DEG = -4.148577212911933       # deg, north edge of row 0
LAT_STEP_DEG = -0.0016870993139129456  # deg per row

# --- numerics -------------------------------------------------------------
GRID_FIRST_FRAC = 1.0 / 30.0  # first layer thickness, in skin depths
GRID_STRETCH = 1.10           # geometric stretch factor between layers
GRID_DEPTH_SKINS = 10.0       # minimum total depth, in skin depths
STEPS_PER_SOL = 960           # dt = P_SOL / 960, 10 steps per 15-minute bin
NEWTON_MAX_ITER = 20
NEWTON_TOL = 1e-6             # W m^-2, surface energy-balance residual
SPINUP_TOL_K = 0.01           # K, max |dT| between consecutive sols, all depths
SPINUP_MAX_SOLS = 50

# --- REMS training table (gale_rems_training.csv, checked Oct 27) --------
# Bins are 15 minutes, bin start = bin / 4 h. Each REMS value is the mean of 1 Hz readings
# in [start, start + 15 min), so the model is compared at the bin centre, start + 0.125 h.
# ltst_bin_center_hr in the table is rounded to 0.01 h; the table's flux and sun_elev_deg
# columns were computed at that rounded centre, with the rover latitude_deg.
BIN_HOURS = 0.25              # h, REMS bin width
TABLE_COLUMNS = {
    "sol": int, "bin": int, "ltst_bin_start_hr": float, "ltst_bin_center_hr": float,
    "ground_temp_k": float, "ls_deg": float, "row": int, "col": int, "pixel_id": int,
    "slope_deg": float, "aspect_deg": float, "ti_themis_tiu": float, "albedo_mean": float,
    "elev_dem_m": float, "sun_elev_deg": float, "flux_flat_wm2": float, "flux_tilted_wm2": float,
    "tau": float, "tau_source": str, "tau_is_placeholder": bool, "ground_missing": bool,
    "core_sol": bool, "block": int, "split_role": str,
}


# --- grid -----------------------------------------------------------------

class Grid(NamedTuple):
    z: np.ndarray      # (n_col, n_nodes) m, node depths, z[:, 0] = 0
    dz: np.ndarray     # (n_col, n_nodes - 1) m, layer thicknesses
    cap: np.ndarray    # (n_col, n_nodes) J m^-2 K^-1, heat capacity of each node's control volume
    k: np.ndarray      # (n_col,) W m^-1 K^-1
    delta: np.ndarray  # (n_col,) m, diurnal skin depth


def skin_depth(k):
    """Diurnal skin depth (m) for conductivity k (W m^-1 K^-1)."""
    return np.sqrt(k * P_SOL / (np.pi * RHO_C))


def unit_layers(refine=1):
    """Layer thicknesses in skin depths. refine=2 splits every layer into two equal halves."""
    assert refine in (1, 2), f"refine must be 1 or 2, got {refine}"
    n = int(np.ceil(np.log(1.0 + GRID_DEPTH_SKINS * (GRID_STRETCH - 1.0) / GRID_FIRST_FRAC)
                    / np.log(GRID_STRETCH)))
    layers = GRID_FIRST_FRAC * GRID_STRETCH ** np.arange(n)
    assert layers.sum() >= GRID_DEPTH_SKINS, "grid shallower than GRID_DEPTH_SKINS"
    return np.repeat(layers / refine, refine)


def make_grid(ti, refine=1):
    """Grid for columns with thermal inertia ti (J m^-2 K^-1 s^-1/2), shape (n_col,).

    The grid is the same in skin-depth units for every column, so a batch shares n_nodes.
    """
    ti = np.asarray(ti, dtype=np.float64)
    assert ti.ndim == 1 and np.all(ti > 0), "ti must be a positive 1D array"
    k = ti ** 2 / RHO_C
    delta = skin_depth(k)
    dz = delta[:, None] * unit_layers(refine)[None, :]
    z = np.concatenate([np.zeros((len(ti), 1)), np.cumsum(dz, axis=1)], axis=1)
    vol = np.zeros_like(z)
    vol[:, :-1] += dz / 2.0
    vol[:, 1:] += dz / 2.0
    return Grid(z=z, dz=dz, cap=RHO_C * vol, k=k, delta=delta)


# --- solver ---------------------------------------------------------------

def _sweep_coefficients(grid, dt):
    """Constant parts of the bottom-up elimination: T_i = alpha_i + beta_i * T_{i-1}."""
    g = grid.k[:, None] / grid.dz                    # (n_col, n_layers) conductance per layer
    n_nodes = grid.z.shape[1]
    lower = np.zeros_like(grid.z)
    diag = grid.cap / dt
    upper = np.zeros_like(grid.z)
    lower[:, 1:] = -g
    upper[:, 1:-1] = -g[:, 1:]
    diag[:, 1:] += g
    diag[:, 1:-1] += g[:, 1:]
    beta = np.zeros_like(grid.z)
    denom = np.zeros_like(grid.z)
    denom[:, -1] = diag[:, -1]
    beta[:, -1] = -lower[:, -1] / denom[:, -1]
    for i in range(n_nodes - 2, 0, -1):
        denom[:, i] = diag[:, i] + upper[:, i] * beta[:, i + 1]
        beta[:, i] = -lower[:, i] / denom[:, i]
    return upper, beta, denom, g[:, 0]


def run_sol(T, grid, flux_in=None, surface_temp=None, eps=EPS, keep_profiles=False):
    """Advance the columns through one sol with backward Euler.

    T: (n_col, n_nodes) K, profile at the start of the sol.
    Give exactly one surface condition, each (n_col, n_steps) at the END of each step:
      flux_in: absorbed flux (1 - A) Q_sw + eps L_sky, W m^-2; T_s from the energy balance
      surface_temp: prescribed surface temperature, K
    Returns (T_end, Ts, newton_iters): profile after the sol, surface temperature at each
    step end (n_col, n_steps), and the largest Newton iteration count of any step (0 if
    the surface temperature was prescribed). With keep_profiles=True a fourth array is
    returned: the profile at each step end, (n_col, n_steps, n_nodes).
    """
    assert (flux_in is None) != (surface_temp is None), "give exactly one of flux_in, surface_temp"
    forcing = flux_in if flux_in is not None else surface_temp
    n_col, n_steps = forcing.shape
    assert T.shape == grid.z.shape, f"T shape {T.shape} != grid shape {grid.z.shape}"
    assert n_col == T.shape[0], "forcing and T disagree on n_col"
    dt = P_SOL / n_steps
    upper, beta, denom, g0 = _sweep_coefficients(grid, dt)
    rhs_scale = grid.cap / dt
    c0 = rhs_scale[:, 0]
    n_nodes = T.shape[1]
    T = T.astype(np.float64, copy=True)
    Ts = np.empty((n_col, n_steps))
    profiles = np.empty((n_col, n_steps, n_nodes)) if keep_profiles else None
    alpha = np.zeros_like(T)
    newton_iters = 0
    for n in range(n_steps):
        rhs = rhs_scale * T
        alpha[:, -1] = rhs[:, -1] / denom[:, -1]
        for i in range(n_nodes - 2, 0, -1):
            alpha[:, i] = (rhs[:, i] - upper[:, i] * alpha[:, i + 1]) / denom[:, i]
        if flux_in is not None:
            T0, it = _surface_newton(T[:, 0], flux_in[:, n], alpha[:, 1], beta[:, 1], g0, c0, eps)
            newton_iters = max(newton_iters, it)
        else:
            T0 = surface_temp[:, n]
        T[:, 0] = T0
        for i in range(1, n_nodes):
            T[:, i] = alpha[:, i] + beta[:, i] * T[:, i - 1]
        Ts[:, n] = T0
        if keep_profiles:
            profiles[:, n, :] = T
    assert np.all(np.isfinite(T)), "non-finite temperature after sol"
    assert np.all(T > 0), "non-positive temperature after sol"
    if keep_profiles:
        return T, Ts, newton_iters, profiles
    return T, Ts, newton_iters


def _surface_newton(T0_old, f_in, alpha1, beta1, g0, c0, eps):
    """Solve the surface-node energy balance for T0 at the new time level.

    R(T0) = f_in - eps sigma T0^4 + g0 (alpha1 + (beta1 - 1) T0) - c0 (T0 - T0_old) = 0,
    where g0 (T1 - T0) is conduction from node 1 and c0 the surface half-cell storage.
    """
    T0 = T0_old.copy()
    for it in range(1, NEWTON_MAX_ITER + 1):
        resid = f_in - eps * SIGMA * T0 ** 4 + g0 * (alpha1 + (beta1 - 1.0) * T0) - c0 * (T0 - T0_old)
        dresid = -4.0 * eps * SIGMA * T0 ** 3 + g0 * (beta1 - 1.0) - c0
        T0 = T0 - resid / dresid
        resid = f_in - eps * SIGMA * T0 ** 4 + g0 * (alpha1 + (beta1 - 1.0) * T0) - c0 * (T0 - T0_old)
        if np.max(np.abs(resid)) < NEWTON_TOL:
            return T0, it
    raise AssertionError(f"Newton did not converge in {NEWTON_MAX_ITER} iterations, "
                         f"max |residual| {np.max(np.abs(resid)):.3e} W m^-2")


def radiative_equilibrium_temperature(flux_in, eps=EPS):
    """Temperature (K) whose emission equals the sol-mean absorbed flux, shape (n_col,)."""
    mean_in = flux_in.mean(axis=1)
    assert np.all(mean_in > 0), "sol-mean absorbed flux must be positive"
    return (mean_in / (eps * SIGMA)) ** 0.25


def spin_up(grid, flux_in=None, surface_temp=None, eps=EPS,
            tol=SPINUP_TOL_K, max_sols=SPINUP_MAX_SOLS):
    """Repeat one sol until the start-of-sol profile changes by less than tol at all depths.

    Starts from the radiative-equilibrium mean temperature (flux_in) or the mean prescribed
    surface temperature (surface_temp). After each sol that has not converged, the whole
    column is shifted so its deepest node equals that sol's mean surface temperature: in the
    periodic state the sol-mean temperature is the same at every depth, so the shift is zero
    there and only removes the slow deep transient. Returns (T_start, Ts, newton_iters,
    n_sols): the periodic start-of-sol profile, the surface series of the last sol, the
    largest Newton iteration count over the spin-up, and the number of sols run.
    """
    if flux_in is not None:
        T_init = radiative_equilibrium_temperature(flux_in, eps)
    else:
        T_init = surface_temp.mean(axis=1)
    T = np.repeat(T_init[:, None], grid.z.shape[1], axis=1)
    newton_max = 0
    for n_sols in range(1, max_sols + 1):
        T_new, Ts, it = run_sol(T, grid, flux_in=flux_in, surface_temp=surface_temp, eps=eps)
        newton_max = max(newton_max, it)
        change = np.max(np.abs(T_new - T))
        T = T_new
        if change < tol:
            return T, Ts, newton_max, n_sols
        T = T + (Ts.mean(axis=1) - T[:, -1])[:, None]
    raise AssertionError(f"spin-up not converged in {max_sols} sols, last max |dT| {change:.4f} K")


# --- Mars forcing ---------------------------------------------------------

def lat_from_row(row):
    """Latitude (deg) at the centre of grid row `row`."""
    return LAT_TOP_DEG + (np.asarray(row, dtype=np.float64) + 0.5) * LAT_STEP_DEG


def solar_declination_deg(ls_deg):
    return np.degrees(np.arcsin(np.sin(np.radians(OBLIQUITY_DEG)) * np.sin(np.radians(ls_deg))))


def sun_distance_au(ls_deg):
    return A_AU * (1.0 - ECC ** 2) / (1.0 + ECC * np.cos(np.radians(ls_deg - LS_PERI_DEG)))


def toa_flux(ls_deg):
    """Top-of-atmosphere solar flux (W m^-2) at Mars for season ls_deg."""
    return S0_1AU / sun_distance_au(ls_deg) ** 2


def step_ltst(n_steps=STEPS_PER_SOL):
    """LTST (h) at the end of each step of a sol, shape (n_steps,)."""
    return 24.0 * np.arange(1, n_steps + 1) / n_steps


def sun_position(lat_deg, ls_deg, ltst_hr):
    """Cosine of the solar zenith angle and sun azimuth (deg, clockwise from north).

    lat_deg, ls_deg: (n_col,). ltst_hr: (n_t,). Returns two arrays of shape (n_col, n_t).
    """
    lat = np.radians(np.asarray(lat_deg, dtype=np.float64))[:, None]
    dec = np.radians(solar_declination_deg(np.asarray(ls_deg, dtype=np.float64)))[:, None]
    h = np.radians(15.0 * (np.asarray(ltst_hr, dtype=np.float64)[None, :] - 12.0))
    mu0 = np.sin(lat) * np.sin(dec) + np.cos(lat) * np.cos(dec) * np.cos(h)
    az = np.degrees(np.arctan2(-np.cos(dec) * np.sin(h),
                               np.sin(dec) * np.cos(lat) - np.cos(dec) * np.sin(lat) * np.cos(h)))
    return mu0, np.mod(az, 360.0)


def shortwave(lat_deg, ls_deg, tau, slope_deg, aspect_deg, ltst_hr, g_diff=G_DIFF):
    """Sunlight at the surface, W m^-2, each (n_col, n_t).

    Returns (direct_flat, direct_tilted, diffuse). Aspect is the downslope azimuth,
    clockwise from north. All terms are 0 when the sun is at or below the horizon.
    """
    mu0, az = sun_position(lat_deg, ls_deg, ltst_hr)
    s0 = toa_flux(np.asarray(ls_deg, dtype=np.float64))[:, None]
    tau = np.asarray(tau, dtype=np.float64)[:, None]
    s = np.radians(np.asarray(slope_deg, dtype=np.float64))[:, None]
    aspect = np.radians(np.asarray(aspect_deg, dtype=np.float64))[:, None]
    up = mu0 > 0.0
    mu_safe = np.where(up, mu0, 1.0)
    sin_z = np.sqrt(np.clip(1.0 - mu0 ** 2, 0.0, None))
    cos_i = np.cos(s) * mu0 + np.sin(s) * sin_z * np.cos(np.radians(az) - aspect)
    cos_i = np.clip(cos_i, 0.0, None)
    trans = np.exp(-tau / mu_safe)
    direct_flat = np.where(up, s0 * mu0 * trans, 0.0)
    direct_tilted = np.where(up, s0 * cos_i * trans, 0.0)
    diffuse = np.where(up, g_diff * s0 * mu0 * (1.0 - trans) * (1.0 + np.cos(s)) / 2.0, 0.0)
    return direct_flat, direct_tilted, diffuse


def sky_ir(lat_deg, ls_deg, tau, slope_deg, f_ir=F_IR, b_tau=B_TAU):
    """Downwelling sky infrared (W m^-2), constant within a sol, shape (n_col,)."""
    lat = np.radians(np.asarray(lat_deg, dtype=np.float64))
    dec = np.radians(solar_declination_deg(np.asarray(ls_deg, dtype=np.float64)))
    mu0_noon = np.clip(np.cos(lat - dec), 0.0, None)
    s = np.radians(np.asarray(slope_deg, dtype=np.float64))
    return (f_ir * toa_flux(np.asarray(ls_deg, dtype=np.float64)) * mu0_noon
            * (1.0 + b_tau * np.asarray(tau, dtype=np.float64)) * (1.0 + np.cos(s)) / 2.0)


def absorbed_flux(lat_deg, ls_deg, tau, slope_deg, aspect_deg, albedo, ltst_hr,
                  g_diff=G_DIFF, f_ir=F_IR, b_tau=B_TAU, eps=EPS):
    """(1 - A) Q_sw + eps L_sky, W m^-2, shape (n_col, n_t). The solver's flux_in."""
    _, direct_tilted, diffuse = shortwave(lat_deg, ls_deg, tau, slope_deg, aspect_deg, ltst_hr, g_diff)
    albedo = np.asarray(albedo, dtype=np.float64)[:, None]
    l_sky = sky_ir(lat_deg, ls_deg, tau, slope_deg, f_ir, b_tau)[:, None]
    return (1.0 - albedo) * (direct_tilted + diffuse) + eps * l_sky


# --- data loader ----------------------------------------------------------

def _parse(values, kind):
    if kind is bool:
        assert set(values) <= {"True", "False"}, f"unexpected boolean values {set(values) - {'True', 'False'}}"
        return np.array([v == "True" for v in values])
    if kind is str:
        return np.array(values)
    if kind is int:
        return np.array([int(v) for v in values], dtype=np.int64)
    return np.array([float(v) if v != "" else np.nan for v in values], dtype=np.float64)


def load_rems_table(path, allow_test=False):
    """Load the columns in TABLE_COLUMNS as a dict of arrays, one entry per REMS bin.

    Rows with split_role == "test" are dropped unless allow_test=True. Rows without ground
    temperature are dropped, since nothing can be scored on them. Both counts are printed.
    """
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        missing = set(TABLE_COLUMNS) - set(header)
        assert not missing, f"columns missing from {path}: {sorted(missing)}"
        idx = {name: header.index(name) for name in TABLE_COLUMNS}
        rows = list(reader)
    data = {name: _parse([r[i] for r in rows], TABLE_COLUMNS[name]) for name, i in idx.items()}
    assert set(np.unique(data["split_role"])) <= {"train", "test"}, "unexpected split_role values"
    keep = np.ones(len(rows), dtype=bool)
    n_test = int((data["split_role"] == "test").sum())
    if not allow_test:
        keep &= data["split_role"] != "test"
    n_missing = int((keep & data["ground_missing"]).sum())
    keep &= ~data["ground_missing"]
    assert np.all(np.isfinite(data["ground_temp_k"][keep])), "ground temperature missing but not flagged"
    print(f"loaded {len(rows)} rows; dropped {n_test if not allow_test else 0} sealed-test rows "
          f"and {n_missing} rows without ground temperature; {int(keep.sum())} rows kept")
    return {name: col[keep] for name, col in data.items()}
