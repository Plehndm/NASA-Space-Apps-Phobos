# Progress: What Happened, With Scores

The newest session goes at the top. What we learned goes in `discoveries.md`, what not to retry goes in `closed_ideas.md`, and the next step goes in `plan.md`.

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
