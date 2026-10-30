# 1D Thermal Baseline: Build Steps

Nov 14, 2026 · @Turtle\_Food

## Overview

The baseline is a custom 1D soil heat-conduction model that gives T\_base(x, t) in the heatmap model T = T\_base + f(covariates, LTST, Ls, tau). It is built in seven ordered steps, and each step has a pass condition that must hold before the next one starts. Claude Code works from CLAUDE.md, which holds the rules; this doc is the plan in plain words. 

| Decision | Choice | Why |
| --- | --- | --- |
| Code layout | Solver in `thermal1d.py` with pytest tests; notebooks drive fitting, scoring and plots | Fast iteration and clean imports for the solver; notebooks stay the place you run and inspect results |
| Notebook execution | `jupyter nbconvert --execute` with an explicit kernel name and a long timeout, output to `executed/` | Already installed; the kernel name guarantees the clean environment; source notebooks stay unchanged |
| Shell | Native Windows with Git Bash, not WSL | Reuses the working clean Python environment; WSL would mean rebuilding it |
| Paths | Project root `MarsDataPipeline/`; code reads data through `paths.py` as `processed_data/` | Works from Git Bash, PowerShell and Jupyter alike; nbconvert's working-directory change cannot break it |
| Libraries | numpy for the solver and the fit; pandas and matplotlib in notebooks; scikit-learn and xgboost for Step 5; rasterio and Pillow for the Step 6 export. Additions approved Oct 27-28; the list in CLAUDE.md is the rule | Keeps the solver dependency-free; each addition was approved by the user |

The sealed test blocks (sols 1343-1360 and 3069-3110) stay unread until Step 7. The loader drops them unless a flag is set on purpose.

## Status 
Heatmodel is finished, notes live in `docs/` (`plan.md`, `progress.md`, `discoveries.md`, `closed_ideas.md`). Where this document and `CLAUDE.md` differ, `CLAUDE.md` holds the rule.

## Steps in order

Claude Code stops for your review after Steps 2, 3 and 4. Those are the points where a wrong physics assumption is cheapest to catch. It commits to git after each step passes.

### Step 0. Project setup

**Goal:** a working skeleton that Claude Code can run from end to end.

- Place CLAUDE.md at the root of `MarsDataPipeline/`, with the two briefs copied into `docs/`.
- Create `paths.py`, `thermal1d.py`, `tests/`, `notebooks/`, `executed/` and `outputs/baseline/`.
- Initialise git and add `processed_data/`, `executed/` and `outputs/` to `.gitignore`.
- Fill in the three environment values (see the last section).

**Pass:** `pytest` runs (no tests yet), and an empty notebook executes through nbconvert on the clean kernel.

### Step 1. Solver core and Gate 1

**Goal:** a correct heat-conduction solver, tested before any Mars input.

- The equation is ρc ∂T/∂t = ∂/∂z(k ∂T/∂z), with k = I² / ρc and a constant ρc = 1.2×10⁶ J m⁻³ K⁻¹.
- The grid is scaled to each column's diurnal skin depth (about 5 to 10 cm for your thermal inertia range). The first layer is δ/30, the stretch factor 1.10, and the depth at least 10δ, which gives 37 layers. The original 1.15 failed Gate 1; the change was approved Oct 27.
- Time stepping is fully implicit (backward Euler) with dt = one sol / 960, about 92 s. The surface energy balance is solved by Newton iteration each step, with zero flux at the bottom.
- The tridiagonal solve is vectorized over a batch of columns, so the same code later runs about 530,000 map pixels in chunks.

**Pass (Gate 1):**

1. Sinusoidal surface test: amplitude decays as e^(−z/δ) and the phase lags by z/δ, within 1%.
2. Convergence: halving dt and halving dz each change surface temperature by less than 0.1 K.
3. Energy: in the periodic state, the mean net surface flux over a sol is within 0.1 W/m² of zero.
4. Spin-up: consecutive sols differ by less than 0.01 K, reached within 50 sols.
5. Newton: the surface balance converges within 20 iterations.

