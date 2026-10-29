# Discoveries: What We Learned and Why

Each entry gives the evidence. Data and split findings from before Oct 27 are in the handover brief, section 4.

## Numerics (Oct 27)

- **The spec grid (first layer delta/30, stretch 1.15) is too coarse below about 1 skin depth.** It gives 28 layers. The half-space amplitude at 2 delta was off by -1.18%, and almost all of that is spatial: halving every layer cut it to -0.54%, while a 4x smaller dt only reached -0.94%. **Fix (approved): stretch 1.10**, 37 layers, -0.77%.
- **Spin-up time is fixed in skin-depth units, about 60 sols for a 10-delta column at any thermal inertia.** The slowest mode decays over roughly 13 sols, and the deep layers start 1-4 K off the periodic mean. **Fix (approved):** after each unconverged sol, shift the column so its deepest node equals the sol-mean surface temperature. It is exact in the periodic state (the sol-mean temperature is the same at every depth when the bottom flux is zero), takes 11-13 sols, and lands closer to the converged state (0.013 K vs 0.03 K without it). Shifting after every sol beat shifting only during the first 3-10 sols.
- **Warm-starting spin-up from the previous parameters does not save time** (12-13 sols either way; 4.4 s per evaluation of all 294 sols). The remaining transient sits in the top few skin depths. It is kept because `CLAUDE.md` asks for it.
- **A surface node with half-cell heat storage** (finite-volume, node at z = 0) gives second-order accuracy and exact energy conservation under backward Euler. The sol-mean net surface flux is within 0.0002 W m^-2 in the periodic state.

## Forcing (Oct 27)

- **Gate 2 is a consistency check, not independent validation.** The table's flux and sun-elevation columns come from `insolation()` in `data_prep/build_rems_training_table.ipynb`, which uses the same orbit constants and formulas. Diffuse light and sky infrared have no table columns and meet data only in the diagnostic.
- **Compare at the bin centre, but check Gate 2 at the table's rounded `ltst_bin_center_hr`.** A 0.005 h shift moves direct flux by several percent near sunrise and sunset at high tau.

## Physics vs REMS (Oct 27-28)

- **At default parameters the model is about 18 K cold at midday in every block, season and tau bin.** The deficit is -16.7 K at tau <= 0.4 and -14.1 K at tau 1.3-2, so it is not too much dust extinction.
- **Thermal inertia looks too high, most of all at block 0 (sols 1-170, Bradbury).** Pre-dawn bias is +1.7 to +3.7 K below 500 tiu and +13.6 K at 550-700 tiu (almost all block 0). REMS warms faster than the model from 07 to 09 h. The fit confirms it: `ti_scale` goes to 0.70-0.74 whenever block 0 is in training and 0.87 when it is held out.
- **One diffuse fraction cannot fit both seasons.** The fit settles at `g_diff` about 0.8. The fitted model is then -4 to -7 K at Ls 30-120 (clear) and +2 to +5 K at Ls 150-270 (dusty), because the diffuse term grows with tau and the midday deficit does not.
- **Fitting halves the error but does not beat the benchmark** (macro 12.77 K at defaults, 6.72 K fitted, benchmark 5.38 K). The benchmark is a lookup of REMS by LTST and Ls at the rover; it carries no spatial information, so it cannot replace the baseline on the map.
- **The placeholder tau (0.5) is not a major error source.** Those sols score like the main group in both the diagnostic and LOBO.
- **Sols 3763-3778 are the only group that is cold at night** (-4 to -6 K), consistent with their suspect 23.9 deg DEM slope cutting the sky view.

## Tooling (Oct 27-28)

- **pandas 3 returns read-only arrays from `.to_numpy()`.** Copy before writing into them. This crashed the first LOBO run after 25 minutes.
- **nbconvert shows no output until a notebook finishes.** Long notebooks should append progress to a log file, as `baseline_fit_lobo.ipynb` does.
- **Dry-run a long notebook with the expensive call stubbed** (for example, the fit returning defaults) before the real run. That caught nothing new here, but it costs 10 s against a 30-minute failure.

