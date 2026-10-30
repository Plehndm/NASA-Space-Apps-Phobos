# Gale Crater dust devil pipeline (`dust_devil_pipeline.ipynb`) and Mastcam tau table (`../data_prep/build_mastcam_tau_table.ipynb`)

Two notebooks for the dust devil layer of the NASA Space Apps 2026 entry "Interplanetary Survival Guide: Martian Map".

- `dust_devil_pipeline.ipynb` runs the whole layer in one kernel: dust opacity table, per-pixel feature table, one-sol likelihood, GeoTIFF and overlay previews.
- `../data_prep/build_mastcam_tau_table.ipynb` is stage 0 of the pipeline as a standalone notebook. Use it only to build or inspect the tau table on its own; the pipeline already contains the same code.

**What the layer is.** A per-pixel, one-sol *heuristic* likelihood (0 to 1) on the 100 m THEMIS grid (1436 x 1477 pixels, 136.75 to 139.24 E, 6.57 to 4.15 S). It is a relative score, not a calibrated probability and not a set of detected dust devils. All weights are assumptions, not fitted.

## Quick start

1. The inputs below are in the project's `processed_data/` (the notebooks read `../processed_data/`), except the two Mastcam tau tables, which are in `../raw_data/`. The zoom-11 previews are in `../gale_tiles/out_tiles/`.
2. Open `dust_devil_pipeline.ipynb`, edit the config cell (at least `DEMO_SOL`, `IMAGERY_PREVIEW`, `HILLSHADE_PREVIEW`).
3. Run all cells top to bottom in one kernel.

## Inputs (in `../processed_data/` unless noted)

| File | Used by | Notes |
|---|---|---|
| `msl-tau-880-arch-3953.txt`, `msl-tau-440-arch-3953.txt` | stage 0 | In `../raw_data/`. Mastcam aerosol optical depth tables (Lemmon), latest version through sol 3953. Place the two .txt files directly in the folder; no zip or subfolder. |
| `rems_binned_all_sols.csv` | stages 0, 1, 2 | REMS 15-minute bins (bin = LTST x 4, up to 96 per day). |
| `gale_ti_night_themis100m_native.tif` | stages 1, 3 | The output grid (THEMIS 100 m thermal inertia). |
| `gale_dem_20m.tif`, `gale_slope_20m.tif`, `gale_aspect_20m.tif` | stage 1 | 20 m rasters; large, so stage 1 runs locally. |
| `gale_albedo_my24_native.tif`, `..._my25_...`, `..._my26_...` | stage 1 | TES albedo (about 3 km), bilinearly smoothed. |
| two zoom-11 previews (.png or .jpg), in `../gale_tiles/out_tiles/` | stage 4 | CTX imagery and hillshade, covering exactly the template area unless `PREVIEW_BOUNDS` is set. |

## Stages

| # | Stage | What it does | Writes |
|---|---|---|---|
| 0 | Mastcam tau table | Parses the two tau tables, takes the median tau per sol (floor of the fractional sol), reports how many REMS sols have a measurement. | `mastcam_tau_per_sol.csv` (sol, tau, n, tau_min, tau_max, ls_deg, band) |
| 1 | Feature table | Resamples DEM and slope (area average), aspect (average of sin and cos), albedo (bilinear) and THEMIS thermal inertia onto the 100 m template and joins them, one row per pixel. Computes the rover pixel for `DEMO_SOL`. Pixels missing any layer are dropped. | `gale_dust_devil_features_100m.csv`, `gale_dust_devil_meta.json` |
| 2 | Likelihood | For each REMS bin of `DEMO_SOL`: absorbed insolation on the tilted surface divided by the square root of thermal inertia (clipped at 50), divided by its own 99.5th percentile, capped at 1, times a slope penalty `exp(-(slope/10 deg)^2)`; the map is the mean over 9 to 16 LTST. Also compares the model with the rover's observed ground-minus-air gap. | `gale_dust_devil_likelihood_sol<N>.npz`, `rover_sol<N>_table.csv` |
| 3 | GeoTIFF | Two bands on the template's CRS and transform: 1 = daily mean, 2 = maximum over the day. | `gale_dust_devil_likelihood_sol<N>.tif` |
| 4 | Overlay previews | Top 10% of pixels by score in `#EF4444` on the imagery and hillshade previews, with the rover as a cyan ring. Side by side and as separate images. | `likelihood_overlay_sol<N>.png`, `..._imagery.png`, `..._hillshade.png` |

## Settings (config cell)

