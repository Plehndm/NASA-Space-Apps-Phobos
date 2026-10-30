"""Gate 1: solver checks (CLAUDE.md, Verification gates). No table data needed."""
import numpy as np
import pytest

import thermal1d as t

# Realistic Gale columns: thermal inertia spans the traverse range (353-682 tiu).
TI = np.array([350.0, 450.0, 550.0, 680.0])
LAT = np.full(4, -4.7)
SLOPE = np.full(4, 5.0)
ASPECT = np.full(4, 120.0)
ALBEDO = np.full(4, 0.25)
LOW_TAU = dict(ls=np.full(4, 70.0), tau=np.full(4, 0.4))
HIGH_TAU = dict(ls=np.full(4, 250.0), tau=np.full(4, 1.6))
PERIODIC_TOL_K = 1e-4    # tighter than SPINUP_TOL_K so "periodic state" leaves no drift
PERIODIC_MAX_SOLS = 200  # checks 1, 2, 3 and 5 need the periodic state, not the spin-up limit


def mars_flux(sol, n_steps=t.STEPS_PER_SOL):
    return t.absorbed_flux(LAT, sol["ls"], sol["tau"], SLOPE, ASPECT, ALBEDO, t.step_ltst(n_steps))


def periodic_surface(grid, n_steps, sol):
    _, Ts, _, _ = t.spin_up(grid, flux_in=mars_flux(sol, n_steps),
                            tol=PERIODIC_TOL_K, max_sols=PERIODIC_MAX_SOLS)
    per_bin = n_steps // 96
    return Ts[:, per_bin - 1::per_bin]   # temperature at the end of each 15-minute bin


def test_grid_spec():
    layers = t.unit_layers()
    print(f"\nlayers: {len(layers)}, depth {layers.sum():.2f} skin depths")
    assert layers[0] == pytest.approx(t.GRID_FIRST_FRAC)
    assert np.allclose(layers[1:] / layers[:-1], t.GRID_STRETCH)
    assert layers.sum() >= t.GRID_DEPTH_SKINS
    assert 30 <= len(layers) <= 40, f"{len(layers)} layers, expected 30 to 40"


def test_gate1_analytic_half_space():
    T0, amp = 220.0, 30.0
    grid = t.make_grid(np.array([450.0]))
    n = t.STEPS_PER_SOL
    omega_t = 2.0 * np.pi * np.arange(1, n + 1) / n
    surface = (T0 + amp * np.sin(omega_t))[None, :]
    T_start, _, _, _ = t.spin_up(grid, surface_temp=surface, tol=PERIODIC_TOL_K,
                                 max_sols=PERIODIC_MAX_SOLS)
    _, _, _, prof = t.run_sol(T_start, grid, surface_temp=surface, keep_profiles=True)
    anom = prof[0] - prof[0].mean(axis=0)
    a = 2.0 / n * (anom * np.sin(omega_t)[:, None]).sum(axis=0)
    b = 2.0 / n * (anom * np.cos(omega_t)[:, None]).sum(axis=0)
    node_ratio = np.hypot(a, b) / amp
    node_lag = np.unwrap(np.arctan2(-b, a))
    zeta = grid.z[0] / grid.delta[0]
    for depth in (0.5, 1.0, 2.0):
        ratio = np.exp(np.interp(depth, zeta, np.log(node_ratio)))
        lag = np.interp(depth, zeta, node_lag)
        print(f"\nz = {depth} delta: amplitude ratio {ratio:.5f} (exact {np.exp(-depth):.5f}), "
              f"lag {lag:.5f} rad (exact {depth:.5f})")
        assert ratio == pytest.approx(np.exp(-depth), rel=0.01)
        assert lag == pytest.approx(depth, rel=0.01)


@pytest.mark.parametrize("sol", [LOW_TAU, HIGH_TAU], ids=["low_tau", "high_tau"])
def test_gate1_convergence(sol):
    base = periodic_surface(t.make_grid(TI), t.STEPS_PER_SOL, sol)
    half_dt = periodic_surface(t.make_grid(TI), 2 * t.STEPS_PER_SOL, sol)
    half_dz = periodic_surface(t.make_grid(TI, refine=2), t.STEPS_PER_SOL, sol)
    d_dt = np.abs(half_dt - base).max()
    d_dz = np.abs(half_dz - base).max()
    print(f"\nmax |dTs| over bins: halving dt {d_dt:.4f} K, halving dz {d_dz:.4f} K")
    assert d_dt < 0.1, f"halving dt changed Ts by {d_dt:.4f} K"
    assert d_dz < 0.1, f"halving dz changed Ts by {d_dz:.4f} K"


@pytest.mark.parametrize("sol", [LOW_TAU, HIGH_TAU], ids=["low_tau", "high_tau"])
def test_gate1_energy(sol):
    grid = t.make_grid(TI)
    flux = mars_flux(sol)
    _, Ts, _, _ = t.spin_up(grid, flux_in=flux, tol=PERIODIC_TOL_K, max_sols=PERIODIC_MAX_SOLS)
    net = (flux - t.EPS * t.SIGMA * Ts ** 4).mean(axis=1)
    print(f"\nsol-mean net surface flux: {np.array2string(net, precision=4)} W m^-2")
    assert np.all(np.abs(net) < 0.1), f"sol-mean net surface flux {net} W m^-2"


@pytest.mark.parametrize("sol", [LOW_TAU, HIGH_TAU], ids=["low_tau", "high_tau"])
def test_gate1_spin_up(sol):
    _, _, _, n_sols = t.spin_up(t.make_grid(TI), flux_in=mars_flux(sol))
    print(f"\nspin-up converged in {n_sols} sols")
    assert n_sols <= t.SPINUP_MAX_SOLS


@pytest.mark.parametrize("sol", [LOW_TAU, HIGH_TAU], ids=["low_tau", "high_tau"])
def test_gate1_newton(sol):
    _, _, iters, _ = t.spin_up(t.make_grid(TI), flux_in=mars_flux(sol),
                               tol=PERIODIC_TOL_K, max_sols=PERIODIC_MAX_SOLS)
    print(f"\nlargest Newton iteration count over every step: {iters}")
    assert 1 <= iters <= t.NEWTON_MAX_ITER