## Residual model (Oct 28)

- **Block 0 sits entirely outside the other blocks' thermal-inertia range.** Its TI is 566-682 tiu; every other block is at most 514 tiu. A tree model cannot extrapolate, so the residual model barely helps block 0 when it is held out (9.24 K to 8.79 K, against the benchmark's 5.04 K). Block 0 alone costs the macro about 0.4 K against the benchmark. The same failure will hit every map pixel whose THEMIS TI lies outside 353-682 tiu.
- **The residual model fixes most of the midday and seasonal deficit elsewhere.** Ls 0-120 bias drops from -3.7 to -7.3 K to within 2 K, and blocks 3, 5, 6 and 10 drop 2-3 K in RMSE.
- **It adds a warm night bias (+1.5 to +2.2 K at 17-23 h).** Night RMSE stays near the baseline's (about 7 K), while the benchmark is 4-6 K. Nights are where the model gains least.
- **The 0.10 K macro win is inside the noise of a 4-way selection.** It disappears without sols 3763-3778 (5.43 K vs 5.37 K), and pooled RMSE stays 1 K worse than the benchmark because block 0 holds a quarter of the rows.
- **Elevation helps a little (0.07 K macro, 6 of 9 blocks)** but below the 0.2 K bar set for a possible campaign ID. Its partial-dependence range is 1.06 K.
- **The model's absorbed flux adds nothing** over sin/cos LTST, Ls, tau and the baseline (0.04 K worse).

## `ti_scale` sensitivity (Oct 28)

- **One global TI scale cannot fix block 0, whatever its bound.** With the bound at 0.5 the fits stay at 0.69-0.88. Block 0 is warm at night (+9 K after the residual model), while the fitted baseline is already cold at night elsewhere (-3.2 K, 19-06 h). A lower global scale would cool every block's nights, so least squares refuses it. Block 0 needs something local: its THEMIS TI (566-682 tiu) looks too high for the Bradbury surface, or something else at block 0 (sky IR, early-mission data) differs.
- **Correction to the Oct 28 closed-ideas note:** it said nights elsewhere sit near 0 to +4 K. That was the default-parameter diagnostic. After the fit, nights outside block 0 are -2 to -6 K (cold).

## FLANN second learner (Oct 28)

- **A smooth, extrapolating learner beats trees by 0.42 K macro** and beats the benchmark on macro with and without sols 3763-3778 (4.86 and 4.95 K vs 5.38 and 5.37 K). Pooled RMSE (5.83 K) is still worse than the benchmark (5.51 K) because of block 0.
- **Linear TI extrapolation goes the right way at night, but only about 1 K of the 9 K.** The fold-0 model cools nights by about 1 K from TI 450 to 620 tiu. Block 0 night bias drops from +9.2 K (trees) to +6.4 K.
- **Albedo is a hidden campaign ID for a linear learner.** The rover's albedo spans only 0.24-0.26 (1st-99th percentile), so its large coefficient (with an opposing baseline term, a sign of collinearity) is fitted on almost no spread. Extended to 0.10-0.35 it moves the residual by 29 K at 07 h. Trees are flat outside the range, so they never showed this.
- **The all-blocks model learns a 10 K night TI effect inside the rover range,** almost all from block 0. On the map, every high-TI pixel would get colder nights. That is plausible if THEMIS TI is too high there, but nothing here can check it.

## Map-safe FLANN (Oct 28)

- **Dropping albedo improves LOBO** (macro 4.86 to 4.72 K, pooled 5.83 to 5.63 K). Albedo was acting as a campaign ID, not a terrain effect.
- **Clamping costs only block 0** (6.86 to 7.46 K, because its TI is clipped to 514 tiu in fold 0 and the night TI extrapolation is lost) **and helps block 10** (4.04 to 3.72 K, because its suspect 23.9 deg slope is clipped to 12.3 deg). Net macro cost 0.02 K.
- **The remaining map risk is the TI night term** (about 10 K across 361-682 tiu, coefficient -9.2 K per standard deviation on TI x cos LTST). It comes almost entirely from block 0. Clamping bounds it but does not make it right.
- **The baseline as a predictor carries a large term** (-10.6 K per standard deviation on baseline x sin LTST). Clamped to 183-284 K on the map.

