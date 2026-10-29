# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where things stand (Oct 28, end of session 3)

- **Step 6 (ground-temperature map) is complete.** All four formats are in `outputs/map/`, every automated check passes, and the user confirmed the QGIS check. How to use the folder: `outputs/map/README.md`. Results: `progress.md`, Session 3. The Step 6 design text was replaced here; it is in git history (commit `4c18956`) and in `outputs/map/map_manifest.json`.
- **Next: air temperature (Step 5b, the model; Step 6b, the map).** The design and decision rules below were fixed with the user on Oct 28, before any air model was scored. Then the sealed test, for ground and air together (Step 7).

## Next: air temperature

### Decisions (user, Oct 28)

| Item | Decision |
|---|---|
| Model form | **Hybrid FLANN ridge**: time/season x tau harmonics plus terms in the predicted ground temperature. Terrain enters only through predicted ground. |
| Elevation | **Left out.** The rover spans -4,521 to -3,781 m, while 83% of crater pixels lie higher (99th percentile about +460 m), so the data cannot teach a lapse rate. |
| Ground input | **Predicted ground, out of fold** (see "Ground input" below), the same quantity the map feeds the model. |
| Clamping of predicted ground | **None.** Air follows predicted ground linearly everywhere. Risk: the ground map spans 152-313 K, wider than the rover saw, so air extrapolates there. Report the fraction of map pixel-frames outside the rover's 1st-99th percentile of predicted ground, and the air extremes. |
| Configurations scored | **Two:** `air_hybrid` (the candidate) and `air_time_only` (attribution). They are configurations 10 and 11. |
| Decision rule | Adopt `air_hybrid` if its LOBO macro RMSE beats the air benchmark by at least 0.2 K **and** it is better in at least 5 of 9 blocks (the Step 5 rule). |
| If it fails | **Publish the better-scoring of the two configurations anyway**, with the shortfall stated in the manifest and README. If that is `air_time_only`, the air map is the same everywhere at a given time; say so. The benchmark is not a candidate. |
| Output | The same four formats, in `outputs/map/air/`, with its own manifest and a README section. The colour range is set in a dry run. |
| Sealed test | After air is frozen, score ground and air on blocks 4 and 8 in one look (Step 7). It still needs the user's explicit go at that point. |

### Evidence before the design (Oct 28, a feasibility check, not a scored configuration)

