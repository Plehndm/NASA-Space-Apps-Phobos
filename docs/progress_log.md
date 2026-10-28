# Progress Log: 1D Thermal Baseline

## Session 1 (Oct 27-28, 2026)

### Status

Steps 0-4 of `1D Thermal Baseline Build Steps.md` are done and committed locally. **Next: Step 5, the residual model.** Nothing from this session is pushed to GitHub; only `docs/` and `.vscode/` were pushed to `Plehndm/NASA-Space-Apps-Phobos` (`MarsDataPipline/`).

| Step | Result | Commit |
|---|---|---|
| 0. Setup | `CLAUDE.md` moved to root, `paths.py`, `pytest.ini`, folders; pytest and nbconvert run on the `gale-env` kernel | `86da84b`, `b9522bc` |
| 1. Gate 1 (solver) | All 5 checks pass after two approved spec changes (below) | `ba30773` |
| 2. Gate 2 (forcing) | Sun elevation within 0.0008 deg, direct flux within 0.0063% | `033ce88` |
| 3. Physics-only diagnostic | Main rows: bias -6.33 K, pooled RMSE 12.83 K | `b55705d`, `eee651f` |
| 4. Fit + LOBO | **Baseline does not beat the benchmark** (below) | `b080ca4` |

Full test suite: `13 passed` (about 75 s).

### Environment changes

- Installed into `gale-env` (user-approved exception to the no-install rule): `pytest` 9.2.0, `nbconvert` 7.17.2. numpy 2.5.4 and pandas 3.1.0 unchanged.
- Registered the Jupyter kernel `gale-env` (it runs `gale-env\Scripts\python.exe`). The old `python3` kernel still exists; do not use it.
- Not installed: lightgbm, xgboost, scikit-learn, scipy. **Step 5 needs a gradient-boosting library; decide which before starting.**

### Spec changes (approved, recorded in CLAUDE.md)

1. **Grid stretch 1.15 -> 1.10** (37 layers). With 1.15 (28 layers) the half-space amplitude at 2 skin depths was off by 1.18%; with 1.10 it is 0.77%.
2. **Spin-up shift:** after each unconverged sol the column is shifted so its deepest node equals the sol-mean surface temperature. Spin-up went from about 60 sols (over the 50 limit) to 11-13.

### Data contract (recorded in CLAUDE.md)

Compare the model at the bin **centre** (`bin / 4 + 0.125` h). `ltst_bin_center_hr` is rounded to 0.01 h. The table's flux and sun-elevation columns used that rounded value and the rover `latitude_deg`.

### Step 3: physics-only diagnostic (default parameters)

- Midday (10-15 h) about -18 K in every block, season and tau bin, so it is not a dust-extinction error.
- Pre-dawn warm bias concentrated where THEMIS TI > 550 tiu (+13.6 K), almost all block 0 (sols 1-170, Bradbury).
- REMS warms faster than the model from 07 to 09 h. These three point to TI that is too high.

### Step 4: leave-one-block-out (9 training blocks)

| | Baseline | Benchmark |
|---|---|---|
| Macro RMSE, 9 blocks | 6.72 K | 5.38 K |
| Macro RMSE, without sols 3763-3778 | 6.65 K | 5.37 K |
| Pooled RMSE, main rows | 7.47 K | 5.51 K |
| Placeholder-tau rows | 5.78 K | 4.39 K |

- Per-block baseline RMSE 4.05-9.25 K; it beats the benchmark only in block 1. Worst: block 0 (9.25 K, nights about 10 K warm).
- Fitted parameters across folds: `g_diff` 0.77-0.88, `f_ir` 0.027-0.034, `ti_scale` 0.70-0.87. `ti_scale` is on its 0.7 bound in fold 5 and within 0.05 of it in 7 of the other 8 folds; holding out block 0 gives 0.87. All-blocks fit: 0.82, 0.031, 0.74.
- Remaining errors: by season (-4 to -7 K at Ls 30-120, +2 to +5 K at Ls 150-270, because diffuse light grows with tau while the deficit does not); by time of day (evening -2 to -4 K, pre-dawn +2 to +3 K); blocks 5, 6 and 10 run 5.5-6.5 K cold.
- The benchmark is a lookup of REMS by LTST and Ls. It cannot predict other pixels, so losing to it at the rover is not by itself disqualifying, but the residual model must absorb these systematic errors.
- Decided Oct 28: no bound changes or new parameters. Options discussed and not adopted: TI_SCALE lower bound 0.5, per-pixel TI, fitted albedo, two-layer soil.

### Outputs

`outputs/` and `executed/` are git-ignored. Regenerate them with nbconvert (commands in `CLAUDE.md`):

- `notebooks/baseline_diagnostic.ipynb` (about 1 min) writes `diagnostic_*.csv/png`.
- `notebooks/baseline_fit_lobo.ipynb` (about 30 min) writes `fit_params.csv`, `lobo_*.csv/png`, and `lobo_rows.csv` with every out-of-fold baseline and benchmark prediction. It logs each fold to `lobo_progress.log` as it runs.

### Open items for next session

- Step 5 library: gradient boosting is not installed (see above).
- Step 5 needs baseline predictions for its residuals. Use the out-of-fold `baseline_k` in `lobo_rows.csv`, so held-out blocks never see their own fit.
- Still open from the handover brief: which Ls values the map shows, the web-map format, and whether to run a one-off MCD comparison.
- `1D Thermal Baseline Build Steps.md` still says stretch "about 1.15"; `CLAUDE.md` holds the rule.
- Git author email in the user's config reads `aypeng2019#gmail.com` (`#` for `@`).
