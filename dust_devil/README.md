# Gale Crater dust devil pipeline (`dust_devil_pipeline.ipynb`) and Mastcam tau table (`../data_prep/build_mastcam_tau_table.ipynb`)

Two notebooks for the dust devil layer of the NASA Space Apps 2026 entry "Interplanetary Survival Guide: Martian Map".

- `dust_devil_pipeline.ipynb` runs the whole layer in one kernel: dust opacity table, per-pixel feature table, a shared reference from sol 800, then per sol the score maps, GeoTIFF, rover check and overlay previews, and per run a summary CSV and an animated GIF.
- `../data_prep/build_mastcam_tau_table.ipynb` is stage 0 of the pipeline as a standalone notebook. Use it only to build or inspect the tau table on its own; the pipeline already contains the same code.

**What the layer is.** A per-pixel, per-sol *heuristic* score (0 to 1) of dust devil activity on the 100 m THEMIS grid (1436 x 1477 pixels, 136.75 to 139.24 E, 6.57 to 4.15 S). It is not a calibrated probability and not a set of detected dust devils. All weights are assumptions, not fitted. Every sol is scored against the same reference (sol 800), so scores can be compared between sols.

## Quick start

1. The inputs below are in the project's `processed_data/` (the notebooks read `../processed_data/`), except the two Mastcam tau tables, which are in `../raw_data/`. The zoom-11 previews are in `../gale_tiles/out_tiles/`.
2. Open `dust_devil_pipeline.ipynb` and edit the config cell (at least `SOLS`; `SOLS_CLIM_CHECK = []` skips the second run). `sols_with_min_bins` prints the sols you can pick (263 sols have at least 40 bins in the current REMS file).
3. Run all cells top to bottom in one kernel (`gale-env`). From the project root, without opening Jupyter:

   ```
   gale-env/Scripts/python.exe -m nbconvert --to notebook --execute dust_devil/dust_devil_pipeline.ipynb --output-dir executed --ExecutePreprocessor.timeout=3600 --ExecutePreprocessor.kernel_name=gale-env
   ```

   Use `python.exe -m nbconvert`, not `jupyter.exe nbconvert`: the latter picked up Anaconda's nbconvert and zmq from PATH. The full run (13 sols) takes about 4.5 minutes.

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
| 2 | Inputs, score, shared reference | Loads the grid, REMS bins and tau. Per LTST bin, the unitless proxy `(1 - albedo) * tilted flux / sqrt(clip(TI, 50))`; the score is `clip(proxy / REF_PROXY, 0, SCORE_CAP) * exp(-(slope / 10 deg)^2)`. `REF_PROXY` is the 99.5th percentile of sol 800's proxy over 96 LTST bins x all pixels; the fixed threshold is the 90th percentile of sol 800's daily-mean score. Both are cached. | `dust_devil_reference_sol800.json` |
| 3 | Per sol | Scores the sol on a fixed grid of 96 quarter-hour LTST bins (daily mean over the 28 bins in 9 to 16 LTST, daily max over all 96), accumulating one bin at a time. Then the rover check on the sol's own REMS bins. Writes the maps, GeoTIFF, rover table and overlays (`score >= threshold` in `#EF4444`, rover as a cyan ring). | `gale_dust_devil_likelihood_sol<N>.npz`, `gale_dust_devil_likelihood_sol<N>.tif`, `rover_sol<N>_table.csv`, `likelihood_overlay_sol<N>.png`, `..._imagery.png`, `..._hillshade.png` |
| 4 | Per run | One summary row per sol and one GIF frame per sol on the hillshade, labelled with sol, Ls, tau, tau source and the share above the threshold. Then checks against the Oct 30 sanity run and the old sol-800 output. | `dust_devil_multisol_summary_<first>-<last>.csv`, `dust_devil_multisol_<first>-<last>.gif` |

### Outputs (in `../processed_data/`)

