# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

The residual model (`no_elev`, gradient boosting) gives a macro RMSE of 5.28 K against the benchmark's 5.38 K. It loses without sols 3763-3778 and on pooled RMSE. The main failure is block 0, whose thermal inertia (566-682 tiu) lies above every other block's. Details are in `progress.md` and `discoveries.md`.

## Next: needs the user's choice

Done Oct 28: the `ti_scale` >= 0.5 sensitivity run. It changes nothing (see `progress.md`), so a global TI change is closed.

1. **Second learner: FLANN-style ridge regression** (recommended, numpy and scikit-learn only). Fixed basis chosen before running: daily harmonics 1-3 and seasonal harmonics 1-2 of LTST and Ls, each times (1, tau); plus linear TI, slope, sin/cos aspect, albedo and the baseline, each also times the first daily harmonic. One ridge strength, fixed. Adopt only if it beats `no_elev` by at least 0.2 K macro and in at least 5 of 9 blocks. Report fold 0 on its own: it is the only learner that extrapolates in TI, so fold 0 tests that assumption. Configurations: 5 after this.
2. **SVR with an RBF kernel** (optional third): smooth map surfaces, but it reverts to a constant outside the training range, like trees. Each setting tried counts as a configuration.
3. **Block 0 diagnostic:** what `ti_scale` block 0 alone would need (a diagnostic, never a fit for the baseline). It tells whether THEMIS TI or something else explains the +9 K night bias.
4. **Clamp TI to the rover's 353-682 tiu range** before the residual model on the map (Step 6 work).
5. **Air temperature** (separate model). Ask the user before starting.

### Watch for (unchanged)

- Spatial skill cannot be measured here: all rover positions lie within about 10 x 5 km.
- The residual model must not undo the baseline's spatial terms. Current partial-dependence ranges are at most 1.8 K (TI, aspect).
- Count every configuration tried: 4 so far, 1 learner setting (the sensitivity run re-scored the same 4 and selected nothing).

### Open questions for the user

- Which of items 1-4 to do next.
- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
