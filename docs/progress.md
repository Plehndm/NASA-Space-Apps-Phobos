# Progress: What Happened, With Scores

The newest session goes at the top. What we learned goes in `discoveries.md`, what not to retry goes in `closed_ideas.md`, and the next step goes in `plan.md`.

## Session 3 (Oct 28, 2026): Step 6 code and dry run

Code: `map_export.py` (static grid, `run_ls` worker with checkpoints, residual, encoders A-D and decode checks) and `notebooks/map_run.ipynb` (`MODE = "dry"` or `"full"`). `paths.MAP_OUT_DIR` added. Gates re-run: `13 passed in 76.23s`. Dry run executed into `executed/map_run_dry.ipynb`, outputs in `outputs/map/dryrun/`.

Checks, all passed:

| Check | Result |
|---|---|
| Tau per Ls vs the plan table | Exact (0.78, 0.49, 0.69, 1.09, 1.11) |
| All-blocks parameters | 0.8193 / 0.0312 / 0.7396, none on a bound |
| Residual refit: clamp ranges vs Step 5's `flann_safe_clamp_ranges.csv` | Match; 12,181 fitting rows, 33 basis columns |
| Map code path vs the Step 4 model, rover, one sol near each map Ls | Max 0.0066 K (limit 0.05 K) |
| Decoded A, B, D vs the float32 master | 0.005 K (quantization), same nodata pattern |
| Decoded C vs the master | 0.294 K, half a colour step (step 0.59 K) |
| Rover lat/lon lands on 200 m pixel (152, 186) in the COG and through the manifest transform | Yes |

Grid: 148 of 2,120,972 100 m pixels are absent from the feature table (not NaN, missing rows), so 76 of 529,884 200 m pixels are nodata.

Runs (5 workers in parallel):

| Run | Pixels per Ls | Chunk | ms/col per worker | Peak MB per worker | Spin-up sols |
|---|---|---|---|---|---|
| Rover window, 100 x 110 | 11,000 | 10,000 | 38.4 | 744-944 | 13-14 |
| Crater sample, every 20th pixel | 1,332 | 1,332 | 21.9 | 263 | 13-14 |
| Benchmark (scratch) | 2 chunks each | 250 / 500 / 1,000 / 2,000 / 4,000 | 28.6 / 16.8 / 13.4 / 18.3 / 23.4 | 174-484 | - |

**Chunk size changed to 1,000 columns** (plan said 10,000): full-grid estimate about 2.0 h wall time (529,808 pixels x 13.4 ms), before thermal throttling, against 5.8 h at 10,000. One worker alone ran 11.6 ms/col, so 5 workers are mostly bandwidth-bound at large chunks.

Temperatures on the crater sample (map = baseline + residual): 159 K (Ls 75, night) to 312 K (Ls 195, afternoon). Residual range -17.5 to +17.0 K. Colour scale 150-300 K clips 2.2% of pixel-frames at Ls 195 and 0.5% at Ls 255 (above 300 K); none below. Clamped (pixel-frames, crater sample): slope 29.7%, baseline 9-31%; TI 81.7% and albedo 81.2% clamped but not terms of the model.

Sizes, rover window (11,000 px, 48 frames, per Ls): A 0.77 MB, B 0.74 MB, C 0.60 MB, D 1.01 MB. Scaled to the full grid (48x the pixels): about 37 / 36 / 29 / 48 MB per Ls, about 750 MB in all; real terrain compresses less evenly, so this is a rough figure.

### Full run (Oct 28, 17:49-20:00)

Colour range for C widened to 150-320 K first (user decision). `MODE = "full"`, executed into `executed/map_run_full.ipynb`, outputs in `outputs/map/`.

