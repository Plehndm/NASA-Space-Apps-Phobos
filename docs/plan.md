# Plan: What We Try Next

The long-range plan is `docs/1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where things stand (Oct 29, end of session 4b)

- **All in-scope steps are done:** ground map (Step 6), air map (Step 6b, ground colour scale 150-320 K), sealed test (Step 7, one look). Scores: `progress.md`, Sessions 4 and 4b. The Step 7 draft design was carried out as written; it is in git history.
- **Sealed test:** ground model 5.25 K vs benchmark 5.06 K; air 4.10 vs 4.19 K. Reported only; the test blocks are now spent and must not be used to choose or tune anything.
- **Nothing further is scheduled.** Options for the user: the Step 6 leftovers and later items below, or proposals that need scope changes.

## Step 6 leftovers (optional, user's call)

1. The `flann_safe` (with TI terms) ground sensitivity map. It reuses `outputs/maps/ground/_working/master/ls{LLL}_base.npy`, so it takes minutes.
2. ~~Delete the 2,650 chunk files~~ Done Oct 29 (487 MB; each season's chunks matched its merged baseline bit for bit).
3. Find the source of the faint vertical band in the 14:00 frames (suspected: the coarse albedo grid).

## Later items

1. **Literature check** of REMS-derived TI along the traverse (Hamilton et al. 2014, Vasavada et al. 2017; cited from memory, not checked) against the implied 330-400 tiu.
2. **Sealed test** (blocks 4 and 8): done Oct 29 (Step 7). The blocks are spent.
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
