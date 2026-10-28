# Progress: What Happened, With Scores

The newest session goes at the top. What we learned goes in `discoveries.md`, what not to retry goes in `closed_ideas.md`, and the next step goes in `plan.md`.

## Session 2d (Oct 28, 2026): map-safe FLANN (no albedo terms, clamped covariates)

User request (both fixes). `residual_flann_lobo.ipynb` now scores four variants; rules fixed in the notebook before the run. Clamping: TI, slope, albedo and the baseline (as a predictor) clipped to the fold's training-row 1st-99th percentiles in training and prediction, so the LOBO score is the map pipeline's score. Configurations tried: 8 in total.

**Result: `flann_safe` (no albedo, clamped) passes the rule** (macro gain 0.54 K over `no_elev`, better in 8 of 9 blocks) **and is the chosen residual model for the map.**

| | Benchmark | `no_elev` (trees) | `flann` | `flann_clamped` | `flann_no_albedo` | `flann_safe` |
|---|---|---|---|---|---|---|
| Macro RMSE, 9 blocks | 5.38 | 5.28 | 4.86 | 4.86 | 4.72 | **4.74** |
| Macro, without sols 3763-3778 | 5.37 | 5.43 | 4.95 | 5.00 | 4.80 | 4.87 |
| Macro, without block 0 | 5.43 | 4.84 | 4.57 | 4.49 | 4.45 | 4.40 |
| Pooled RMSE, main rows | 5.51 | 6.55 | 5.83 | 6.01 | 5.63 | 5.82 |
| Placeholder-tau rows | 4.39 | 4.73 | 4.19 | 4.29 | 4.11 | 4.14 |
| Block 0 RMSE | 5.04 | 8.79 | 7.23 | 7.82 | 6.86 | 7.46 |
| Blocks beating the benchmark | - | 5 | 5 | 5 | 7 | 7 |

`flann_safe` per block (RMSE / bias, K): 0: 7.46 / +2.58; 1: 2.86 / -0.28; 2: 5.36 / +0.86; 3: 2.64 / -0.20; 5: 5.54 / +0.11; 6: 5.37 / -1.82; 7: 4.33 / -1.51; 9: 5.38 / +1.62; 10: 3.72 / -0.29.

Largest hourly spread of the predicted residual, all-blocks `flann_safe`: TI 10.4 K at night (same inside and beyond the rover range, since clamped), slope 2.4 K, albedo 0. Clamp ranges: TI 361-682 tiu, slope 1.25-12.27 deg, baseline 183-284 K (`outputs/residual/flann_safe_clamp_ranges.csv`). Night bias at 22-03 h is still +1.8 to +2.5 K on main rows.

## Session 2c (Oct 28, 2026): second learner, FLANN-style ridge

User request (plan option 1). `notebooks/residual_flann_lobo.ipynb` (about 1 min); basis and ridge in `residual.py` (39 columns, alpha 1.0 on standardized columns), fixed in `plan.md` before the run. Same fold baselines (reproduced exactly), training rows and benchmark as Step 5. Configuration 5.

**Decision rule: adopt FLANN** (macro gain 0.42 K, need 0.2; better in 7 of 9 blocks, need 5). **But it is not safe for the map as it stands** (see the effects table).

| | Baseline | Benchmark | `no_elev` (trees) | FLANN |
|---|---|---|---|---|
| Macro RMSE, 9 blocks | 6.72 | 5.38 | 5.28 | **4.86** |
| Macro, without sols 3763-3778 | 6.65 | 5.37 | 5.43 | 4.95 |
| Macro, without block 0 | 6.40 | 5.43 | 4.84 | 4.57 |
| Pooled RMSE, main rows | 7.47 | 5.51 | 6.55 | 5.83 |
| Placeholder-tau rows | 5.77 | 4.39 | 4.73 | 4.19 |
| Block 0 RMSE | 9.24 | 5.04 | 8.79 | 7.23 |
| Blocks beating the benchmark | 1 | - | 5 | 5 |

Per block, FLANN vs `no_elev`: 0: 7.23 vs 8.79; 1: 2.99 vs 3.30; 2: 5.41 vs 5.99; 3: 2.77 vs 3.63; 5: 5.72 vs 5.08; 6: 5.48 vs 5.79; 7: 4.37 vs 4.64; 9: 5.67 vs 6.18; 10: 4.14 vs 4.12.

Largest hourly spread of the predicted residual (all-blocks model):