- **Baseline:** 529,808 pixels x 5 Ls, 530 chunks each, wall time 7,769 s (2.16 h). Per worker: 13.9-14.7 ms/col, peak memory 278-291 MB, spin-up 11-14 sols per chunk. No crash, no restart.
- **All checks pass:** rover reproduction 0.0066 K; A, B and D decode within 0.005 K with the same nodata pattern; C within 0.333 K (half a colour step of 0.67 K); the rover lands on pixel (152, 186) in the COG and through the manifest.

| Ls | tau | T min | T p1 | T p99 | T max | Residual range | Baseline clamped |
|---|---|---|---|---|---|---|---|
| 15 | 0.78 | 169.7 | 181.3 | 282.6 | 292.9 | -11.4 to +18.1 | 10.3% |
| 75 | 0.49 | 151.5 | 167.8 | 270.5 | 279.7 | -10.4 to +21.5 | 31.2% |
| 195 | 0.69 | 175.4 | 185.9 | 302.2 | 313.1 | -17.2 to +14.9 | 18.4% |
| 255 | 1.09 | 181.6 | 189.9 | 298.6 | 310.1 | -18.8 to +16.0 | 18.8% |
| 340 | 1.11 | 178.6 | 188.5 | 288.8 | 299.8 | -15.1 to +18.3 | 9.5% |

(K; clamped = fraction of pixel-frames.) Nothing falls outside 150-320 K. Slope is clamped in 28.4% of pixels; TI (81.9%) and albedo (81.4%) are clamped but are not model terms.

Sizes: COG 206 MB, 16-bit PNG 178 MB, coloured PNG 134 MB, raw 243 MB (761 MB in all). `master/` holds 1.5 GB (baseline and map float32, plus 2,650 chunk files).

The 14:00 preview shows a faint vertical band near the middle columns. Column means show no sharp jump in the map (largest 0.66 K between neighbouring columns, typical 0.12 K) or in TI, slope or albedo. It may come from the coarse native albedo grid; not checked.

### After the run (Oct 28)

- **QGIS check passed** (user): `gale_tsurf_ls195.tif` lands on Gale. Step 6 is complete.
- **Fix:** `run_ls` now reuses a merged `master/ls{LLL}_base.npy` instead of relying on the chunk files, so the chunk files can be deleted without forcing a 2 h rerun. Checked: rerunning Ls 15 returned at once and logged the reuse.

## Session 2g (Oct 28, 2026): Step 6 decisions (user)

- **Residual for the map: `flann_safe_no_ti`** (TI terms dropped; see Session 2f).
- **Ls values: 15, 75, 195, 255, 340 deg.**
- **Tau: the median per-sol tau within +-15 deg of each Ls** (0.78, 0.49, 0.69, 1.09, 1.11), placeholder sols excluded.
- **Output formats: all four web-ready options**, which are a cloud-optimized GeoTIFF, a 16-bit PNG, a coloured PNG and raw uint16 binary. The specification is in `plan.md`.
- **`rasterio` 1.5.2 and Pillow 13.0.0 are allowed for Step 6** (both were already installed in `gale-env`). `CLAUDE.md` is updated: the residual model and full-grid export are in scope, and air temperature stays out.
- **Frame spacing: every 30 min** (48 frames per Ls).
- **The 5 Ls values run in parallel, one process each, locally on this laptop.** The Claude cloud is not used (user decision). Expected wall time is about 3-4 h, against about 11 h serial; this is an estimate to confirm in the dry run.
- Step 6 has not started: the user will run it later.

## Session 2f (Oct 28, 2026): residual with and without TI terms (map sensitivity, part 1)

