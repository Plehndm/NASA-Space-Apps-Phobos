# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

The residual model (`no_elev`, gradient boosting) gives a macro RMSE of 5.28 K against the benchmark's 5.38 K. It loses without sols 3763-3778 and on pooled RMSE. The main failure is block 0, whose thermal inertia (566-682 tiu) lies above every other block's. Details are in `progress.md` and `discoveries.md`.

## Next: needs the user's choice

Done Oct 28: the `ti_scale` >= 0.5 sensitivity run (no change) and FLANN as the second learner (adopted by the rule, macro 4.86 K, but unsafe on the map as it stands). See `progress.md`.

1. **Make FLANN map-safe** (recommended). Pick one before running, each is a new configuration:
   - (a) clamp every static covariate to the rover's 1st-99th percentile before the residual model, on the map only (no LOBO change, since LOBO rows are inside the range by construction except block 0's TI);
   - (b) drop the albedo terms from the basis (the rover's albedo spans only 0.24-0.26), and rerun LOBO with the same rule as configuration 6;
   - (c) both.
2. **Block 0 diagnostic:** what `ti_scale` block 0 alone would need (diagnostic only). It tells whether the 10 K night TI effect is THEMIS TI or something else at Bradbury.
3. **SVR** (optional third learner). Lower priority now: it reverts to a constant off-range like trees.
4. **Air temperature** (separate model). Ask the user before starting.

### Watch for (unchanged)

- Spatial skill cannot be measured here: all rover positions lie within about 10 x 5 km.
- The residual model must not undo the baseline's spatial terms. Trees: partial-dependence ranges at most 1.8 K. FLANN: TI 10 K at night inside the rover range, albedo 29 K when extended to 0.10-0.35.
- Count every configuration tried: 5 so far (4 tree configurations, 1 FLANN). The sensitivity run re-scored the same 4 and selected nothing.

### Open questions for the user

- Which of items 1-4 to do next.
- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