| Covariate | Rover range | Spread | Extended range | Spread |
|---|---|---|---|---|
| TI | 361-682 tiu | 10.2 K (23 h) | 300-750 tiu | 14.3 K |
| Slope | 1.3-12.3 deg | 1.8 K | 0-30 deg | 5.0 K |
| Albedo | 0.24-0.26 | 2.1 K | 0.10-0.35 | **29.3 K** (07 h) |

Fold-0 model (no block 0) at night: +0.28 K at TI 450, -0.15 K at 514, -0.85 K at 620 tiu. Block 0 night bias +6.4 K (trees +9.2 K).

## Session 2b (Oct 28, 2026): `ti_scale` sensitivity run (lower bound 0.5)

User request. `notebooks/ti_sensitivity_lobo.ipynb` (about 13 min) repeats the Step 4 fold fits with `ti_scale` in [0.5, 1.3], then the Step 5 residual model on the new fold baselines (configuration not re-selected). Outputs in `outputs/ti_sensitivity/`. Not the headline. `fit_global_params` gained a `bounds` argument (default: spec bounds); tests rerun: `13 passed in 101.81s`.

**Result: the 0.7 bound was not what held the fit back.** Fitted `ti_scale` is 0.69-0.88; only fold 5 goes below 0.7 (0.691, was on the bound at 0.700). No fold lands on the new bound.

| | Headline | `ti_scale` >= 0.5 |
|---|---|---|
| Baseline macro RMSE | 6.72 K | 6.73 K |
| `no_elev` macro RMSE | 5.28 K | 5.27 K |
| `no_elev` macro, without sols 3763-3778 | 5.43 K | 5.39 K |
| `no_elev` pooled RMSE, main rows | 6.55 K | 6.52 K |
| Block 0, `no_elev` RMSE (benchmark 5.04 K) | 8.79 K | 8.77 K |
| Block 0, `no_elev` night bias (19-06 h) | +9.13 K | +9.28 K |
| Other blocks, baseline night bias (19-06 h) | -3.22 K | -3.28 K |

## Session 2 (Oct 28, 2026): Step 5, residual model

`notebooks/residual_lobo.ipynb` (about 75 s) with `residual.py`; outputs in `outputs/residual/`. The learner is scikit-learn `HistGradientBoostingRegressor` with fixed settings (300 rounds, rate 0.05, 15 leaves, min 50 rows per leaf, L2 1.0), not tuned. The decision rule was written into the notebook before the run. 4 configurations were tried, 1 learner setting.

Checks: fold baselines reproduce Step 4's out-of-fold `baseline_k` within 0.019 K, and the benchmark matches Step 4 exactly.

**Result: baseline + residual beats the benchmark only on the headline macro, by 0.10 K, and loses on every other aggregate.**

| | Baseline | Benchmark | `no_elev` (chosen) | `full` | `time_only` | `no_elev_flux` |
|---|---|---|---|---|---|---|
| Macro RMSE, 9 blocks | 6.72 | 5.38 | **5.28** | 5.21 | 5.62 | 5.32 |
| Macro, without sols 3763-3778 | 6.65 | 5.37 | 5.43 | 5.35 | 5.66 | 5.42 |
| Pooled RMSE, main rows | 7.47 | 5.51 | 6.55 | 6.38 | 6.76 | 6.60 |
| Placeholder-tau rows | 5.77 | 4.39 | 4.73 | 4.26 | 5.27 | 4.86 |
| Blocks beating the benchmark | 1 | - | 5 | 6 | 5 | 5 |

Decision rule outcome: static covariates adopted (0.34 K gain); elevation rejected (0.07 K gain, under the 0.2 K bar, though better in 6 of 9 blocks); flux term rejected (0.04 K worse). Rule 4 says a second learner is justified (gap -0.10 K, inside the 0.3 K window); not run, pending the user.

| Held-out block | Baseline | Benchmark | `no_elev` | `no_elev` bias |
|---|---|---|---|---|
| 0 (1-170) | 9.24 | 5.04 | 8.79 | +4.76 |
| 1 | 4.05 | 5.19 | 3.30 | +0.43 |
| 2 | 6.69 | 5.59 | 5.99 | +1.37 |
| 3 | 6.07 | 4.01 | 3.63 | -1.65 |
| 5 | 7.62 | 5.54 | 5.08 | -1.39 |
| 6 | 7.89 | 7.83 | 5.79 | -2.85 |
| 7 | 4.71 | 4.33 | 4.64 | -2.13 |
| 9 | 6.94 | 5.42 | 6.18 | +2.90 |
| 10 (3763-3778) | 7.26 | 5.51 | 4.12 | +0.72 |