## Block 0 and thermal inertia (Oct 28, diagnostic)

- **Block 0 is a TI error, not a sky-IR error.** Its best scale is the same by night (0.50), day (0.60) and diurnal amplitude (0.54), and its best `f_ir` (0.030) equals the global fit. Sky IR alone can fix its nights only by breaking its days (-8.8 K).
- **REMS sees about 330-400 tiu in every block, whatever THEMIS says.** THEMIS block means span 386-637 tiu; implied TI (best scale x THEMIS) spans 328-401 tiu. THEMIS's variation along the traverse is mostly not seen at the rover's scale, and block 0 (Bradbury, highest THEMIS TI) is where the gap is largest.
- **So the residual model's 10 K night TI effect is physically right in direction:** it pulls high-THEMIS pixels toward about 360 tiu. Whether that holds for the rest of the crater (where high THEMIS TI may be real bedrock) cannot be checked with rover data.
- **Blocks 3, 5 and 6 disagree between night (0.95-1.00) and day (0.60-0.75).** Their midday deficit (day bias -5 to -7 K at the best scale) is not a TI problem; it is the same midday shortfall seen since Step 3.
- **A shape error remains at block 0 even at the right TI:** too hot at 11-14 h, too cold at 18-19 h. That pattern fits a low-TI dust layer over denser ground (two-layer soil, out of scope in `CLAUDE.md`).

## The rover sees only the top of the crater's TI range (Oct 28)

- **82% of crater pixels have THEMIS TI below the rover's 361 tiu minimum** (crater median 281 tiu, rover median 470 tiu). The rover's traverse samples the high end of the crater's TI distribution.
- **So the residual's TI terms matter most at low-TI pixels, through the clamp.** Held at 361 tiu, `flann_safe` adds about +3.3 K at night relative to the no-TI version on most of the map. The high-TI pull toward about 360 tiu (block 0) touches only 0.1% of pixels beyond the range.
- **At the rover, the TI terms earn 0.12 K macro.** That is below the 0.2 K bar every other addition had to clear (elevation was rejected at 0.07 K), while they shift about 92% of map pixels by more than 2 K at night. The selection rule was fixed before this was known, so `flann_safe` stays the chosen model until the user decides.
- **The baseline's TI scale is multiplicative, but the evidence is not.** Every block implies about 330-400 tiu whatever THEMIS says (block 0 diagnostic). With `ti_scale` 0.74, a 281 tiu pixel runs at 208 tiu. Nothing in the rover data tests TI below about 330 tiu.

## Running the map (Oct 28, Step 6 dry run)

- **The solver is cache-bound at large chunks.** With 5 parallel workers, ms per column was 28.6 / 16.8 / 13.4 / 18.3 / 23.4 / 38 at 250 / 500 / 1,000 / 2,000 / 4,000 / 10,000 columns. Below 1,000, the Python loop over 960 steps x about 37 nodes dominates; above it, the (n_col, n_nodes) work arrays fall out of cache and the 5 workers share memory bandwidth (one worker alone: 11.6 ms/col). Peak memory per worker was 237 MB at 1,000 and up to 944 MB at 10,000, about 3x the plan's estimate.
- **Spin-up takes 13-14 sols everywhere in the crater sample**, the same as at the rover, so chunk time does not depend on terrain.
- **The feature table is missing 148 pixels as rows**, not as NaN values. Read it by `row`/`col`, never by position.
- **The map runs hotter than the colour scale:** up to 312 K at Ls 195 in the afternoon on the crater sample (2.2% of pixel-frames above 300 K).

## Air temperature, before modelling (Oct 28, feasibility check)