| Setting | Meaning |
|---|---|
| `RUN_TAU_TABLE`, `RUN_FEATURES` | `"auto"` (default) runs the stage only if its output file is missing; `True` forces a rebuild; `False` skips. |
| `RUN_GEOTIFF` | `True` (default) or `False`. |
| `DEMO_SOL` | Sol to model (default 800). Stage 2 prints which sols have at least 40 bins. Stage 1 stores the rover pixel for this sol in `meta.json`, so re-run stage 1 (`RUN_FEATURES = True`) after changing it. |
| `TAU_FILES`, `TAU_BAND` | Paths of the two tau tables; band `"880"` (default), `"440"` or `"mean"`. Changing the band needs `RUN_TAU_TABLE = True`. |
| `TAU_CSV`, `MAX_TAU_GAP_SOLS`, `TAU` | Stage 2 interpolates tau from the table using measurements within `MAX_TAU_GAP_SOLS` (5) of `DEMO_SOL` and fails if there are none. `TAU_CSV = None` uses the placeholder `TAU = 0.5`. |
| `SLOPE_SCALE_DEG`, `DAY_LTST` | Slope falloff (10 deg) and daily-mean window (9 to 16 LTST). |
| `LIKELY_TOP_PCT`, `HIGHLIGHT`, `ALPHA`, `PANEL_W`, `SEPARATE_W` | Overlay share highlighted (10%), colour, opacity, panel width and separate-image width. |
| `PREVIEW_BOUNDS` | `(west, east, south, north)` if the previews cover more than the template. |

## Dust opacity (tau)

- The tables hold columns Product_ID, Sol, L_s, tau, sigma. 880 nm is the default; 440 nm runs about 5% lower.
- 1,358 sols have a measurement (median tau 0.78). The 2018 global dust storm reaches tau 8.6 around sols 2082 to 2133.
- **Mastcam starts at sol 33.** REMS sols 1 to 32 (25 of the 115 in the current file) have no tau, so stage 2 fails for them instead of guessing. The same happens for any sol more than `MAX_TAU_GAP_SOLS` from a measurement.
- Sol 800 gets about 1.50 and sol 1163 about 0.52, against the old placeholder of 0.5.
- The parser splits lines on commas and asserts five fields per row and that the parsed row count equals the table's "Lines of data in this table". A parser that matches only product IDs starting with `D` silently drops the 86 dust-storm rows, and the `******` sigma values need to be coerced to NaN rather than converted.
- Mastcam gives a column optical depth; the model applies it to broadband sunlight as a simplification, with one value per sol for the whole day.

## Things to know

- **The score is relative.** It is scaled to its own 99.5th percentile, so the top 10% always shows something. Compare the pattern against terrain, not the absolute values.
- **The kelvin scale does not shape the map.** The proxy is converted to kelvin using the rover's observed gap, but the scale cancels in the percentile division. It only affects the rover check and `rover_sol<N>_table.csv`.
- **Resolution stack.** DEM, slope and aspect are 20 m averaged to 100 m; thermal inertia is THEMIS at 100 m; albedo is TES at about 3 km, so it adds a smooth trend and no fine detail.
- **Grid.** `pixel_id = row * 1477 + col`, row 0 at the north edge. The rover pixel is computed as `col = (lon - T_C) / T_A`, `row = (lat - T_F) / T_E`. Sol 800: row 304, col 372, pixel_id 449380.
- **Memory.** Stage 2 holds roughly 2.5 GB of arrays at 60 bins. The pipeline frees the large arrays at the end of stages 1 and 2.
- **Libraries.** Stages 0 and 2: numpy and pandas. Stages 1 and 3: also rasterio (imported only inside those stages). Stage 4: Pillow, no matplotlib.
- **Not tested on the real rasters by the author.** The tau, likelihood and overlay stages ran on synthetic inputs with the real REMS CSV and tau tables; the feature stage ran with a stand-in for rasterio. Check the printed "DEM at rover pixel" against the REMS elevation, and the model-versus-observed correlation, before trusting a result.
- **Not built yet.** Real dust devil detection from raw 1 Hz REMS pressure, tau for sols 1 to 32 or within a sol, and a seasonal stack of sols.

## If the kernel crashes (exit code 3228369023, 0xC06D007F)

Two incompatible copies of a native library are loaded in one environment, usually from mixing conda and pip. Use a clean environment:

```
python -m venv gale-env
gale-env\Scripts\activate
pip install numpy pandas rasterio matplotlib pillow ipykernel
python -m ipykernel install --user --name gale-env
```

Then pick the `gale-env` kernel. The "Kernel is running over TCP without encryption" and "GDAL_DATA is not defined" messages are only warnings.
