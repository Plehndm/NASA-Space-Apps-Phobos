# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

Ground temperature: **`flann_safe` is the chosen residual model** (FLANN ridge, no albedo terms, covariates clamped to the rover's 1st-99th percentiles). LOBO macro RMSE 4.74 K against the benchmark's 5.38 K and the baseline's 6.72 K; 4.87 K vs 5.37 K without sols 3763-3778. Pooled RMSE (5.82 K) is still worse than the benchmark (5.51 K), because block 0 (7.46 K) dominates the rows. 8 configurations tried. Details in `progress.md`.

## Next: needs the user's choice

Done Oct 28: the block 0 diagnostic (TI, not sky IR) and the with/without-TI-terms comparison at the rover and as a crater-wide estimate. The map itself is not made yet. See `progress.md`.

1. **Choose the residual for the map: `flann_safe` or `flann_safe_no_ti`.** Recommended: `flann_safe_no_ti`. The TI terms earn 0.12 K at the rover (under the 0.2 K bar used for every other addition) but warm about 82% of the map by about 3.3 K at night through the clamp, in a TI range (below 361 tiu) the rover never saw. This is a user decision because the pre-set rule chose `flann_safe`.
2. **Step 6, the map, both ways.** Needs from the user: the Ls values (proposal 15, 75, 195, 255, 340), a tau per map Ls (proposal: the training table's median tau in each Ls bin, never extrapolated), and the output format agreed with the map team. The baseline is shared, so both residual versions cost one solver run: about 2 h per Ls at 200 m (530,000 columns). Report the fraction of pixels clamped per covariate.
3. **Literature check** of REMS-derived TI along the traverse (Hamilton et al. 2014, Vasavada et al. 2017; cited from memory, not checked) against the implied 330-400 tiu.
4. **Air temperature** (separate model). Ask the user before starting.
5. **Sealed test** (blocks 4 and 8): only when the user says so.
6. **Proposals only (out of scope):** two-layer soil for block 0's shape error; a TI mapping that shrinks THEMIS variation instead of scaling it (every block implies 330-400 tiu).

### Watch for (unchanged)

- Spatial skill cannot be measured here: all rover positions lie within about 10 x 5 km.
- The residual model must not undo the baseline's spatial terms. `flann_safe`: TI 10.4 K at night (bounded by the clamp), slope 2.4 K, no albedo term.
- Count every configuration tried: 9 so far (4 tree configurations, 5 FLANN variants; number 9 is sensitivity only). The sensitivity run re-scored the same 4 tree configurations and selected nothing.

### Open questions for the user

- Which of items 1-4 to do next.
- Which Ls values the map shows (proposal: 15, 75, 195, 255, 340); needed for Step 6.
- The web-map output format; needed for Step 6.
- Whether to run a one-off Mars Climate Database comparison at the Gale cell.
