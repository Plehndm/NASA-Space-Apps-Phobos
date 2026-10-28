# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Next: Step 5, residual model (needs the user's go-ahead)

`CLAUDE.md` keeps the residual model out of scope until the user asks for it.

**Goal:** learn what the physics baseline misses, and show with LOBO that baseline plus residual beats the baseline alone and the benchmark (5.38 K macro).

### Design

1. **Residual target:** `ground_temp_k - baseline_k`, per REMS row.
2. **No leakage from the baseline fit.** In fold b, both the training rows' and the held-out rows' baseline must come from the fold-b parameters (fitted without block b). `lobo_rows.csv` holds only the held-out rows per fold, so re-evaluate the model at each fold's parameters for all rows: 9 evaluations at about 4.4 s each, using `fit_params.csv`. Do not reuse the all-blocks fit inside LOBO.
3. **Learner:** start with scikit-learn's `HistGradientBoostingRegressor`. xgboost is also installed; try it only if the first learner's result justifies a second.
4. **Predictors** (from the handover brief): sin/cos of LTST and Ls, tau, thermal inertia, slope, aspect (sin/cos), albedo, elevation, and the baseline temperature itself. Add the model's own flux terms only if the ablation supports them.
5. **Validation:** the same 9 LOBO folds and the same benchmark. Report per-block RMSE, the macro average with and without sols 3763-3778, pooled RMSE, and bias by LTST hour and Ls bin. Report placeholder-tau rows separately.
6. **Repeat the Oct 27 feature ablation on these residuals** (the earlier ablation was on raw temperatures, a surrogate). Fix the decision rule before running, and count the configurations tried.
7. **Air temperature** is a separate model: a function of predicted ground temperature, elevation and time of day. Do it after ground temperature, and ask the user before starting.

### Watch for

- **Elevation identifies the campaign** (it varies by at most about 126 m within a block). A tree model can use it as a block ID instead of a terrain effect. Check the ablation with and without it.
- **Spatial skill cannot be measured here.** All rover positions lie within about 10 x 5 km and the sealed test is a time test. Say so in every result.
- **The residual model must not undo the baseline's spatial terms** on the map. Keep its covariate effects small and checkable, for example with partial-dependence plots for slope, aspect and TI.

### Open questions for the user

- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
