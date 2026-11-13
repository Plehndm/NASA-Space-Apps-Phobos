# Gale Crater Dust Devil Heating Index (`dust_devil_pipeline.ipynb`) and Mastcam tau table (`../data_prep/build_mastcam_tau_table.ipynb`)

Two notebooks for the dust devil layer of the NASA Space Apps 2026 entry "Interplanetary Survival Guide: Martian Map".

- `dust_devil_pipeline.ipynb` runs the whole layer in one kernel: dust opacity table, per-pixel feature table, a shared reference from sol 1850, then per sol the heating index maps, GeoTIFF, rover check and overlay previews, and per run a summary CSV and an animated GIF.
- `../data_prep/build_mastcam_tau_table.ipynb` is stage 0 of the pipeline as a standalone notebook. Use it only to build or inspect the tau table on its own; the pipeline already contains the same code.

**What the layer is.** The **Dust Devil Heating Index**: a per-pixel, per-sol *heuristic* (0 to 1) of how strongly the Sun heats the ground, the main ingredient dust devils need, on the 100 m THEMIS grid (1436 x 1477 pixels, 136.75 to 139.24 E, 6.57 to 4.15 S). It is not a probability of dust devils and not a set of detected dust devils. All weights are assumptions, not fitted. Every sol is scored against the same reference (sol 1850), so the index can be compared between sols: a dusty sol such as 800 heats less, a clear one more.

Naming: output files say `heating_index` (renamed from `likelihood`). Inside the npz files the two arrays keep their original keys, `likelihood_mean` and `likelihood_max`, so the regression tests and the `baseline_sol800/` fixture still compare like with like.

## How to explain it (for the judges)

**30-second explanation**

> Dust devils form when sunlight heats the ground much faster than the air above it. The hot surface layer becomes unstable, rises and starts to spin. Our map estimates that heating for every 100-metre pixel in Gale Crater: how much sunlight reaches the ground (time of day, season, slope, dust in the air), how much the surface absorbs (dark ground absorbs more), and how quickly it warms (loose sand heats fast, bedrock slowly).
>
> Red means the strongest heating: the top 10% of a typical clear day. Because every sol uses the same scale, you can see the seasons change: in the dusty season the whole crater heats less and the map fades from red to yellow.

**What we claim, and the evidence**

| Claim | Evidence |
|---|---|
| The heating estimate tracks real ground heating | At the rover's position, the modelled ground-minus-air temperature gap correlates 0.94-0.98 with Curiosity's REMS measurements on sols 799-804, and 0.80-0.97 on the other sols run (clear-season and climatology sols). |
| Dust reduces heating | On sol 800 (dust optical depth 1.5) the example pixel's average sunlight drops from 219 to 174 W/m2 and its index from 0.59 (high) to 0.47 (moderate). Dusty sols 799-804 have 0.2-0.4% of the crater in the high level, against 6-10% for the clear sols 1830-1865. |
| Comparisons between sols are fair | Every sol is scored against one fixed reference, sol 1850, chosen at the median of the 263 sols with enough REMS data; not each sol against itself. |

The correlation checks the **heating**, not dust devils. Say so if asked.

**Do not claim**

- A probability ("59% chance of a dust devil") or a dust devil density: the index has not been compared with observed dust devils.
- That dust devils occur in the red areas: red means the conditions favour them most.
- That dust moves activity around: tau is one value per sol for the whole crater, so dust only dims or brightens the map.

**Likely questions**

- *Why is heating enough?* It is not the whole story: dust devils also need loose dust, some wind to start the rotation and a deep enough unstable layer of air. We model the ingredient that varies most across the crater floor and that we can check against rover data.
- *Did you check it against real dust devils?* Not yet. The next step is to compare with Curiosity's camera surveys or the short pressure dips REMS records when a dust devil passes (needs the raw 1 Hz pressure data).
- *Why do some sunny sols saturate?* Sunlight varies about 2x over the record; with one fixed scale and a 0-1 range the sunniest sols reach the top. The median-sol reference balances this.
- *Where do the weights come from?* The structure follows the physics (absorbed sunlight / sqrt(thermal inertia) sets how fast a surface heats); the slope penalty and the reference choice are documented assumptions.

**Why it is useful for the survival guide:** it shows where and when the ground heats strongly enough to lift dust: where to expect dust devils, dust on solar panels and reduced visibility, and when (late morning to mid-afternoon, clear seasons).

## Quick start

