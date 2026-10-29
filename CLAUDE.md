# CLAUDE.md: Gale Crater 1D Thermal Baseline

## Project

NASA Space Apps Challenge 2026 (Nov 14-15), "Interplanetary Survival Guide: Martian Map".
This repo builds the physics baseline `T_base(x, t)` for the Gale Crater temperature heatmap:

    T(x, t) = T_base(x, t) + f(covariates(x), LTST, Ls, tau)

`T_base` is a custom 1D soil heat-conduction model, run per pixel. The residual model `f` comes later.
The only in-situ truth is Curiosity's REMS ground temperature at the rover's position.

Background, decisions and past mistakes: `docs/Handover Brief Gale Crater Temperature Heatmap (Oct 26).md` and `Gale Crater Diurnal Temperature Model Plan Summary.pdf` (project root).
Read the relevant section there before changing a rule in this file.

## Current status

Steps 0-4 are done (Oct 28): Gates 1 and 2 pass, and the fitted baseline does not beat the benchmark in leave-one-block-out scoring (macro RMSE 6.72 K vs 5.38 K). Step 5 (residual model) is done for ground temperature (Oct 28). The map uses `flann_safe_no_ti` (user decision Oct 28: FLANN ridge without albedo or TI terms, clamped covariates; LOBO macro 4.86 K against the benchmark's 5.38 K), from `notebooks/residual_flann_lobo.ipynb`. Step 6 (the map): code and dry run done (Oct 28, `map_export.py`, `notebooks/map_run.ipynb`); the full run is next. Its design and status are in `docs/plan.md`.

Project notes in `docs/`, read before starting work:
- `plan.md`: the next step's concrete design.
- `progress.md`: what happened, with scores (newest session first).
- `discoveries.md`: what we learned and the evidence.
- `closed_ideas.md`: what not to try again. Check it before proposing a change.

Update them at the end of each session: append to `progress.md`, `discoveries.md` and `closed_ideas.md`, and rewrite `plan.md` for the next step.

## Scope

**In scope, in this order:**
1. The solver core (`thermal1d.py`).
2. Mars forcing.
3. The physics-only diagnostic against REMS.
4. The global-parameter fit with leave-one-block-out (LOBO) scoring.
5. The residual model for ground temperature (user request, Oct 28; done).
6. The full-grid export (Step 6; user go-ahead Oct 28). Its design is in `docs/plan.md`.

**Out of scope until the user asks:**
- air temperature
- the dust devil layer (parked)
- atmospheric coupling, layered soils, temperature-dependent conductivity, CO2 frost
- the Mars Climate Database as a dependency

Do not add a physics term or a fitted parameter that is not listed in this file. Propose it in the report instead.

## Environment

- Windows, native. Claude Code runs shell commands through Git Bash. Do not use WSL.
- Project root: `MarsDataPipeline/`. Absolute path: `C:\Users\aypen\Downloads\MarsDataPipeline`.
- Python: `C:\Users\aypen\Downloads\MarsDataPipeline\gale-env\Scripts\python.exe`.
- The virtual environment `gale-env/` lives inside the project root. Never edit, search or index it, and keep it out of git.
- Always call the environment's executables by path from the project root: `gale-env/Scripts/python.exe` and `gale-env/Scripts/jupyter.exe`. Never use a bare `python` or `jupyter`: in Git Bash those may resolve to a different Python.
- Jupyter kernel for nbconvert: `gale-env` (registered, confirmed Oct 27).
- Do not install, upgrade or remove packages. If something is missing, stop and report it.
- Allowed libraries:
  - `thermal1d.py` uses numpy only.
  - Notebooks may also use pandas and matplotlib.
  - Step 5 (residual model) may use xgboost and scikit-learn (installed Oct 28 with user approval: xgboost 3.4.1, scikit-learn 1.9.1, which pulled in scipy 1.18.1). Use them in Step 5 code only, never in `thermal1d.py`.
  - Step 6 (map export) may use rasterio 1.5.2 (GeoTIFF) and Pillow 13.0.0 (PNG), both already in `gale-env`; allowed by the user on Oct 28. The export module may also use matplotlib, for the colour scale. Never use them in `thermal1d.py` or `residual.py`.
  - lightgbm and xarray are not installed and are not part of this phase.
  - Installed by request on Oct 27: pytest 9.2.0, nbconvert 7.17.2.
- Past crashes (0xC06D007F) were fixed only by the clean environment. Never run notebooks on the default `python3` kernel.

### Commands

```bash
# tests (Gates 1 and 2)
gale-env/Scripts/python.exe -m pytest tests -q

# execute a notebook into executed/ (sources stay unchanged)
gale-env/Scripts/jupyter.exe nbconvert --to notebook --execute notebooks/<name>.ipynb \
  --output-dir executed \
  --ExecutePreprocessor.timeout=3600 \
  --ExecutePreprocessor.kernel_name=gale-env
```

## Layout

```
MarsDataPipeline/
  CLAUDE.md
  paths.py               # REPO_ROOT, DATA_DIR = REPO_ROOT / "processed_data", OUT_DIR = REPO_ROOT / "outputs" / "baseline", RESIDUAL_OUT_DIR = .../outputs/residual
  thermal1d.py           # grid, solver, surface energy balance, solar geometry, data loader
  tests/test_thermal1d.py
  residual.py            # Step 5: residual-model predictors, learner, benchmark
  map_export.py          # Step 6: static grid, per-Ls worker, residual, map encoders
  notebooks/             # baseline_diagnostic, baseline_fit_lobo, residual_lobo, residual_flann_lobo, ti_sensitivity_lobo, block0_diagnostic, map_run
  executed/              # nbconvert output (git-ignored)
  outputs/baseline/      # CSVs and PNGs (git-ignored)
  outputs/residual/      # Step 5 outputs (git-ignored)
  outputs/map/           # Step 6 map export (git-ignored); formats in docs/plan.md
  processed_data/        # inputs, read-only (git-ignored)
  gale-env/              # virtual environment (git-ignored, never edit)
  docs/                  # the two briefs
```

- Every path comes from `paths.py`. No hard-coded absolute paths, and no paths relative to the working directory. nbconvert runs notebooks with the notebook's own folder as the working directory.
- Use `pathlib` with forward slashes.
- Never write into `processed_data/`.
- Driver notebooks start with `%load_ext autoreload` and `%autoreload 2`, then a single config cell.

## Data contract

Main input: `processed_data/gale_rems_training.csv`. It has 15,523 rows, 50 columns, 319 sols and 11 blocks, one row per REMS 15-minute bin. It is frozen: never hand-edit or hand-join it.

Before writing the loader, read the CSV header and `build_rems_training_table.ipynb`, and record the exact names of:
- the sol column
- the ground-temperature column
- the LTST or bin column
- whether the bin time is the bin start or the bin centre

Do not guess these names.

Recorded Oct 27 (from the header, `build_rems_training_table.ipynb` and `rems_batch.ipynb`):
- sol: `sol`; ground temperature: `ground_temp_k`; time: `bin`, with `ltst_bin_start_hr = bin / 4`.
- Each REMS value is the mean of 1 Hz readings over [start, start + 15 min), so the model is compared at the bin **centre**, `ltst_bin_start_hr + 0.125`.
- `ltst_bin_center_hr` is rounded to 0.01 h (up to 0.005 h off). The table's `flux_*` and `sun_elev_deg` columns were computed at that rounded value and the rover `latitude_deg`; Gate 2 uses the same LTST so the check isolates the formulas.

### Columns used

| Group | Columns |
|---|---|
| Season | `ls_deg` |
| Rover pixel | `row`, `col`, `pixel_id` |
| Static covariates | `slope_deg`, `aspect_deg`, `ti_themis_tiu`, `albedo_mean`, `elev_dem_m` |
| Gate 2 cross-check | `sun_elev_deg`, `flux_flat_wm2`, `flux_tilted_wm2` |
| Dust | `tau`, `tau_source`, `tau_is_placeholder` |
| Bookkeeping | `ground_missing`, `core_sol`, `block`, `split_role` |

### Latitude

Compute latitude at the pixel centre from `row`, using the transform in `gale_dust_devil_meta.json`:

    lat = -4.148577212911933 + (row + 0.5) * (-0.0016870993139129456)

### Conventions

- Temperatures in K, LTST in hours, Ls in degrees.
- Aspect is the **downslope azimuth, clockwise from north** (confirmed against the traverse). Never flip or mirror it.
- One sol P = 88,775.244 s. A 15-minute LTST bin is P/96 seconds, and bin 48 is noon.

### Loader rules

- Rows with `split_role == "test"` are dropped unless `allow_test=True`. Never set that flag unless the user explicitly says to score the sealed test.
- Rows with `ground_missing` are dropped from scoring. Print how many.

## Physics spec

### Soil column

    rho_c * dT/dt = d/dz ( k * dT/dz ),    k = I^2 / rho_c

- `rho_c = 1.2e6` J m^-3 K^-1, constant.
- `I = ti_themis_tiu * TI_SCALE` (J m^-2 K^-1 s^-1/2).
- Homogeneous column. Conductivity does not depend on temperature.
- Bottom boundary: zero flux.

### Surface energy balance

Solved by Newton iteration on T_s each step:

    (1 - A) * Q_sw + eps * L_sky - eps * sigma * T_s^4 + k * dT/dz|_0 = 0

- `A = albedo_mean`.
- `eps = 0.95`, **fixed**. At night it is nearly degenerate with sky IR. Values 0.90 to 1.00 are allowed only as a reported sensitivity run.
- `sigma = 5.670374e-8`.

### Solar geometry

Compute it in code, not from the table columns.

- Obliquity 25.19 deg, eccentricity e = 0.0934, a = 1.5237 AU, Ls of perihelion = 251 deg.
- Declination: `dec = asin(sin(25.19 deg) * sin(Ls))`.
- Sun distance: `r = a * (1 - e^2) / (1 + e * cos(Ls - 251 deg))`.
- Top-of-atmosphere flux: `S0 = 1361 / r^2` W m^-2.
- Hour angle: `h = 15 deg * (LTST - 12)`.
- `mu0 = cos(zenith) = sin(lat) sin(dec) + cos(lat) cos(dec) cos(h)`. All sunlight is 0 when `mu0 <= 0`.
- Tilted incidence: `cos_i = cos(s) * mu0 + sin(s) * sin(zenith) * cos(az_sun - aspect)`, clipped at 0.

### Sunlight at the surface

- Direct: `S0 * cos_i * exp(-tau / mu0)`.
- Diffuse: `G_DIFF * S0 * mu0 * (1 - exp(-tau / mu0)) * (1 + cos(s)) / 2`.
- `Q_sw` = direct + diffuse.

### Sky infrared

Constant within a sol:

    L_sky = F_IR * S0 * mu0_noon_flat * (1 + B_TAU * tau) * (1 + cos(s)) / 2

- `B_TAU = 1.0`, fixed. Report a sensitivity run with B_TAU in {0, 2}.

### Tau

- Use the per-sol `tau` column. Rows with `tau_is_placeholder` are run but excluded from fitting (see Validation).
- Each sol is run at its own Ls and tau, held fixed within the sol.

### Fitted global parameters

Only these three. Each must stay inside its bounds, and a fit that lands on a bound is reported as such.

| Parameter | Default | Bounds |
|---|---|---|
| `G_DIFF` | 0.5 | [0.0, 1.0] |
| `F_IR` | 0.04 | [0.0, 0.15] |
| `TI_SCALE` | 1.0 | [0.7, 1.3] |

## Numerics

- **Skin depth:** `delta = sqrt(k * P / (pi * rho_c))`, per column.
- **Grid:**
  - first layer thickness `delta / 30`
  - geometric stretch factor 1.10 (1.15 gave 28 layers and failed the Gate 1 half-space amplitude at 2 delta by 1.18%; changed Oct 27 with user approval)
  - total depth at least `10 * delta`
  - expected 30 to 40 layers
- **Time stepping:**
  - fully implicit (backward Euler), `dt = P / 960`, so 10 steps per 15-minute bin
  - Newton on the surface node, at most 20 iterations, tolerance 1e-6 W m^-2
  - assert convergence; never continue silently
- **Spin-up:**
  - start from the radiative-equilibrium mean temperature
  - repeat sols until the maximum |dT| between consecutive sols is under 0.01 K at all depths
  - after each unconverged sol, shift the whole column so the deepest node equals that sol's mean surface temperature (zero shift in the periodic state; without it spin-up took about 60 sols; added Oct 27 with user approval)
  - assert this happens within 50 sols
- **Vectorization:**
  - vectorize the tridiagonal (Thomas) solve over a batch of columns, shape `(n_columns, n_layers)`
  - the same function must later run about 530,000 pixels in chunks
- **Precision:** float64 inside the solver.
- **Model output:** temperature at the same LTST convention as the REMS bins (start or centre, as recorded from the data contract check).

## Verification gates (must pass before the next stage)

### Gate 1: solver, in `tests/test_thermal1d.py`

1. **Analytic half-space.** Impose surface `T = T0 + A sin(2 pi t / P)`.
   - At depths 0.5, 1 and 2 delta, amplitude ratio = `exp(-z/delta)` within 1%.
   - Phase lag = `z/delta` rad within 1%.
2. **Convergence.** On a realistic Mars sol, halving dt changes surface T by less than 0.1 K at every bin, and so does halving every layer thickness.
3. **Energy.** In the periodic state, the sol-mean net surface flux has an absolute value under 0.1 W m^-2.
4. **Spin-up.** Converges as defined in Numerics.
5. **Newton.** Converges within 20 iterations at every step of a high-tau sol and a low-tau sol.

### Gate 2: forcing, also in tests, run against real table rows

1. Computed sun elevation within 0.5 deg of `sun_elev_deg`.
2. Computed direct flux (flat and tilted) within 1% of `flux_flat_wm2` and `flux_tilted_wm2`, wherever the table flux is above 20 W m^-2.

If Gate 2 fails, report the ratio and its pattern (by Ls or LTST) and stop. Do not change constants to make it pass.

Never report a gate as passed without having run it in this session. Paste the pytest summary line.

## Validation protocol

### Folds and exclusions

- Folds: leave-one-block-out over the blocks with `split_role == "train"`. That is currently 9 blocks: 0, 1, 2, 3, 5, 6, 7, 9, 10.
- Refit the three parameters inside every fold, on the training blocks of that fold only.
- Exclude from fitting:
  - rows with `tau_is_placeholder` (29 sols)
  - sols 3763-3778, whose DEM slope and elevation are suspect
- Score both excluded groups separately. Report sols 3763-3778 with and without.

### Fitting

A coarse grid over the bounds, then a few finite-difference Gauss-Newton steps, written in numpy. Warm-start spin-up from the previous evaluation.

### Benchmark

The mean REMS ground temperature per (LTST bin, 30-degree Ls bin), built from each fold's training rows only. If a cell is empty, use that fold's LTST-bin mean over all Ls, and report how many rows used it.

### Metrics

Report all of these, for the baseline and the benchmark side by side:
- per-block RMSE
- the macro average across blocks (the headline number)
- pooled RMSE
- bias and RMSE by LTST bin (hourly)
- bias by 30-degree Ls bin

Reference yardstick, not a target: a simple tree model scored 4.3-6.7 K per block (macro 5.3 K).

### Outputs

Write CSVs and PNGs to `outputs/baseline/`, and the fitted parameters per fold to `outputs/baseline/fit_params.csv`.

If the baseline does not beat the benchmark, say so plainly. The response is never to add parameters or tune toward the score.

### Sealed test

Blocks 4 and 8 (sols 1343-1360, 3069-3110) are not read, scored or plotted in this phase.

## Workflow

1. Work in the order of the Scope list.
2. Commit after each gate or step passes, with a message naming the gate.
3. **Stop and report to the user after:**
   - Gates 1 and 2
   - the physics-only diagnostic (default parameters, no fit)
   - LOBO scoring
4. The diagnostic notebook runs with default parameters only. Its report reads the errors by type: night bias points to TI or sky IR, midday bias to albedo or diffuse light, a phase shift to the grid or TI.

## Code style

- No defensive try/except and no silent fallbacks. Let errors raise.
- Use `assert` with a message for every invariant, for example `assert np.all(np.isfinite(T)), "non-finite temperature after step"`.
- No hidden defaults: every constant is named at the top of `thermal1d.py` with its units.
- Functions take arrays and return arrays. No global state.
- Notebooks: one config cell at the top, then the run, then results. Notebooks contain no solver logic.

## Reporting style

- Lead with an objective assessment: what worked, what failed, and the risks or doubtful assumptions, weighted equally. No flattery and no filler.
- Give numbers with units. Separate measured results from expectations.
- Hold a technical position unless given new, verifiable evidence.

## Anti-patterns

**Validation**
- Do not report random-row or whole-sol scores as skill. Use whole blocks only.
- Do not present the sealed test as spatial extrapolation. Both test blocks lie within 1 km of training positions.
- Do not use pooled RMSE alone. Sols 1-170 dominate the training rows.

**Geometry and data**
- Do not unpack `~transform * (lon, lat)` as `(row, col)`. It returns `(col, row)`.
- Do not treat `flux_flat_wm2` and `flux_tilted_wm2` as total sunlight. They are direct beam only.
- Do not extrapolate tau beyond the table. The placeholder rows stay flagged.
- Do not assume 48 bins per sol. There are up to 96 (15-minute bins).
- Do not trust the slope and elevation covariates for sols 3763-3778.

**Model**
- Do not fit emissivity together with sky IR.
- Do not use the Mars Climate Database as the baseline.

**Environment**
- Do not multiply large float32 arrays by float64 numpy scalars (NumPy 2 doubles the memory); use `np.float32(x)`. This matters later, for the grid export.
- Do not load whole large rasters. Steps 1-5 need none, since the training table carries every covariate. Step 6 reads the 100 m feature table (`gale_dust_devil_features_100m.csv`) by column and writes rasters; it never opens the 20 m DEM, slope or aspect rasters.