- **Air benchmark, LOBO:** a macro RMSE of 4.06 K (mean REMS air temperature per LTST bin and 30-deg Ls bin, from each fold's training rows). It is harder to beat than ground's 5.38 K, because air varies less.
- **Air minus observed ground, mean by hour:** +8 K at night (00-06 h, 20-23 h), and -26 K at 11-12 h.
- **A crude least-squares model** (predicted ground x (1, sin, cos of the first daily harmonic), plus 3 daily harmonics) scored 4.21 K, worse than the benchmark. Block 0 was 5.96 K against the benchmark's 3.92 K: ground errors carry into air. The hybrid adds tau and season terms and ridge shrinkage, which can shrink the ground terms when they hurt. This check does not count as a configuration and was not tuned on.

### Design

1. **Rows.**
   - **Target:** `air_temp_k`.
   - **Loader:** `thermal1d.load_rems_table` as it is. It already drops rows without ground temperature (624 rows), so the air model never sees them. Rows with `air_missing` are dropped as well. Print both counts.
   - **Excluded from fitting** (as for ground): placeholder-tau rows, and sols 3763-3778. Score both groups separately.
2. **Ground input.** `ground_pred` = fold baseline + fold `flann_safe_no_ti` residual.
   - On **held-out rows** of block b: the fold-b ground model, trained without block b. This is clean.
   - On **training rows** (blocks c != b): each row's own out-of-fold ground prediction, from the fold-c model.
     - These are the values in `outputs/residual/flann_rows.csv`, `pred_flann_safe_no_ti`. Recompute them in the notebook and assert a match within 0.05 K.
     - Known leak: the fold-c ground model saw block b's ground observations, though never its air temperatures. It is small, and the alternative, nested LOBO with physics refits, costs about 72 fits. Say so in the report.
   - **On the map:** the all-blocks ground map, `outputs/map/master/ls{LLL}.npy`.
3. **Basis.** Reuse `residual.make_flann_basis`, with `baseline_k` set to `ground_pred`:
   - `air_hybrid`: static terms `["baseline_k"]`, that is, `ground_pred` x (1, sin, cos of the first daily harmonic), plus daily harmonics 1-3 and seasonal harmonics 1-2, each x (1, tau), and tau. 33 - 9 = 24 columns; confirm in code.
   - `air_time_only`: static terms `[]`.
   - Ridge alpha 1.0 on standardized columns, fixed, not tuned. No clamp.
   - Add `AIR_VARIANTS` to `residual.py`, name -> static terms.
4. **Benchmark.** `residual.benchmark` on air: the per-(bin, Ls bin) mean of `air_temp_k` from the fold's training rows, falling back to the per-bin mean. Report how many rows used the fallback.
5. **Scores**, all of them for benchmark, `air_time_only` and `air_hybrid` side by side:
   - per-block RMSE and bias;
   - macro (the headline), and macro without sols 3763-3778;
   - pooled RMSE on main rows;
   - placeholder-tau rows and suspect-terrain rows, separately;
   - bias and RMSE by LTST hour, and bias by 30-deg Ls bin;
   - for reference only, the brief's tree yardstick for air: 3.5-3.7 K macro, on 7 blocks with an older split, so not comparable.
6. **Notebook:** `notebooks/air_lobo.ipynb`, writing to `outputs/air/` (add `AIR_OUT_DIR` to `paths.py`). The decision is written to `outputs/air/air_decision.txt` by the rule above. Stop and report.
7. **Map (Step 6b), after the user has seen the scores.**
   - Refit the chosen configuration on all fitting rows, with each row's out-of-fold `ground_pred` as in training.
   - Apply it frame by frame to the ground master maps; no solver run is needed.
   - Encode A-D with the same encodings as ground. Measure the colour range in the dry run, on the crater sample.
   - Checks: decoding as for ground, and the air at the rover pixel equals the notebook's prediction for the same inputs.
   - Report the fraction of pixel-frames whose `ground_pred` lies outside the rover's 1st-99th percentile.

### Estimate

| Step | Time |
|---|---|
| Step 5b, `air_lobo.ipynb`: code, run (minutes of compute), report | 1.5-2 h |
| Step 6b, air map: code, dry run, full run (about 15 min of compute; no solver), checks | 1-1.5 h |
| Notes and README | 0.5 h |
| Step 7, sealed test, ground and air, one look | 1-1.5 h |

### Watch for (air)

- **Spatial skill cannot be measured,** as for ground. Air away from the rover is low confidence (handover brief).
- **No elevation and no clamp.** High terrain gets no cooling from height. Ground extremes extrapolate linearly into air.
- **Block 0:** its ground errors (7.3 K) are the largest, and they carry into air.

## Step 6 leftovers (optional, user's call)

1. The `flann_safe` (with TI terms) ground sensitivity map. It reuses `outputs/map/master/ls{LLL}_base.npy`, so it takes minutes.
2. Delete the 2,650 chunk files in `outputs/map/master/` (about 500 MB). A rerun reuses the merged baselines.
3. Find the source of the faint vertical band in the 14:00 frames (suspected: the coarse albedo grid).

## Later items

1. **Literature check** of REMS-derived TI along the traverse (Hamilton et al. 2014, Vasavada et al. 2017; cited from memory, not checked) against the implied 330-400 tiu.
2. **Sealed test** (blocks 4 and 8): planned after air (Step 7), only when the user says so. It is a time test within 1 km of training positions, not a spatial test.
3. **Proposals only (out of scope):**
   - a two-layer soil, for block 0's remaining shape error;
   - a TI mapping that shrinks THEMIS variation instead of scaling it, since every block implies 330-400 tiu;
   - a one-off Mars Climate Database comparison at the Gale cell;
   - a fixed near-surface lapse rate for air (rejected for now, Oct 28: needs a cited value and the user's approval).

### Watch for (ground)

- **Spatial skill cannot be measured here.** All rover positions lie within about 10 x 5 km. Say so beside the map.
- **Most of the map is outside the rover's TI range.** 82% of pixels are below 361 tiu, where the baseline runs at `ti_scale` x THEMIS (a 281 tiu pixel runs at 208 tiu). Nothing in the rover data tests TI below about 330 tiu.
- **Slope is clamped to 1.25-12.27 deg in the residual only.** The physics still sees the true slope, so steep crater walls and Mount Sharp's flanks rest on the baseline alone.
- **Count every configuration tried:** 9 so far (4 tree configurations and 5 FLANN variants; number 9 is a sensitivity run). Step 6 added none; Step 5b adds 2 (numbers 10 and 11).
