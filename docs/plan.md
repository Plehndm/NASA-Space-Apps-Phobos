# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

Ground temperature: **`flann_safe` is the chosen residual model** (FLANN ridge, no albedo terms, covariates clamped to the rover's 1st-99th percentiles). LOBO macro RMSE 4.74 K against the benchmark's 5.38 K and the baseline's 6.72 K; 4.87 K vs 5.37 K without sols 3763-3778. Pooled RMSE (5.82 K) is still worse than the benchmark (5.51 K), because block 0 (7.46 K) dominates the rows. 8 configurations tried. Details in `progress.md`.

## Next: needs the user's choice

1. **Block 0 diagnostic** (recommended first): the `ti_scale` block 0 alone would need (a diagnostic, never a baseline fit). The chosen model carries a 10 K night TI effect learned almost entirely from block 0, which will be applied to every high-TI map pixel. This checks whether TI explains it.
2. **Air temperature** (separate model): a function of predicted ground temperature, elevation and time of day. Ask the user before starting.
3. **Step 6, the map:** needs the Ls values (proposal 15, 75, 195, 255, 340) and the output format. The map applies `flann_safe` with the all-blocks clamp ranges (`outputs/residual/flann_safe_clamp_ranges.csv`) and reports the fraction of pixels clamped per covariate.
4. **Sealed test** (blocks 4 and 8): only when the user says so. Remember it is a time test within 1 km of training positions, not a spatial test.

### Watch for (unchanged)

- Spatial skill cannot be measured here: all rover positions lie within about 10 x 5 km.
- The residual model must not undo the baseline's spatial terms. `flann_safe`: TI 10.4 K at night (bounded by the clamp), slope 2.4 K, no albedo term.
- Count every configuration tried: 8 so far (4 tree configurations, 4 FLANN variants). The sensitivity run re-scored the same 4 tree configurations and selected nothing.

### Open questions for the user

- Which of items 1-4 to do next.
- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
