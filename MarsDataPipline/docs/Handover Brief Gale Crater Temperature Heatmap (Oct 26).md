# Handover Brief: Gale Crater Temperature Heatmap (Oct 26, updated Oct 27)

Oct 26, 2026 · @Turtle\_Food

## 1. The Core Objective

Build the data pipeline and two model layers for the Gale Crater web map in the NASA Space Apps Challenge 2026 entry (Nov 14-15), "Interplanetary Survival Guide: Martian Map". Ashton Peng owns the data pipeline; the team delivers an interactive web map with toggleable layers, landmark search, a built-in GPS and route planning.

- **Temperature heatmap (current priority):** a Python model predicting **ground and air temperature over a full diurnal cycle across all of Gale Crater**. The only in-situ source is Curiosity's REMS weather station, so the model extrapolates from one station using terrain and surface properties.
- **Dust devil layer (done for this phase):** a per-pixel heuristic likelihood for one sol (default sol 800), not detections and not a calibrated probability. Details are in the [Oct 24 handover brief](https://claude.ai/artifact/LSrnYRrYegRyPhYoFrjpn7) (updated Oct 27 with the Mastcam tau work). The whole layer now runs from one notebook, dust\_devil\_pipeline.ipynb (built Oct 27), documented in README\_pipeline.md. Do not spend more time on it unless the user asks.
- **Team bounding box (west, south, east, north), degrees E/N:** (136.75, -6.57, 139.24, -4.15).
- **Full model plan:** [Gale Crater Diurnal Temperature Model: Plan Summary](https://claude.ai/artifact/Gpi4qVKbib123wUEfCg42K).

**Working style the user asked for:** Python as `.ipynb` notebooks; no excessive fallback code or try/except (let code fail explicitly); lead every answer with an objective pros-and-cons assessment, no flattery; hold a position unless given new verifiable facts.

## 2. The Current Plan

Core form: `T(x,t) = T_base(x,t) + f(covariates(x), LTST, Ls, tau)`. A physics baseline gives the diurnal shape at every pixel, and a learned model corrects it using REMS residuals.

| Item | Decision |
| --- | --- |
| Targets | Ground and near-surface air temperature, modeled separately; air is a function of predicted ground temperature, elevation and time of day |
| Baseline | Custom 1D soil thermal model (decided Oct 27, see section 6). The Mars Climate Database is not the baseline; at most it is a one-off sanity check at the Gale cell. |
| Correction | LightGBM or XGBoost on baseline-minus-REMS residuals; optional Gaussian process for uncertainty; kriging only if spatial structure remains |
| Predictors | Thermal inertia, albedo, slope, aspect, elevation, insolation, LTST, Ls, dust opacity (real Mastcam tau for 243 of 272 sols; 0.5 placeholder, flagged, on the other 29) |
| Time | Every 30 min of local true solar time at chosen Ls values; sin/cos of LTST and Ls, never UTC |
| Grid | About 200 m for the model (about 718 x 738); data is built at 100 m (THEMIS grid, 1436 x 1477) and block-averaged |
| Station data | Curiosity REMS, PDS volume `mslrem_1001`, binned to 15-minute bins in `rems_binned_all_sols.csv` |

**Hold-out rule (decided Oct 25, revised Oct 26).** Never random rows and never single sols. A new block starts when the gap between consecutive sols exceeds **50 sols** (it was 15; see section 4). Leave-one-block-out (LOBO) cross-validation runs on the 7 training blocks (9 blocks in total since the Oct 27 sols merged two blocks), two blocks are sealed as the test set, and the final model is refit on all rows.

| Block | Sols | Sols (n) | Rows | Ls (deg) | Role | LOBO RMSE (K) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 1-170 | 90 | 4,040 | 151-253 | train | 4.8 |
| 1 | 365-375 | 11 | 597 | 8-13 | train | 6.1 |
| 2 | 584-865 | 53 | 2,562 | 109-270 | train | 4.9 |
| 3 | 1160-1165 | 6 | 249 | 67-69 | train | 4.3 |
| 4 | 1343-1360 | 12 | 561 | 154-163 | test (sealed) | not evaluated |
| 5 | 1650-1865 | 40 | 2,013 | 340-83 (wraps through 0) | train | 4.6 |
| 6 | 2550-2673 | 24 | 1,161 | 91-150 | train | 6.7 |
| 7 | 2871-2968 | 23 | 1,261 | 271-330 | train | 4.5 |
| 8 | 3069-3110 | 13 | 612 | 22-42 | test (sealed) | not evaluated |
| 9 | 3550-3655 | 34 | 1,860 | 277-340 | train | 6.1 |
| 10 | 3763-3778 | 13 | 607 | 34-41 | train | 5.7 |

LOBO RMSE is for ground temperature with a deliberately simple model (sin/cos of LTST and Ls plus DEM elevation, gradient boosting) on the final Oct 27 file (11 blocks), so it is a yardstick for the split, not a result. The average over the 9 training blocks is 5.3 K. It varies by about 0.1 K between runs. The test blocks (4 and 8) were never scored.

**Changing the test blocks after adding sols:** edit `TEST_SOL_RANGES` in the notebook; each range must equal one whole block or the notebook stops on an assert. Choose by judgment, once, before looking at test scores: far from training sols in time, a different elevation and season, no hole left in training coverage (the only Ls 60-90 and Ls 330-340 blocks stay in training), and about 12% of rows. If new sols land within 50 sols of a test block, that block grows and the assert fires: update the range to the new edges.

**Notebook pipeline (run each in its own kernel):**

1. `build_dust_devil_feature_table.ipynb`: joins all rasters onto the 100 m THEMIS grid; writes `gale_dust_devil_features_100m.csv` and `gale_dust_devil_meta.json`.
2. `build_rems_training_table.ipynb` (`final Oct 27): reads the REMS CSV, the features CSV and the two Mastcam tau files; writes gale_rems_training.csv (one row per REMS bin), rems_sol_profile.csv and rems_blocks.csv; ends with an optional random-versus-block check. rems_batch.ipynb (fixed Oct 27): parses the raw REMS TAB files into rems_binned_all_sols.csv. It failed on 25 files with an IndexError (pandas read_csv with low_memory=True on the mixed-type time columns). The fix reads LTST, LMST and the flag columns as strings with low_memory=False, failure messages now give file and line, and ALLOW_FAILURES = False stops the run if any file fails. The rerun had no failures`.
3. `dust_devil_pipeline.ipynb` (built Oct 27, parked): the whole dust devil layer in one kernel, driven by one config cell. Stages: Mastcam tau table, per-pixel feature table (the same join as `build_dust_devil_feature_table.ipynb`), one-sol likelihood for `DEMO_SOL`, GeoTIFF, and overlay previews (top 10% in #EF4444 on the CTX imagery and hillshade). The tau and feature stages are skipped when their output already exists (`"auto"`); rasterio is imported only inside the feature and GeoTIFF stages. It reads `msl-tau-880-arch-3953.txt` and `msl-tau-440-arch-3953.txt` directly from `processed_data` (no zip), uses 880 nm by default, and interpolates tau from `mastcam_tau_per_sol.csv` within 5 sols of `DEMO_SOL` (it fails for sols 1-32 or beyond that distance, instead of guessing). The earlier separate notebooks (`build_mastcam_tau_table`, `build_dust_devil_feature_table`, `dust_devil_likelihood_demo`, `write_likelihood_geotiff`, `dust_devil_overlay_preview_pil`) still exist and `README.md` describes them. The pipeline notebook was tested by the assistant on synthetic data with the real REMS CSV and tau tables, with rasterio stubbed, and has not yet been run by the user on the real rasters.

**Other team decisions:** base imagery is MRO CTX, Mars Trek layer `Gale_CTX_BlockAdj_dd`, tiles up to zoom 12. Topography is a plain hillshade from the NHM Gale CTX DTMs (figshare `DTMs.zip`), no color ramp (UI/UX adds colors), tiles up to zoom 11.

## 3. Progress & Achievements

Steps 1 and 2 of the Oct 24 plan are done, and the REMS training table was frozen on Oct 27 (319 sols, 15,523 rows, 11 blocks): training sols, hold-out rule, per-bin table and real Mastcam tau. The user ran the updated notebooks on the real data, and the table was checked for duplicates, labels and stale blocks. The dust devil pipeline ran on real data on Oct 24 in a clean Python environment, and the earlier `0xC06D007F` kernel crashes stopped.

**Data in hand** (folder `processed_data\` on the user's computer):

- Updated `rems_binned_all_sols.csv`: 319 sols (sol 1 to 3778), 15,523 rows, 15-minute bins. Sols were added on Oct 25, 26 and 27, including sols 3591-3635 for the Ls 300-330 gap, the 25 files that failed to parse earlier, and new campaign windows.
- `gale_dust_devil_features_100m.csv` and `gale_dust_devil_meta.json`: the static per-pixel table. Grid 1436 x 1477, pixel 0.001687 degrees (about 100 m), `pixel_id = row * 1477 + col`, row 0 at the north edge, transform `(0.001687051876845213, 0, 136.7490510333193, 0, -0.0016870993139129456, -4.148577212911933)`.
- Rasters from earlier sessions: 20 m DEM, slope and aspect; THEMIS 100 m night thermal inertia (covers 100% of the box, so the TES fallback was removed); TES albedo for MY24-26 (about 3 km).
- New outputs: `gale_rems_training.csv`, `rems_sol_profile.csv`, `rems_blocks.csv`.

**`gale_rems_training.csv` (15,523 rows x 50 columns, 319 sols, 11 blocks), final check Oct 27:**

- No duplicate (sol, bin). The missing-value flags agree with the empty cells: 664 bins (4.3%) lack ground temperature and 96 lack air temperature.
- Split: 9 training blocks (294 sols, 14,350 rows) and 2 sealed test blocks (blocks 4 and 8: 25 sols, 1,173 rows; sols 1343-1360 and 3069-3110), unchanged since Oct 25.
- Rover pixels: sol 800 is row 304, col 372, `pixel_id` 449380; sol 1163 is row 312, col 365, `pixel_id` 461189. The notebook asserts both.
- Flux columns are zero whenever the sun is below the horizon, and they are direct-beam only (no diffuse light). At tau 0.5, flat noon flux is 408 W/m2 on sol 800 and 246 on sol 1163, matching the earlier brief (about 410 and 247); the notebook asserts this. The table now uses real tau: noon flux is 154 W/m2 on sol 800 (tau 1.44) and 240 on sol 1163 (tau 0.52). The tilted-over-flat noon ratio has median 1.01 and 5th to 95th percentile 0.90 to 1.14.
- Columns: the REMS fields; rover `row`, `col`, `pixel_id`; static covariates (`elev_dem_m`, `slope_deg`, `aspect_deg`, `ti_themis_tiu`, `albedo_mean`, `elev_diff_m`); sin/cos of LTST, Ls and aspect; `flux_flat_wm2`, `flux_tilted_wm2`, `sun_elev_deg`; `tau`, `tau_source` (same\_sol, interpolated or placeholder), `tau_gap_sols`, `tau_n_img`, `tau_is_placeholder`; `ground_missing`, `air_missing`, `core_sol` (40 or more bins), `block`, `split_role`.

**Notebook changes (Oct 26-27, run by the user on Oct 27):** `BLOCK_GAP_SOLS` changed from 15 to 50; an assert stops the notebook if two consecutive blocks share a rover pixel; the test-block printout gives the distance in km to the nearest training position; on Oct 27 it reads the two tau files (`TAU_FILES`), interpolates tau across gaps of at most `TAU_MAX_GAP_SOLS` = 20, adds the tau columns and recomputes the flux columns. The assistant sandbox has no `rasterio`, so the raster steps ran only on the user's computer. Do not hand-join the final CSV: a hand join left stale block labels on sols 3575 and 3635. Add rows to rems\_binned\_all\_sols.csv and rerun the notebook instead. After the parser fix, pressure changed on 77 rows across 7 older sols (maximum 0.28 Pa, cause not confirmed); the air and ground temperature values on older rows did not change.

## 4. Key Discoveries & Insights

**Split and validation**

- **Random rows overstate skill by about 2** times. Ground temperature, simple model (sin/cos of LTST and Ls plus elevation), training blocks only, final Oct 27 file: random rows 2.5 K RMSE, whole sols 3.3 K, whole blocks 5.2 K, against a target standard deviation of 29.5 K. Neighbouring bins and sols are near-copies of each test row.
- **The 15-sol gap rule split two campaigns that share a rover pixel.** Sols 708-765 and 799-804 are 34 sols apart (Ls gap 22 degrees, pixel 449380); sols 1650-1750 and 1770-1865 are 20 sols apart (Ls gap 9 degrees, pixel 501070). Held out separately the four pieces scored 3.5 to 5.8 K while leaking into each other. The overall score moved by under 0.2 K (5.30 to 5.47 K in one check, 5.49 K in the notebook), which is close to the run-to-run noise of about 0.1 K, so the merge is a leakage control, not a measured score change. The sealed test blocks are unaffected (101 or more sols from any training sol).
- **The sealed test measures time, not space.** The test blocks sit 0.42 km (sols 1343-1360) and 0.83 km (sols 3069-3110) from the nearest training position, and each has training sols at nearly the same Ls in other years (0.1 degrees away for both). The nearest training sol is 178 and 101 sols away. Any test error will therefore reflect other years and campaigns at about the same place, not new terrain.
- **Early sols dominate training.** Sols 1-170 hold 28% of training rows (4,040 of 14,350) and three blocks hold about 5% or less each (blocks 1, 3 and 10). Report per-block RMSE and the average across blocks, not only the pooled number.

**Covariates**

- **Aspect convention is confirmed: downslope azimuth, clockwise from north.** A plane fitted to REMS elevation versus rover position gives the regional downslope direction per block. In the four blocks with a regional slope of 3 degrees or more (sols 1-170, 1650-1750, 1770-1865, 3645-3655) the pixel aspect differs by -15, +39, +10 and -1 degrees. An upslope reading is 141 to 179 degrees off, and a mirrored reading is 89 to 115 degrees off in three of them. It matters: reading aspect as upslope would change noon tilted flux by -16% (sols 1770-1865) and -24% (sols 3763-3778).
- **Sols 3763-3778 (607 rows, 4% of training rows) have suspect terrain covariates.** The DEM slope at their main rover pixel is 23.9 degrees (16.7 at the last pixel), while the rover's own tilt is about 10 degrees (median roll -7.4, pitch -7.1, maximum 12.3). No other block has a pixel slope above 12.3 degrees. The DEM elevation also sits 57 to 67 m above the REMS elevation; elsewhere the largest offset is 37 m. Tilted flux there is only +5% over flat at noon, but slope enters the model as a feature.
- **Elevation and block carry nearly the same information.** Elevation spans about 675 m over the traverse (-4521 to -3847 m) but moves by at most about 126 m within a block (sols 1650-1865), so a tree model can use elevation to identify the campaign instead of learning a terrain effect. `albedo_mean` is almost constant (0.239 to 0.258 across all sols). Thermal inertia has useful spread (353 to 682 tiu).
- **`tau` was a placeholder (0.5) in every row of the Oct 27 files; the updated notebook replaces it with Mastcam tau for 243 of 272 sols once the user reruns it.** On Oct 24 the dust devil proxy's kelvin scale rose 59% between sol 800 (Ls 228) and sol 1163 (Ls 68) while modeled noon flux fell about 40%, most likely because of the placeholder. Details are below.

**Dust opacity (tau): sources checked Oct 27**

- **Use: Lemmon et al., ["The Mars Science Laboratory record of optical depth measurements via solar imaging"](https://arxiv.org/abs/2309.07378) (arXiv 2309.07378).** Curiosity Mastcam direct-Sun images at 880 nm (M-34) and 440 nm (M-100), from sol 33 (Ls 168.5, MY31) to sol 3642 (Ls 332.7, MY36). The values are aerosol optical depth (dust plus some water ice), not dust only; the paper suggests ice may add about 25% of column tau at Ls 90-135 but calls that speculative. Data: Lemmon, ["Mars Science Laboratory aerosol optical depths"](https://data.mendeley.com/datasets/tbh3pg39xc/3), Mendeley Data, doi 10.17632/tbh3pg39xc (version 3, 12 Sept 2024, CC BY 4.0): one file per wavelength with columns PDS product id, sol (the fraction is LTST/24), Ls, optical depth and formal uncertainty.
- **Not a tau source: Vicente-Retortillo et al. (2017), "Determination of dust aerosol particle size at Gale Crater using REMS UVS and Mastcam measurements".** It is a particle-size study that takes Mastcam tau as an input. ResearchGate blocked the page, so the assistant read the same group's [EGU 2017 abstract](https://meetingorganizer.copernicus.org/EGU2017/EGU2017-6850.pdf?pdf) instead: effective radius about 0.6 um at Ls 60-140 and about 2 um at Ls 180-360, and no tau values. The radius matters only for scattering parameters in a fuller radiative model later. The journal paper itself was not read.
- **Data files received Oct 27.** The Mendeley zip holds three versions per wavelength (a preliminary Sept 13 file, `-3778` and `-3953`). Use `msl-tau-440-arch-3953.txt` and `msl-tau-880-arch-3953.txt`: 1,360 measured sols, sol 33 to 3953, so sols 3645-3778 are covered. Shared images have identical values across versions (maximum difference 0.0), so nothing was revised. The 440 nm file's header wrongly says 880 nm; its product ids (MR, the M-100 camera) and values are 440 nm. One sigma value (sol 3616, 440 nm) is blank and is ignored; no tau of -1 occurs.
- **Coverage of the Oct 27 training table (272 sols, 13,101 rows):** 65 sols have a same-sol measurement and 178 are interpolated between measured sols at most 20 sols apart (median distance to a measurement 1 sol, maximum 6). 29 sols (984 rows, 7.5%) stay on the 0.5 placeholder: sols 1-32 (25 sols; the record starts at sol 33) and sols 375, 1770, 1775 and 1780. Leave-one-out interpolation error on the measured series: median 4-5% for gaps up to 20 sols (90th percentile 13-14%), rising to a 10% median and 29% 90th percentile beyond 30 sols, which is why the limit is 20 sols.

  Final coverage (319 sols, 15,523 rows, after the Oct 27 additions): 82 sols have a same-sol measurement, 208 are interpolated and 29 sols (984 rows) stay on the placeholder, so tau is real for 290 of 319 sols. The counts in the paragraph above are for the earlier 272-sol file.
- **Wavelength match.** The flux columns are solar-band direct beam, and Mastcam direct-Sun extinction is the matching quantity. Tau is nearly gray: tau at 440 nm is a median 0.947 of tau at 880 nm over 1,487 matched images (interquartile 0.93 to 0.96), which agrees with the 0.94 predicted from the paper's Angstrom exponent of about -0.09. The notebook averages the two wavelengths per sol (about 620 nm equivalent) and fills a sol that has only one wavelength (59 sols) with this ratio. The ratio is a little higher at Ls 90-130, where ice matters.
- **Time of day.** The paper reports tau falling about 12% from 08:00 to 16:00 LTST in the second half of the year. A per-sol mean is enough for a first pass; matching each bin's LTST is a refinement.

**What real tau changes (Oct 27, notebook run on a fixture built from the user's files)**

- **Tau is seasonal and the placeholder fits only part of the year.** Median tau per 30-degree Ls bin is 0.40 to 0.49 at Ls 60-150 and 1.1 to 1.4 at Ls 210-360, with a peak of 1.68 inside sols 3550-3655 (Ls 300-330). The 0.5 placeholder was close in the aphelion season and 2 to 3 times too low in the dusty season.
- **Only `tau`, `tau_is_placeholder` and the two flux columns change** (new columns: `tau_source`, `tau_gap_sols`, `tau_n_img`). Noon flat-surface flux (bin 48) on sol 800 falls from 408 to 154 W/m2 (tau 1.44) and on sol 1163 from 246 to 240 W/m2 (tau 0.52).
- **Dust devil proxy:** the Oct 24 mismatch (proxy scale up 59% from sol 800 to sol 1163, modeled flux down 40%) reverses: noon flux now rises about 56% (154 to 240 W/m2), the same direction as the proxy. The magnitudes were not re-checked and the layer stays parked. The dust devil notebooks use 880 nm tau alone (sol 800: 1.50, sol 1163: 0.52) while the training table averages the two wavelengths (sol 800: 1.44, sol 1163: 0.52), so the two layers differ by about 4% in tau on sol 800 by design. A first-order estimate puts the new dust devil kelvin scale at about 3.5 on sol 800 and 2.85 on sol 1163 (it was 1.756 and 2.792 with tau 0.5); confirm by running dust\_devil\_pipeline.ipynb on the real rasters.
- **No gain for a tree model.** Leave-one-block-out on the 7 training blocks, two learners, adding flux with real tau, or tau itself, to time plus thermal inertia plus slope and aspect changes macro RMSE by -0.10 to +0.10 K with mixed signs (ground 4.6 to 4.9 K, air 3.5 to 3.7 K), which is run-to-run noise. A tree model already has sin and cos of Ls for the dust season and tau is nearly a function of Ls, so this is expected. The test does not show that tau is unimportant; its value should appear in the physics baseline.

**Feature ablation (Oct 27, a surrogate on raw ground temperature)**

- **Setup:** leave-one-block-out on the 8 training blocks that existed then (before blocks 7 and 8 merged), two gradient-boosting settings, baseline = time plus DEM elevation (macro RMSE 5.68 K and 5.20 K). The decision rule was set before running. About 14 configurations were tried, so the winners are optimistic.
- **Dropping elevation did not beat the baseline** (-0.05 and -0.13 K against a required 0.10 K, with an interval spanning zero), so the notebook keeps elevation and no ablation cell was added.
- **Covariates help:** slope and aspect -0.58 and -0.28 K, thermal inertia -0.31 and -0.26 K; albedo hurts (+0.17 and +0.23 K) because it is nearly constant; all covariates together -0.37 and -0.01 K. Seven of eight blocks improve with covariates; the one that worsens (by about 1.6 K) is sols 3763-3778, consistent with its suspect slope and elevation.
- **Air temperature:** covariates change it by no more than about 0.1 K; the flux columns help slightly (removing them costs 0.15 K).
- **Worst fold:** sols 3550-3590 scored 7.2 to 8.4 K because holding them out left almost nothing at Ls 270-330. The Oct 27 sols filled that gap, and the merged block now scores 6.7 K.
- **Repeat on baseline residuals** once the 1D model exists; a tree model on raw temperatures is only a surrogate.

**Coverage**

- **Training sols per 30-degree Ls bin (**final Oct 27 file, 294 training sols): 0-30: 22; 30-60: 23; 60-90: 17; 90-120: 23; 120-150: 23; 150-180: 50; 180-210: 37; 210-240: 19; 240-270: 14; 270-300: 20; 300-330: 28; 330-360: 18. Counting only core sols (at least 40 bins): 19, 22, 11, 15, 21, 26, 35, 16, 12, 19, 27, 17, so Ls 60-90 is the thinnest bin. No bin is empty. Ls 300-330 is now covered by two campaigns in different years (blocks 7 and 9, sols 2871-2968 and 3550-3655), 11 blocks in total. The largest gap in time is sols 1866-2549.
- **Spatial extent is small.** Rover positions span about 10 km north-south and 5 km east-west (latitude -4.77 to -4.59, longitude 137.36 to 137.45) over 319 sols, so crater-wide terrain effects rest mostly on the physics baseline. Air temperature away from the rover is low confidence.
- **Still true from earlier:** the REMS CSV holds one mean pressure per bin (no min, max or std), so it cannot detect dust devils; the 100 m THEMIS grid is about 2.12 million pixels and the 20 m DEM, slope and aspect rasters are about 200 MB each, so the user runs notebooks locally.

## 5. Anti-Patterns (What NOT to Try)

**New this session**

- **Do not report a random-row or whole-sol score as the model's skill.** On the final data they are 2.5 K and 3.3 K against 5.2 K for whole blocks.
- **Do not define blocks by a short sol gap alone.** Near-contiguous campaigns at the same rover pixel must stay in one block; the notebook now asserts that no consecutive blocks share a pixel. Raise `BLOCK_GAP_SOLS` rather than silencing the assert.
- **Do not choose or change the test blocks after looking at test scores,** and do not set a test range that is not exactly one whole block (the notebook asserts this).
- **Do not present the sealed test as a spatial-extrapolation test.** Both test blocks lie within 2 km of training positions.
- **Do not trust slope and elevation covariates for sols 3763-3778** without checking them (pixel slope 23.9 degrees versus about 10 degrees of rover tilt); run the residual model with and without those sols.
- **Do not flip or mirror aspect.** It is the downslope azimuth, clockwise from north, confirmed against the traverse.
- **Do not drop the 4.3% of bins with no ground temperature silently.** They are flagged with `ground_missing` and `air_missing`.
- **Do not use the pooled RMSE alone.** Sols 1-170 hold 34% of training rows.

**Added Oct 27**

- **Do not use the Mars Climate Database as the baseline.** One grid cell covers the whole map and it has no per-pixel inputs; the Python wrappers are stale. A one-off web comparison at the Gale cell is fine.
- **Do not extrapolate tau** beyond 20 sols between measured sols or past the ends of the record (sols 1-32 have none); keep 0.5 and the placeholder flag there.
- **Do not treat the flux columns as total surface light.** They are direct-beam only and understate daytime light when tau is above about 1.
- **Do not read the tau result for the tree model as tau being unimportant.** Tau is nearly a function of Ls, which the model already has; its value should appear in the physics baseline.
- **Do not draw conclusions about covariates from the Oct 27 ablation alone.** It is a surrogate on raw temperatures with about 14 configurations; repeat it on baseline residuals.

**Carried over from the Oct 24 brief (still valid)**

- Do not unpack `~transform * (lon, lat)` as `(row, col)`: it returns `(col, row)`. This once put the rover calibration 12 km off.
- Do not write the features CSV with `float_format="%.5g"`: it truncates lon and lat to about 1 km. Round per column.
- Do not blame rasterio and matplotlib coexisting for the `0xC06D007F` crash; only a clean environment fixed it.
- Do not multiply big float32 arrays by float64 numpy scalars (NumPy 2 doubles the memory); use `np.float32(scale)`.
- Do not pip install `rasterio` in the assistant's sandbox or claim the raster steps were tested there; the sandbox has no package network. Do not expect the 200 MB rasters as uploads.
- Do not assume the REMS CSV has 48 bins per day or 30-minute bins: it has 15-minute bins (up to 96 per day).
- Do not search `rems_binned_all_sols.csv` for dust devils, and do not build a KNN dust devil classifier. Detection needs raw 1 Hz RMD pressure, and counts are lower bounds because REMS samples about 5 of every 60 minutes.
- Do not use MAVEN, and do not add MCD wind as a per-pixel feature (one value for the whole box).
- Do not use the "Qualitative" THEMIS thermal inertia tiles, the ASU `thm_nir_100m` `.pgm` tiles or `ti_mapplot.pro`, and do not load a whole 2.5 GB THEMIS tile (read a window).
- Do not keep the TES thermal inertia fallback or the "merged" and "source flag" THEMIS files.
- Do not use an absolute cutoff for the dust devil highlight; the score is relative, so use top-N percent.
- Do not build one combined pixel-by-time CSV for both models: a static per-pixel table and a per-bin training table share `pixel_id`.
- Do not treat THEMIS night temperatures as an independent test of a model driven by THEMIS thermal inertia, and do not compare Bradbury Landing values with REMS on dates when the rover was elsewhere.

## 6. Immediate Next Steps

**Priority now: the custom 1D thermal baseline, then the residual model.** The dust devil layer stays parked.

**The training table is frozen (Oct 27).** Attach to the new chat: `gale_rems_training.csv` (the 50-column`, 15,523-row version), rems_sol_profile.csv, rems_blocks.csv, rems_binned_all_sols.csv, build_rems_training_table.ipynb, rems_batch``.ipynb`, `gale_dust_devil_meta.json` and this brief. Do not attach the features CSV or the rasters: the training table already carries every per-pixel covariate the baseline needs, and the assistant sandbox has no `rasterio`.

1. **Confirm the Ls values for the map.** Proposal: 15, 75, 195, 255 and 340; also possible now: 110, 135, 285 and 315. Choose by data support: prefer Ls with at least two blocks and more than one Mars year. Every 30-degree bin has at least 14 training sols; Ls 60-90 has the fewest core sols (11).
2. **Build the custom 1D thermal model and measure it against REMS before adding any learning (decided Oct 27; MCD rejected as the baseline).** Why not MCD: its grid is 5.625 x 3.75 degrees, so the whole map is about one cell; its data are monthly means at 12 fixed times of day, which can understate diurnal extremes; it has no per-pixel thermal inertia, albedo, slope or aspect; the full install (registration, Fortran and netCDF build) is risky on the user's Windows setup; and the Python wrappers look stale (`mars-mcd-helper` last released Nov 2022, Python 3.7-3.10 only; `mcd-python` needs an f2py compile). Optional: one small table from the MCD web interface for the Gale cell (about 12 Ls values by 12 local times; the site is for moderate use only) as a one-off comparison, not a dependency.

   Model: a soil column solved with an implicit finite-difference scheme, layer thickness scaled to the diurnal skin depth, conductivity from thermal inertia with a stated constant volumetric heat capacity, spun up for several sols until periodic, run at each sol's own Ls. Surface energy balance: absorbed solar light (1 minus albedo, direct plus diffuse) minus emitted infrared plus sky infrared. Inputs from the training table: `ls_deg`, LTST, latitude, slope, aspect, `ti_themis_tiu`, `albedo_mean`, `tau` (check `tau_source`) and the flux columns. The flux columns are direct-beam only, so the model needs its own diffuse term that grows with tau. Fit a few global terms on the training blocks only: emissivity, sky infrared, diffuse fraction and a thermal inertia scale factor. Score with LOBO on the 7 training blocks: bias and RMSE by LTST bin for ground temperature, per-block RMSE and the macro average, next to the trivial benchmark (mean REMS ground temperature by LTST bin and Ls bin). If the model does not beat the benchmark, say so. Air temperature stays a separate later step. Write it as an `.ipynb` using numpy only.
3. **Fit the residual model.** LightGBM or XGBoost on baseline-minus-REMS residuals with the planned predictors. Model air temperature separately, as a function of predicted ground temperature, elevation and time of day. Validate with LOBO; report per-block RMSE, the average across blocks and bias by LTST bin, and run it with and without sols 3763-3778. LightGBM is not installed in the assistant sandbox (scikit-learn's `HistGradientBoostingRegressor` is). Optional: a Gaussian process for uncertainty.
4. **Be honest about spatial skill.** All positions lie within about 10 km x 5 km, so terrain covariates barely vary within a block and the sealed test is a time test. Use the Curiosity traverse when the PDS localization product is found, and the 9 usable THEMIS night and twilight temperatures as a crude check only (not independent). Mark air temperature away from the rover as low confidence.
5. **Score the sealed test blocks once,** after the model is frozen, and report that single number beside the LOBO result.
6. **Predict the full grid and export it for the web map.** Block-average the 100 m static table to about 200 m (718 x 738), run the model for each chosen Ls at every 30 min of LTST, and write one array per (Ls, LTST) or a compact float16 stack that matches the `meta.json` georeferencing. Agree the tile or file format with the UI/UX team and the map developers.
7. **Tau is done (Oct 27)**: real for 290 of 319 sols (82 same-sol, 208 interpolated); 29 sols (984 rows) stay on the placeholder and are flagged. Run the baseline and the ablation with and without them. For the map, use a multi-year median tau per Ls and say so, because dust storms such as 2018 make a single-year Ls-to-tau mapping misleading. Repeat the Oct 27 feature ablation on baseline residuals once the baseline exists. After that: the raw-pressure dust devil detector.

**When more sols are added:** rerun the notebook and read the block table and the independence printout. Keep the test ranges unless the assert reports that a new sol landed within 50 sols of a test block; then update that range to the new edges. Choose any new test block once, before looking at test scores.

**Time check:** the Space Apps event is Nov 14-15, 2026, 18 days after Oct 27. A working map-ready heatmap with documented limits matters more than a tuned model; the 1D baseline versus REMS comparison is the next milestone.

**Open questions for the user:** which Ls values to show, which web map format the team needs, and whether to run a one-off MCD web comparison for the Gale cell.

**Revisit later, only after the heatmap ships:** dust devil layer v1 is a labeled heuristic, not a validated predictor. The ordered list is in section 6 of the [Oct 24 handover brief](https://claude.ai/artifact/LSrnYRrYegRyPhYoFrjpn7): validate against raw 1 Hz pressure detections, confirm on the real rasters that the kelvin scale is now stable across seasons with real tau (wired into dust\_devil\_pipeline.ipynb on Oct 27; expected about 3.5 versus 2.85), run a sensitivity check on the top-10% area, add cast shadows, build a multi-sol stack, and label the legend "heuristic likelihood, not detected dust devils".
