# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where things stand (Oct 29, end of session 4)

- **Ground map (Step 6) and air map (Step 6b) are complete,** in `outputs/map/` and `outputs/map/air/`; how to use them: `outputs/map/README.md`. Results: `progress.md`, Session 4. The air design text was replaced here; it is in git history (commit `1023104`) and in `outputs/map/air/map_manifest.json`.
- **Air fails its adoption rule** (LOBO macro 4.05 vs benchmark 4.04 K, 4 of 9 blocks) and is published under the fallback, with the shortfall and the flat night air stated (user decision Oct 29).
- **Next: the sealed test (Step 7), only on the user's explicit go.**

## Next: the sealed test (Step 7), draft; confirm with the user before running

Blocks 4 and 8 (sols 1343-1360, 3069-3110). One look, ground and air together. Nothing gets tuned afterwards.

1. **Models, frozen as on the maps:** the all-blocks baseline parameters plus the `flann_safe_no_ti` residual, refit on all fitting rows (ground); the all-blocks `air_hybrid` fed with that ground prediction (air). The test rows' ground input is the all-blocks ground prediction, which is the map's situation.
2. **Benchmarks:** the per-(LTST bin, 30-deg Ls bin) means of REMS ground and air from all training rows, with the same fallback.
3. **Loader:** `allow_test=True` only in that notebook, and only its test rows are scored. Placeholder-tau test rows are scored separately.
4. **Report:** per-block RMSE and bias for model and benchmark, ground and air; bias by LTST hour. Write the numbers to `progress.md` whatever they show.
5. **Framing:** a time test within 1 km of training positions, not a spatial test.

To settle with the user first: whether a test result can change anything (proposed: no; it is reported only), and the notebook name (proposed `notebooks/sealed_test.ipynb`).

## Step 6 leftovers (optional, user's call)

1. The `flann_safe` (with TI terms) ground sensitivity map. It reuses `outputs/map/master/ls{LLL}_base.npy`, so it takes minutes.
2. Delete the 2,650 chunk files in `outputs/map/master/` (about 500 MB). A rerun reuses the merged baselines.
3. Find the source of the faint vertical band in the 14:00 frames (suspected: the coarse albedo grid).

## Later items

1. **Literature check** of REMS-derived TI along the traverse (Hamilton et al. 2014, Vasavada et al. 2017; cited from memory, not checked) against the implied 330-400 tiu.
2. **Sealed test** (blocks 4 and 8): Step 7 above, only when the user says so.
3. **Proposals only (out of scope):**
   - a two-layer soil, for block 0's remaining shape error;
   - a TI mapping that shrinks THEMIS variation instead of scaling it, since every block implies 330-400 tiu;
   - a one-off Mars Climate Database comparison at the Gale cell;
   - a fixed near-surface lapse rate for air (rejected for now, Oct 28: needs a cited value and the user's approval).

### Watch for (ground)

- **Spatial skill cannot be measured here.** All rover positions lie within about 10 x 5 km. Say so beside the map.
- **Most of the map is outside the rover's TI range.** 82% of pixels are below 361 tiu, where the baseline runs at `ti_scale` x THEMIS (a 281 tiu pixel runs at 208 tiu). Nothing in the rover data tests TI below about 330 tiu.
- **Slope is clamped to 1.25-12.27 deg in the residual only.** The physics still sees the true slope, so steep crater walls and Mount Sharp's flanks rest on the baseline alone.
- **Count every configuration tried:** 11 so far (4 tree configurations, 5 FLANN variants, number 9 a sensitivity run; numbers 10 and 11 are the air models, Oct 29). Step 6 added none.