| File | Content |
|---|---|
| `gale_dust_devil_likelihood_sol<N>.npz` | `likelihood_mean`, `likelihood_max` (float32, H x W), sol, ls_deg, tau, tau_source, ref_sol, ref_proxy, threshold, score_cap, day_ltst, rover_row, rover_col |
| `gale_dust_devil_likelihood_sol<N>.tif` | band 1 daily mean, band 2 daily max; template CRS and transform; band descriptions name the reference sol |
| `rover_sol<N>_table.csv` | per REMS bin: observed ground-minus-air gap, modelled gap in kelvin (this sol's own rover scale), score at the rover pixel |
| `likelihood_overlay_sol<N>[_imagery\|_hillshade].png` | pixels with `score >= threshold` highlighted; legend gives the threshold ("top 10% of sol 800") and this sol's share |
| `dust_devil_reference_sol800.json` | ref_proxy_p995, threshold, tau and tau_source of sol 800, and the settings they depend on (tau band, slope scale, day window, score cap, `LIKELY_TOP_PCT`, the 96 LTST bin centres) |
| `dust_devil_multisol_summary_<first>-<last>.csv` | per sol: ls_deg, tau, tau_source, n_bins, frac_above_threshold, frac_at_cap, rover_corr, rover_scale_k, dem_minus_rems_m |
| `dust_devil_multisol_<first>-<last>.gif` | one frame per sol (800 ms, loops) |

`baseline_sol800/` holds the pre-multi-sol single-sol output of sol 800 (used by the regression tests; do not overwrite). `dust_devil_sanity/` holds the Oct 30 development run of sols 799-804.

## Settings (config cell)

| Setting | Meaning |
|---|---|
| `RUN_TAU_TABLE`, `RUN_FEATURES` | `"auto"` (default) runs the stage only if its output file is missing; `True` forces a rebuild; `False` skips. |
| `RUN_REFERENCE` | `"auto"` loads `dust_devil_reference_sol800.json` if it exists, otherwise builds it; `True` rebuilds. Loading fails if the cache was built with different settings (rebuild with `True`). |
| `SOLS` | Main run (default 799-804: consecutive sols around the reference, Mastcam tau). |
| `SOLS_CLIM_CHECK` | Second run (default 21, 22, 23, 26, 1770, 1775, 1860: sols whose tau comes from the climatology). `[]` skips it. |
| `MIN_BINS` | A sol needs at least this many REMS bins (40). |
| `REF_SOL` | Reference sol (800). |
| `DEMO_SOL` | Stage 1 only: the rover pixel stored in `meta.json`. Stages 2 to 4 take each sol's rover pixel from its own REMS rows. |
| `SLOPE_SCALE_DEG`, `DAY_LTST` | Slope falloff (10 deg) and daily-mean window (9 to 16 LTST). |
| `SCORE_CAP` | Cap on `proxy / REF_PROXY` (1.0, keeps the 0-1 range); `None` disables it. |
| `LIKELY_TOP_PCT` | The threshold is the top N% (10) of sol 800's daily-mean score. Other sols use the same cutoff. |
| `TAU_FILES`, `TAU_BAND` | Paths of the two tau tables; band `"880"` (default), `"440"` or `"mean"`. Changing the band needs `RUN_TAU_TABLE = True` and `RUN_REFERENCE = True`. |
| `TAU_CSV`, `MAX_TAU_GAP_SOLS` | Mastcam tau is interpolated from measurements within 5 sols. |
| `TAU_CLIM_LS_WINDOW`, `TAU_CLIM_EXCLUDE`, `TAU_CLIM_MIN_SOLS` | Climatology fallback: median tau of Mastcam sols within 10 deg of Ls (wrapping at 360), without the 2018 storm sols 2082-2133; fails with fewer than 5 sols. |
| `HIGHLIGHT`, `ALPHA`, `PANEL_W`, `SEPARATE_W`, `GIF_W`, `GIF_MS` | Highlight colour, opacity, panel and separate-image widths, GIF width and frame duration. |
| `PREVIEW_BOUNDS` | `(west, east, south, north)` if the previews cover more than the template. |
| `ROVER_CORR_FLAG` | Sols with a rover correlation below this (0.9) are listed after each run. |

## Dust opacity (tau)

- The tables hold columns Product_ID, Sol, L_s, tau, sigma. 880 nm is the default; 440 nm runs about 5% lower.
- 1,358 sols have a measurement (median tau 0.78). The 2018 global dust storm reaches tau 8.6 around sols 2082 to 2133.
- **Mastcam starts at sol 33.** Sols with no measurement within `MAX_TAU_GAP_SOLS` (sols 1 to 32, and gaps such as sols 1770, 1775, 1860) fall back to the **Ls climatology**: the median over Mastcam sols at the same season in other Mars years. This is the only fallback. Its label, `climatology Ls±10, n=<k> sols`, appears in the npz, the summary CSV, the overlay title and the GIF frame. There is no placeholder tau any more.
- Sol 800 gets 1.50 (Mastcam); sols 21 to 26 get about 0.80, sols 1770 and 1775 about 0.63, sol 1860 0.48 (climatology).
- The parser splits lines on commas and asserts five fields per row and that the parsed row count equals the table's "Lines of data in this table". A parser that matches only product IDs starting with `D` silently drops the 86 dust-storm rows, and the `******` sigma values need to be coerced to NaN rather than converted.
- Mastcam gives a column optical depth; the model applies it to broadband sunlight as a simplification, with one value per sol for the whole day.

## Things to know

- **The reference sol is dusty, so clearer sols saturate.** Sol 800 has tau about 1.5. Any sol with less dust or more sun reaches `SCORE_CAP` over much of the crater: 6 to 11% of pixels for sols 799-804, but 56 to 59% for sols 1770-1860 (tau 0.48-0.63) and 84 to 85% for sols 21-26 (tau about 0.8). On those sols 27 to 35% of pixels clear the threshold and the map shows little contrast. `frac_at_cap` in the summary counts pixels that reach the cap in at least one of the 96 bins. A clearer reference sol or `SCORE_CAP = None` would change this; neither has been decided.
- **The highlighted share varies by sol, by design.** The threshold is fixed at sol 800's top 10% (0.593), so a sol with more sunlight shows more highlighted area. For sols 799-804 it follows tau (9.1 to 12.5%).
- **The maps use a fixed LTST grid,** not each sol's REMS bins. REMS coverage inside 9 to 16 LTST varies by sol (16 to 21 bins) and, when used for the maps, it drove the day-to-day change more than dust did. REMS bins are used only for the rover check.
- **The kelvin scale does not shape the map.** It is fitted per sol (max of observed gap / max of proxy at the rover pixel) and only affects the rover check and `rover_sol<N>_table.csv`. One REMS spike moves it.
- **Climatology tau is a stand-in.** It comes from other Mars years at the same Ls. Read those sols as a check of the path, not as observed dust conditions.
- **Rover check.** Sols 799-804: correlation 0.94 to 0.98, DEM minus REMS elevation +24 m. Climatology sols: 0.80 (sol 21, only 40 bins) to 0.97; DEM minus REMS -1.5 to +28 m.
- **Sol 800 changed from the single-sol version.** The fixed LTST grid moves its daily mean by up to 0.035 and its max by up to 0.015 relative to `baseline_sol800/`. The arithmetic itself is checked by the regression tests.
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