### Step 2. Mars forcing and Gate 2

**Goal:** sunlight and sky infrared at each pixel, computed from Ls, LTST, latitude, slope, aspect and tau.

- Solar geometry comes from Ls: declination, Mars–Sun distance, hour angle from LTST, and the incidence angle on a tilted surface. Aspect is the downslope azimuth, clockwise from north.
- Direct light is attenuated by e^(−τ/μ₀). Diffuse light is a fitted fraction g of the scattered part, times the sky view factor (1 + cos s)/2. Sky infrared is a fitted fraction of flat-surface noon sunlight, growing with tau.
- Emissivity is fixed at 0.95, because at night it trades off almost exactly against sky infrared.

**Pass (Gate 2):** computed sun elevation matches `sun_elev_deg` within 0.5°. Computed direct flux matches `flux_flat_wm2` and `flux_tilted_wm2` within 1% wherever the flux is above 20 W/m². A mismatch is reported with its ratio, never tuned away.

**Stop for review.**

### Step 3. Physics-only diagnostic

**Goal:** see what the untuned model gets wrong before fitting hides it.

- Run the model at each training sol's rover pixel with default parameters (g = 0.5, sky IR fraction 0.04, thermal inertia scale 1).
- Compare with REMS ground temperature by LTST bin, by Ls bin and by block.
- Read the errors: night bias points to thermal inertia or sky infrared, midday bias to albedo or diffuse light, and a phase shift to the grid or thermal inertia.

**Pass:** plots and bias tables are saved, with a short written reading of where the model is off. There is no score threshold here.

**Stop for review.**

### Step 4. Fit and leave-one-block-out scoring

**Goal:** three global parameters fitted honestly, and a score you can defend.

- Fit the diffuse fraction g, the sky IR fraction and the thermal inertia scale, inside bounds, with a coarse grid followed by a few Gauss–Newton steps in numpy.
- Refit inside every fold, holding out one training block at a time.
- Exclude from the fit the 29 placeholder-tau sols (scored separately) and sols 3763–3778 (scored with and without).
- Report per-block RMSE, the macro average, pooled RMSE and bias by LTST bin. Report the same for the benchmark: mean REMS ground temperature by LTST bin and 30° Ls bin, built inside the same folds.

**Pass:** results are saved and reported plainly, including whether the baseline beats the benchmark. If it does not, that is the finding; the fix is never to add parameters.

**Stop for review.**

### Step 5. Residual model

**Goal:** learn what the physics misses.

- Learn the REMS-minus-baseline residual with the planned covariates, and repeat the Oct 27 feature ablation on it.
- Outcome: gradient boosting gave a macro RMSE of 5.28 K. A FLANN-style ridge did better, and the map uses its safe form without albedo or TI terms and with clamped covariates (4.86 K). 
- Model air temperature separately, from predicted ground temperature, elevation and time of day. Not started.

**Pass:** leave-one-block-out shows the residual model improves on the baseline alone, with per-block results.

### Step 6. Full-grid prediction and export

**Goal:** the heatmap the web map shows.

- Block-average the static table to about 200 m (718 × 738).
- Run baseline plus residual model at Ls 15, 75, 195, 255 and 340, every 30 minutes of LTST. Tau is the median per-sol tau within ±15° of each Ls, and the map says so.
- Run the 5 Ls in parallel, one process each, locally, with a checkpoint per chunk. Expected time is about 3-4 h.
- Write four formats, matching the `gale_dust_devil_meta.json` georeferencing at 200 m: a cloud-optimized GeoTIFF, a 16-bit PNG, a coloured PNG and raw uint16 binary, plus a manifest. The full specification is in `docs/plan.md`.

**Pass:** the output loads in the map with the right orientation, and the rover pixel matches the model run from Step 4.

### Step 7. Sealed test and write-up

**Goal:** one honest final number.

- Freeze the model, then score sols 1343–1360 and 3069–3110 once. Report that number beside the leave-one-block-out result.
- State the limits: the test measures other years at nearly the same place, not new terrain, and air temperature away from the rover is low confidence.