Partial-dependence range of the residual over the rover's covariate values (`no_elev`): TI 1.76 K, aspect 1.80 K, albedo 1.04 K, slope 0.77 K. Night hours (17-23 h) gained a +1.5 to +2.2 K warm bias that the baseline did not have.

## Session 1 (Oct 27-28, 2026)

Steps 0-4 of `1D Thermal Baseline Build Steps.md` are done and committed locally. Nothing from this session is pushed to GitHub; only `docs/` and `.vscode/` were pushed to `Plehndm/NASA-Space-Apps-Phobos` (`MarsDataPipline/`).

| Step | Result | Commit |
|---|---|---|
| 0. Setup | `CLAUDE.md` moved to root, `paths.py`, `pytest.ini`, folders; pytest and nbconvert run on the `gale-env` kernel | `86da84b`, `b9522bc` |
| 1. Gate 1 (solver) | All 5 checks pass after two approved spec changes (see `discoveries.md`) | `ba30773` |
| 2. Gate 2 (forcing) | Sun elevation within 0.0008 deg, direct flux within 0.0063% | `033ce88` |
| 3. Physics-only diagnostic | Main rows: bias -6.33 K, pooled RMSE 12.83 K, macro 12.67 K | `b55705d`, `eee651f` |
| 4. Fit + LOBO | **Baseline does not beat the benchmark** (below) | `b080ca4` |

Full test suite: `13 passed` (about 75 s).

### Gate 1 (stretch 1.10, spin-up shift)

| Check | Limit | Measured |
|---|---|---|
| Half-space amplitude at 0.5 / 1 / 2 delta | 1% | -0.12% / -0.28% / -0.77% |
| Half-space phase lag | 1% | within 0.04% |
| Halving dt / halving every layer | 0.1 K | 0.032 K / 0.021 K |
| Sol-mean net surface flux | 0.1 W m^-2 | at most 0.0002 |
| Spin-up | 50 sols | 11-13 sols |
| Newton iterations | 20 | at most 2 |

### Step 4: leave-one-block-out (9 training blocks)

| | Baseline | Benchmark |
|---|---|---|
| Macro RMSE, 9 blocks | 6.72 K | 5.38 K |
| Macro RMSE, without sols 3763-3778 | 6.65 K | 5.37 K |
| Pooled RMSE, main rows | 7.47 K | 5.51 K |
| Placeholder-tau rows | 5.78 K | 4.39 K |

| Held-out block (sols) | Baseline RMSE | Benchmark RMSE | Baseline bias |
|---|---|---|---|
| 0 (1-170) | 9.25 | 5.04 | +4.06 |
| 1 (365-375) | **4.05** | 5.19 | -1.92 |
| 2 (584-865) | 6.69 | 5.59 | +0.42 |
| 3 (1160-1165) | 6.07 | 4.01 | -5.51 |
| 5 (1650-1865) | 7.62 | 5.54 | -5.69 |
| 6 (2550-2673) | 7.90 | 7.83 | -6.38 |
| 7 (2871-2968) | 4.71 | 4.33 | -0.96 |
| 9 (3550-3655) | 6.94 | 5.42 | +1.18 |
| 10 (3763-3778) | 7.27 | 5.51 | -6.51 |

Fitted parameters: `g_diff` 0.77-0.88, `f_ir` 0.027-0.034, `ti_scale` 0.70-0.87 across folds. `ti_scale` is on its 0.7 bound in fold 5. All-blocks fit: 0.82, 0.031, 0.74 (`outputs/baseline/fit_params.csv`).

### Environment

- `gale-env` additions (user-approved): pytest 9.2.0 and nbconvert 7.17.2 (Oct 27); xgboost 3.4.1, scikit-learn 1.9.1 and scipy 1.18.1 (Oct 28). numpy 2.5.4 and pandas 3.1.0 unchanged.
- Jupyter kernel `gale-env` registered (runs `gale-env\Scripts\python.exe`). The old `python3` kernel still exists; do not use it.

### Outputs

`outputs/` and `executed/` are git-ignored. Regenerate them with nbconvert (commands in `CLAUDE.md`):

- `notebooks/baseline_diagnostic.ipynb` (about 1 min) writes `diagnostic_*.csv/png`.
- `notebooks/baseline_fit_lobo.ipynb` (about 30 min) writes `fit_params.csv`, `lobo_*.csv/png` and `lobo_rows.csv` (every out-of-fold baseline and benchmark prediction). It logs each fold to `lobo_progress.log` as it runs.

### Housekeeping

- `1D Thermal Baseline Build Steps.md` still says stretch "about 1.15"; `CLAUDE.md` holds the rule.
- The git author email in the user's config reads `aypeng2019#gmail.com` (`#` for `@`).