1. The inputs below are in the project's `processed_data/` (the notebooks read `../processed_data/`), except the two Mastcam tau tables, which are in `../raw_data/`. The zoom-11 previews are in `../gale_tiles/out_tiles/`.
2. Open `dust_devil_pipeline.ipynb` and edit the config cell (the run lists `SOLS_CLEAR`, `SOLS_DUSTY`, `SOLS_CLIM_CHECK`; `[]` skips a run). `sols_with_min_bins` prints the sols you can pick (263 sols have at least 40 bins in the current REMS file).
3. Run all cells top to bottom in one kernel (`gale-env`). From the project root, without opening Jupyter:

   ```
   gale-env/Scripts/python.exe -m nbconvert --to notebook --execute dust_devil/dust_devil_pipeline.ipynb --output-dir dust_devil/executed --ExecutePreprocessor.timeout=3600 --ExecutePreprocessor.kernel_name=gale-env
   ```

   Use `python.exe -m nbconvert`, not `jupyter.exe nbconvert`: the latter picked up Anaconda's nbconvert and zmq from PATH. The full run (18 sols in three runs) takes about 6 minutes.

## Inputs (in `../processed_data/` unless noted)

| File | Used by | Notes |
|---|---|---|
| `msl-tau-880-arch-3953.txt`, `msl-tau-440-arch-3953.txt` | stage 0 | In `../raw_data/`. Mastcam aerosol optical depth tables (Lemmon), latest version through sol 3953. Place the two .txt files directly in the folder; no zip or subfolder. |
| `rems_binned_all_sols.csv` | stages 0 to 4 | REMS 15-minute bins (bin = LTST x 4, up to 96 per day). Used for the sol list, each sol's rover position and the rover check. |
| `gale_ti_night_themis100m_native.tif` | stages 1, 3 | The output grid (THEMIS 100 m thermal inertia). |
| `gale_dem_20m.tif`, `gale_slope_20m.tif`, `gale_aspect_20m.tif` | stage 1 | 20 m rasters; large, so stage 1 runs locally. |
| `gale_albedo_my24_native.tif`, `..._my25_...`, `..._my26_...` | stage 1 | TES albedo (about 3 km), bilinearly smoothed. |
| two zoom-11 previews (.png or .jpg), in `../gale_tiles/out_tiles/` | stages 3, 4 | CTX imagery and hillshade, covering exactly the template area unless `PREVIEW_BOUNDS` is set. |

## Stages

| # | Stage | What it does | Writes |
|---|---|---|---|
| 0 | Mastcam tau table | Parses the two tau tables, takes the median tau per sol (floor of the fractional sol), reports how many REMS sols have a measurement. | `mastcam_tau_per_sol.csv` (sol, tau, n, tau_min, tau_max, ls_deg, band) |
| 1 | Feature table | Resamples DEM and slope (area average), aspect (average of sin and cos), albedo (bilinear) and THEMIS thermal inertia onto the 100 m template and joins them, one row per pixel. Pixels missing any layer are dropped. | `gale_dust_devil_features_100m.csv`, `gale_dust_devil_meta.json` |
| 2 | Inputs, score, shared reference | Loads the grid, REMS bins and tau. Per LTST bin, the unitless proxy `(1 - albedo) * tilted flux / sqrt(clip(TI, 50))`; the score is `clip(proxy / REF_PROXY, 0, SCORE_CAP) * exp(-(slope / 10 deg)^2)`. `REF_PROXY` is the 99.5th percentile of the reference sol's proxy over 96 LTST bins x all pixels; the three level cuts are its daily-mean score at the top 50 / 30 / 10% (the last is the threshold). All are cached. | `dust_devil_heating_index_reference_sol1850.json` |
| 3 | Per sol | Scores the sol on a fixed grid of 96 quarter-hour LTST bins (daily mean over the 28 bins in 9 to 16 LTST, daily max over all 96), accumulating one bin at a time. Then the rover check on the sol's own REMS bins. Writes the maps, GeoTIFF, rover table and overlays (three levels: low yellow, moderate orange, high red; rover as a cyan ring). | `gale_dust_devil_heating_index_sol<N>.npz`, `gale_dust_devil_heating_index_sol<N>.tif`, `rover_sol<N>_table.csv`, `heating_index_overlay_sol<N>.png`, `..._imagery.png`, `..._hillshade.png` |
| 4 | Per run | One summary row per sol and one GIF frame per sol on the hillshade, labelled with sol, Ls, tau, tau source and the share in each level. Then checks that the threshold and level cuts equal the reference sol's percentiles and compares the runs. | `dust_devil_heating_index_summary_<first>-<last>.csv`, `dust_devil_heating_index_<first>-<last>.gif` |

### Outputs (in `outputs/`, inside this folder; moved from `../processed_data/`)

