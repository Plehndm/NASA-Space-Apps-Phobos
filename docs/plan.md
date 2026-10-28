# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

The residual model (`no_elev`, gradient boosting) gives a macro RMSE of 5.28 K against the benchmark's 5.38 K. It loses without sols 3763-3778 and on pooled RMSE. The main failure is block 0, whose thermal inertia (566-682 tiu) lies above every other block's. Details are in `progress.md` and `discoveries.md`.

## Next: needs the user's choice

1. **Second learner (xgboost), as the pre-set rule 4 allows.** Same 4 configurations, fixed settings chosen before running, counted as new configurations. Expectation: small change, because the block 0 failure is extrapolation, not learner capacity.
2. **TI sensitivity run for the baseline** (`closed_ideas.md` reopen condition): `ti_scale` lower bound 0.5, reported beside the headline fit, never as the headline. Block 0 is warm (+4.8 K) and its TI is outside the training range, which is the case the reopen condition names.
3. **Make the residual model's TI effect safe for the map.** Clamp TI to the rover's 353-682 tiu range before the residual model, so the map does not extrapolate, and report the fraction of crater pixels affected. Needs the TI raster's histogram, which is Step 6 work.
4. **Air temperature** (separate model). Ask the user before starting.

### Watch for (unchanged)

- Spatial skill cannot be measured here: all rover positions lie within about 10 x 5 km.
- The residual model must not undo the baseline's spatial terms. Current partial-dependence ranges are at most 1.8 K (TI, aspect).
- Count every configuration tried: 4 so far, 1 learner setting.

### Open questions for the user

- Which of items 1-4 to do next.
- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