- **Air is harder to beat than ground.** The per-(LTST, Ls) mean benchmark scores 4.06 K macro LOBO for air, against 5.38 K for ground, because air varies less.
- **Air is about 8 K warmer than the ground at night and about 26 K colder at 11-12 h** (REMS means by hour, main rows).
- **Predicted-ground errors carry into air.** A crude least-squares model on out-of-fold predicted ground scored 4.21 K macro, worse than the benchmark; block 0 alone was 5.96 K against 3.92 K. Not a configuration; it informed the hybrid design in `plan.md`.
- **Elevation cannot be learned from the rover:** 83% of the 200 m crater pixels lie above the rover's highest training position (-3,781 m).

## Air temperature, LOBO (Oct 29)

- **Predicted ground helps air in 6 of 8 blocks other than block 0, and ruins block 0.** Without block 0 the hybrid's macro is 3.83 K against the benchmark's 4.05 K. Block 0 goes from 3.92 K (benchmark) to 5.80 K.
- **Block 0's ground error is a night error, and air inherits it only when block 0 is out of training.** Its `ground_pred` is +6.9 K at night (high TI; every other block is within +-2.8 K). Air-to-ground sensitivity (air change per +1 K of `ground_pred`, all hours shifted): the fold-0 model, trained without block 0, uses ground at 0.5-0.6 K/K at night; every model that includes block 0 (all-blocks, fold 6) uses 0.03-0.13 K/K at night and about 0.5 K/K at 12-16 h. The ridge learns to distrust night ground because of block 0.
- **Consequence for the map:** the all-blocks model's night air hardly follows ground (0.02-0.08 K/K at 00-05 h), so night air on the map is close to the same everywhere at a given time. By day, air moves about 0.5 K per K of ground.
- **Time and tau alone (`air_time_only`) lose to the benchmark** (4.35 vs 4.04 K, 2 of 9 blocks): the 3-harmonic daily basis is too smooth, with +3 K biases at 17-18 h and 05-06 h. The benchmark's 15-minute lookup has no such limit.
- **The benchmark macro is 4.04 K** (feasibility check: 4.06 K; the 31 `air_missing` rows explain the difference).
- **Rover range of `ground_pred` on fitting rows:** 184.9-282.5 K (1st-99th percentile); the ground map spans 152-313 K.
- **Real night air does follow ground, weakly (Oct 29 diagnostic, not a configuration).** The same basis with *observed* REMS ground gives 0.13-0.23 K/K at 00-05 h and 0.37-0.47 K/K at 12-15 h, with or without block 0; night anomalies across blocks give 0.19 K/K. So the map model's 0.03-0.08 K/K at night comes from block 0's ground error, not physics, and the fold-0 model's 0.5-0.6 K/K is too high. Even 0.2 K/K mostly reflects time (sol-to-sol weather) more than place. Night spatial structure in a crater (cold-air pooling, katabatic flow, elevation) is not represented at all.
- **On the map, night air is flat:** spatial sd about 0.1 K at 02:00 vs 3.8-6.1 K for ground; at 14:00, 2.3-2.9 K vs 4.2-5.3 K.
- **Ls 75 nights are the main extrapolation:** 24% of pixel-frames have ground below the rover's range; air bottoms at 190.5 K.

## Sealed test (Oct 29, one look)

- **The ground model's LOBO lead over the benchmark did not hold on the sealed blocks** (5.25 vs 5.06 K macro; LOBO 4.86 vs 5.38 K). Block 8 (sols 3069-3110) drives it: afternoon (13-15 h) bias -2.7 to -3.3 K, RMSE up to 7.7 K. Block 4 is won (4.33 vs 4.79 K).
- **Air holds roughly level with the benchmark** (4.10 vs 4.19 K), as in LOBO (4.05 vs 4.04 K). Block 8 air is 3.2 K too cold, mostly at night (02-03 h, 20-21 h: -2.6 to -3.8 K), where the model barely uses ground; so the cause is in the time/season/tau terms, not the ground input.
- **Two blocks and 25 sols are too few to rank models.** The sealed result says the models are about as good as a seasonal lookup at the rover, in time; it says nothing about space.