| File | Content |
|---|---|
| `gale_dust_devil_heating_index_sol<N>.npz` | `likelihood_mean`, `likelihood_max` (float32, H x W), sol, ls_deg, tau, tau_source, ref_sol, ref_proxy, threshold, class_cuts, score_cap, day_ltst, rover_row, rover_col |
| `gale_dust_devil_heating_index_sol<N>.tif` | band 1 daily mean, band 2 daily max; template CRS and transform; band descriptions `heating_index_mean_9-16LTST_shared_ref_sol1850` and `heating_index_max_over_day_shared_ref_sol1850` |
| `rover_sol<N>_table.csv` | per REMS bin: observed ground-minus-air gap, modelled gap in kelvin (this sol's own rover scale), score at the rover pixel |
| `heating_index_overlay_sol<N>[_imagery\|_hillshade].png` | three levels shaded; the legend names the fixed score bands ("High >= 0.590 (top 10% of sol 1850)") and this sol's share in each |
| `dust_devil_heating_index_reference_sol1850.json` | ref_proxy_p995, threshold, tau and tau_source of the reference sol, and the settings they depend on (tau band, slope scale, day window, score cap, `LIKELY_TOP_PCT`, `CLASS_TOP_PCTS`, the 96 LTST bin centres), plus `class_cuts` |
| `dust_devil_heating_index_summary_<first>-<last>.csv` | per sol: ls_deg, tau, tau_source, n_bins, frac_above_threshold, frac_at_cap, rover_corr, rover_scale_k, dem_minus_rems_m, frac_low, frac_moderate, frac_high (`frac_high` = `frac_above_threshold`) |
| `dust_devil_heating_index_<first>-<last>.gif` | one frame per sol (800 ms, loops) |

`outputs/_dev/baseline_sol800/` holds the pre-multi-sol single-sol output of sol 800 (used by the regression tests; do not overwrite). `outputs/_dev/dust_devil_sanity/` holds the first development run of sols 799-804 (sol-800 reference). Both keep the old `likelihood` file names. `dust_devil_reference_sol800.json` is the superseded sol-800 reference; the pipeline no longer reads it.

## Settings (config cell)

| Setting | Meaning |
|---|---|
| `RUN_TAU_TABLE`, `RUN_FEATURES` | `"auto"` (default) runs the stage only if its output file is missing; `True` forces a rebuild; `False` skips. |
| `RUN_REFERENCE` | `"auto"` loads `dust_devil_heating_index_reference_sol<REF_SOL>.json` if it exists, otherwise builds it; `True` rebuilds. Loading fails if the cache was built with different settings (rebuild with `True`). |
| `SOLS_CLEAR` | Clear-season run around the reference (default 1830, 1840, 1845, 1850, 1860, 1865; Ls 67-83). `[]` skips it. |
| `SOLS_DUSTY` | Dusty-season run (default 799-804: tau about 1.5, Ls 228-231). `[]` skips it. |
| `SOLS_CLIM_CHECK` | Second run (default 21, 22, 23, 26, 1770, 1775, 1860: sols whose tau comes from the climatology). `[]` skips it. |
| `MIN_BINS` | A sol needs at least this many REMS bins (40). |
| `REF_SOL` | Reference sol (1850; see "Why sol 1850" below). Gate 11 checks that any sol works. |
| `DEMO_SOL` | Stage 1 only: the rover pixel stored in `meta.json`. Stages 2 to 4 take each sol's rover pixel from its own REMS rows. |
| `SLOPE_SCALE_DEG`, `DAY_LTST` | Slope falloff (10 deg) and daily-mean window (9 to 16 LTST). |
| `SCORE_CAP` | Cap on `proxy / REF_PROXY` (1.0, keeps the 0-1 range); `None` disables it. |
| `LIKELY_TOP_PCT` | The threshold is the top N% (10) of the reference sol's daily-mean score. Other sols use the same cutoff. |
| `CLASS_TOP_PCTS` | Overlay levels low / moderate / high, cut at the top (50, 30, 10)% of the reference sol's map: 0.348 / 0.474 / 0.590 for sol 1850. Three strictly decreasing values; the last must equal `LIKELY_TOP_PCT`. |
| `TAU_FILES`, `TAU_BAND` | Paths of the two tau tables; band `"880"` (default), `"440"` or `"mean"`. Changing the band needs `RUN_TAU_TABLE = True` and `RUN_REFERENCE = True`. |
| `TAU_CSV`, `MAX_TAU_GAP_SOLS` | Mastcam tau is interpolated from measurements within 5 sols. |
| `TAU_CLIM_LS_WINDOW`, `TAU_CLIM_EXCLUDE`, `TAU_CLIM_MIN_SOLS` | Climatology fallback: median tau of Mastcam sols within 10 deg of Ls (wrapping at 360), without the 2018 storm sols 2082-2133; fails with fewer than 5 sols. |
| `LEVEL_COLOURS`, `ALPHA`, `PANEL_W`, `SEPARATE_W`, `GIF_W`, `GIF_MS` | Colours for low / moderate / high (`#FACC15`, `#F97316`, `#DC2626`), opacity, panel and separate-image widths, GIF width and frame duration. |
| `PREVIEW_BOUNDS` | `(west, east, south, north)` if the previews cover more than the template. |
| `ROVER_CORR_FLAG` | Sols with a rover correlation below this (0.9) are listed after each run. |

## Dust opacity (tau)

- The tables hold columns Product_ID, Sol, L_s, tau, sigma. 880 nm is the default; 440 nm runs about 5% lower.
- 1,358 sols have a measurement (median tau 0.78). The 2018 global dust storm reaches tau 8.6 around sols 2082 to 2133.
- **Mastcam starts at sol 33.** Sols with no measurement within `MAX_TAU_GAP_SOLS` (sols 1 to 32, and gaps such as sols 1770, 1775, 1860) fall back to the **Ls climatology**: the median over Mastcam sols at the same season in other Mars years. This is the only fallback. Its label, `climatology Ls±10, n=<k> sols`, appears in the npz, the summary CSV, the overlay title and the GIF frame. There is no placeholder tau any more.
- Sol 800 gets 1.50 (Mastcam); sols 21 to 26 get about 0.80, sols 1770 and 1775 about 0.63, sol 1860 0.48 (climatology).
- The parser splits lines on commas and asserts five fields per row and that the parsed row count equals the table's "Lines of data in this table". A parser that matches only product IDs starting with `D` silently drops the 86 dust-storm rows, and the `******` sigma values need to be coerced to NaN rather than converted.
- Mastcam gives a column optical depth; the model applies it to broadband sunlight as a simplification, with one value per sol for the whole day.

## What the score means

A score of 0.59 means that, averaged over 9:00-16:00 local solar time, the pixel's surface heating is 59% of the near-maximum heating on the reference sol (1850). It is a relative measure of how hard the Sun drives the ground, not a probability and not a count of dust devils.

- **Why heating.** Dust devils form when the ground is much hotter than the air above it. The score estimates that gap from the sunlight reaching the surface (time of day, season, slope orientation, dust), the share absorbed (`1 - albedo`; dark ground absorbs more) and how fast the surface heats (`1 / sqrt(TI)`; loose sand heats fast, bedrock slowly).
- **Recipe.** Per quarter-hour, `(1 - albedo) * sunlight / sqrt(TI)`, divided by the near-maximum `REF_PROXY` (16.47: only 0.5% of sol 1850's pixel x quarter-hour values are higher), capped at 1, times the slope weight (1.0 flat, 0.78 at 5 deg, 0.37 at 10 deg), averaged over the 28 quarter-hours from 9:00 to 16:00.
- **Example.** Crater-floor pixel row 834, col 905 (slope 1 deg, albedo 0.14, TI 363). Sol 1850: average sunlight 219 W/m2 (277 at 11:52), score 0.59, high. Sol 800: dust cuts the average to 174 W/m2, score 0.47, moderate.
- **Rough kelvin reading.** With sol 1850's rover calibration (2.7 K per proxy unit), 1.0 is about a 45 K ground-air gap and 0.59 about 26 K averaged over the day. Loose: the calibration is fitted at one rover pixel and one REMS spike moves it.
- **Levels.** High (>= 0.590): heating at least as strong as the example pixel on a clear day. Moderate (0.474-0.590): what that pixel gets under heavy dust. Low (0.348-0.474): brighter or rockier ground, or gentle slopes facing away from the Sun. Unshaded (< 0.348): steep slopes, high-TI bedrock or bright ground.
- **Limit.** Tau is one value per sol for the whole crater, so dust scales the map up or down but cannot move where activity is likely (sol 800's map correlates 0.996 with sol 1850's).

## Things to know

- **Why sol 1850.** The reference statistic (p99.5 of the proxy) varies about 2x across the record: 10.4 to 23.1 over the 263 sols with at least 40 bins. The first reference, sol 800 (tau 1.5), was the 12th dimmest, so almost every other sol saturated (243 of 263 sols had more than 20% of pixels at the cap; sols 21-26 had 84%). The sunniest sols (around sol 90) fail the other way: the median sol would have 0.04% of pixels above the threshold. Sol 1850 (Ls 76, tau 0.44 measured that sol, rover correlation 0.97, 57 bins) sits at the median. Candidates were limited to Mastcam tau within 1 sol, 55-96 bins, rover correlation >= 0.93, and outside sols 3763-3778 and the sealed test blocks (1343-1360, 3069-3110). User decision.
- **Saturation is reduced, not gone.** With sol 1850, about 100 of 263 sols still have more than 20% of pixels at the cap (estimated on a subsampled grid), and about 21 have less than 1% above the threshold. A single fixed reference cannot cover a 2x range of sunlight with a 0-1 cap. In the current runs: clear season 3-6% at cap, climatology sols 2-20%, dusty sols 0-0.1%. `frac_at_cap` counts pixels that reach the cap in at least one of the 96 bins.
- **Three levels, fixed cut values.** Every sol is shaded with the same cuts from sol 1850 (0.348 / 0.474 / 0.590), so the shares vary by sol. Sol 1850: 20 / 20 / 10% low / moderate / high (half the crater unshaded). Sols 1830-1865: 20-22 / 19-20 / 6-10%. Sols 21-26: 16-17 / 20 / 16-17%. Dusty sols 799-804: 27 / 7-10 / 0.2-0.4%: the pattern stays visible in low and moderate, and the near-absent high level says the dusty season is quieter. The legend names score bands, not shares of the sol shown. The GIF uses a 256-colour palette, so its swatches and the rover ring are slightly off; the PNG overlays have exact colours.
- **The maps use a fixed LTST grid,** not each sol's REMS bins. REMS coverage inside 9 to 16 LTST varies by sol (16 to 21 bins) and, when used for the maps, it drove the day-to-day change more than dust did. REMS bins are used only for the rover check.
- **The kelvin scale does not shape the map.** It is fitted per sol (max of observed gap / max of proxy at the rover pixel) and only affects the rover check and `rover_sol<N>_table.csv`. One REMS spike moves it.
- **Climatology tau is a stand-in.** It comes from other Mars years at the same Ls. Read those sols as a check of the path, not as observed dust conditions.
- **Rover check.** Sols 799-804: correlation 0.94 to 0.98, DEM minus REMS elevation +24 m. Sols 1830-1865: 0.84 (sol 1830) to 0.97, +6 to +20 m. Climatology sols: 0.80 (sol 21, only 40 bins) to 0.97; -1.5 to +28 m.
- **Bad REMS sols.** Sols 2875 and 2878 have 110 and 124 bins (at most 96 are possible), so their rows are probably duplicated. Keep them out of runs until the REMS table is checked.
- **`baseline_sol800/` is a test fixture, not a current map.** The current sol-800 maps differ from it by design (fixed LTST grid, reference sol 1850). The regression tests use it to check the arithmetic with a sol-800 reference.
- **Resolution stack.** DEM, slope and aspect are 20 m averaged to 100 m; thermal inertia is THEMIS at 100 m; albedo is TES at about 3 km, so it adds a smooth trend and no fine detail.
- **Grid.** `pixel_id = row * 1477 + col`, row 0 at the north edge. The rover pixel is `col = floor((lon - T_C) / T_A)`, `row = floor((lat - T_F) / T_E)` (floor, not `int()`, so positions just outside the north or west edge fail instead of mapping to row or col 0). Sol 800: row 304, col 372, pixel_id 449380.
- **Memory.** The reference percentile stores only the sunlit bins (about 0.4 GB, plus a copy while it partitions); per-sol scoring holds a few full-grid float32 arrays. The run needs roughly 1 GB free.
- **Libraries.** numpy and pandas throughout; rasterio in stages 1 and 3 (imported only there); Pillow for the overlays and GIF, no matplotlib.
- **Tests.** `tests/` holds the gates (synthetic grids, plus three real-data tests): `gale-env/Scripts/python.exe -m pytest dust_devil/tests -q` from the project root, about 75 s. The code was developed in `dev/multisol.py`; the notebook cells are copied from it.
- **Not built.** Real dust devil detection from raw 1 Hz REMS pressure, forecasting sols without REMS data, tau within a sol, and an aggregate (frequency) map.

## If the kernel crashes (exit code 3228369023, 0xC06D007F)

Two incompatible copies of a native library are loaded in one environment, usually from mixing conda and pip. Use a clean environment:

```
python -m venv gale-env
gale-env\Scripts\activate
pip install numpy pandas rasterio matplotlib pillow ipykernel
python -m ipykernel install --user --name gale-env
```

Then pick the `gale-env` kernel. The "Kernel is running over TCP without encryption" and "GDAL_DATA is not defined" messages are only warnings.
