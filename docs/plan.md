# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

Ground temperature: **`flann_safe` is the chosen residual model** (FLANN ridge, no albedo terms, covariates clamped to the rover's 1st-99th percentiles). LOBO macro RMSE 4.74 K against the benchmark's 5.38 K and the baseline's 6.72 K; 4.87 K vs 5.37 K without sols 3763-3778. Pooled RMSE (5.82 K) is still worse than the benchmark (5.51 K), because block 0 (7.46 K) dominates the rows. 8 configurations tried. Details in `progress.md`.

## Next: needs the user's choice

Done Oct 28: the block 0 diagnostic. TI explains block 0 (implied about 350 tiu vs THEMIS 637), and every block implies 330-400 tiu. The residual model's night TI effect points the right way along the traverse. See `discoveries.md`.

1. **Decide how the map treats THEMIS TI** (a user decision, not a fit). Options: (a) keep `flann_safe` as is, which pulls high-THEMIS pixels toward about 360 tiu at night, up to 10 K; (b) report the map with and without the residual's TI terms as a sensitivity; (c) check REMS-derived TI along the traverse in the literature (Hamilton et al. 2014, Vasavada et al. 2017, both JGR/Icarus) against the implied 330-400 tiu before choosing. Recommended: (c) then (b).
2. **Air temperature** (separate model). Ask the user before starting.
3. **Step 6, the map:** needs the Ls values (proposal 15, 75, 195, 255, 340) and the output format. It applies `flann_safe` with the all-blocks clamp ranges and reports the fraction of pixels clamped per covariate.
4. **Sealed test** (blocks 4 and 8): only when the user says so.
5. **Proposal only (out of scope):** a two-layer soil would fit block 0's remaining shape error (too hot at 11-14 h, too cold at 18-19 h).

### Watch for (unchanged)

- Spatial skill cannot be measured here: all rover positions lie within about 10 x 5 km.
- The residual model must not undo the baseline's spatial terms. `flann_safe`: TI 10.4 K at night (bounded by the clamp), slope 2.4 K, no albedo term.
- Count every configuration tried: 8 so far (4 tree configurations, 4 FLANN variants). The sensitivity run re-scored the same 4 tree configurations and selected nothing.

### Open questions for the user

- Which of items 1-4 to do next.
- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