User request (plan option: map with and without the residual's TI terms). The map itself (Step 6) was **not** produced: it needs the Ls values, a tau per map Ls and the output format (open questions), and about 2 h of solver time per Ls. Done instead: configuration 9, `flann_safe_no_ti` (sensitivity only, never selected), in `residual_flann_lobo.ipynb`, and a crater-wide estimate of the difference from the 100 m feature table's TI column (no solver run).

| | `flann_safe` | `flann_safe_no_ti` | Benchmark |
|---|---|---|---|
| Macro RMSE, 9 blocks | 4.74 K | 4.86 K | 5.38 K |
| Macro, without sols 3763-3778 | 4.87 K | 4.99 K | 5.37 K |
| Pooled RMSE, main rows | 5.82 K | 5.83 K | 5.51 K |
| Block 0 | 7.46 K | 7.34 K | 5.04 K |
| Blocks 1 / 2 / 3 | 2.86 / 5.36 / 2.64 K | 3.30 / 5.56 / 3.12 K | |

**Crater THEMIS TI vs the rover's range:** percentiles 1/5/25/50/75/95/99 = 171/197/234/281/336/451/541 tiu. **81.7% of the 2.12 million pixels lie below the clamp minimum (361 tiu)**; 0.1% above 682.

`flann_safe` minus `flann_safe_no_ti` (TI part only, other inputs at the rover's distribution): night mean +3.3 K at 361 tiu, +0.4 K at 481, -4.5 K at 682 (largest at any hour 4.5 / 1.1 / 6.7 K). Over crater pixels: 92% differ by more than 2 K at night, none by more than 5 K at night, 0.2% by more than 5 K at some hour. Median pixel: +3.3 K at night (clamped at 361 tiu).

## Session 2e (Oct 28, 2026): block 0 diagnostic (does TI explain sols 1-170?)

User request. `notebooks/block0_diagnostic.ipynb` (about 9 min), outputs in `outputs/block0_diagnostic/`. **A diagnostic, not a fit:** in-sample scans with `g_diff` at the all-blocks fit; nothing enters the baseline. Main rows only.

**Result: yes, TI explains block 0, and sky IR does not.** Night, day and diurnal amplitude all point to the same scale (0.50, 0.60, 0.54), so block 0 behaves like ground with about 350 tiu, not THEMIS's 637 tiu.

| Block | THEMIS TI mean (tiu) | Best scale, all hours | Night | Day | Amplitude match | Implied TI (tiu) | RMSE at best (K) |
|---|---|---|---|---|---|---|---|
| 0 | 637 | 0.55 | 0.50 | 0.60 | 0.54 | 350 | 5.59 |
| 1 | 463 | 0.80 | 0.85 | 0.80 | 0.78 | 370 | 3.64 |
| 2 | 458 | 0.80 | 0.75 | 0.85 | 0.77 | 367 | 6.35 |
| 3 | 465 | 0.75 | 0.95 | 0.60 | 0.76 | 349 | 6.00 |
| 5 | 386 | 0.85 | 1.00 | 0.75 | 0.77 | 328 | 6.64 |
| 6 | 501 | 0.80 | 1.00 | 0.60 | 0.73 | 401 | 7.54 |
| 7 | 473 | 0.80 | 0.80 | 0.75 | 0.75 | 378 | 4.48 |
| 9 | 399 | 0.90 | 0.85 | 1.00 | 0.93 | 360 | 5.55 |
| others pooled | | 0.85 | 0.85 | 0.80 | 0.79 | 382 | 6.12 |

(Block 10 has no main rows.) Scan step 0.05.

`ti_scale` x `f_ir` (step 0.1 x 0.01): block 0's best is `f_ir` 0.030, `ti_scale` 0.60 (RMSE 5.68 K); the other blocks' best is `f_ir` 0.030, `ti_scale` 0.80 (6.22 K). Both match the global `f_ir` (0.031). Fixing block 0's nights with sky IR alone (`f_ir` 0.01 at `ti_scale` 0.7) leaves a -8.8 K day bias and RMSE 8.7 K.

At its best scale block 0 still has a shape error: +2 to +4 K at 11-14 h and -5 K at 18-19 h (the model peaks too hot and cools too fast in the evening).

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

- `1D Thermal Baseline Build Steps.md` said stretch "about 1.15"; fixed to 1.10 on Oct 28.
- The git author email in the user's config reads `aypeng2019#gmail.com` (`#` for `@`).
