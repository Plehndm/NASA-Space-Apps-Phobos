# Gale Crater dust devil likelihood layer

A per-pixel, one-sol **heuristic likelihood** (0 to 1) that a 100 m pixel of Gale Crater favours dust devils, built from terrain, albedo, thermal inertia and modeled sunlight. It is the dust devil map layer for the NASA Space Apps 2026 entry "Interplanetary Survival Guide: Martian Map".

**What it is not.** It is not a calibrated probability and not a set of detected dust devils. `rems_binned_all_sols.csv` holds one mean pressure per 15-minute bin, which averages a vortex away; real detection needs the raw 1 Hz REMS pressure (RMD files). All weights in the score are assumptions, not fitted.

**How the score works.** For each 15-minute bin of the demo sol:
`absorbed sunlight on the tilted surface / sqrt(thermal inertia)` is divided by its own 99.5th percentile, capped at 1, and multiplied by a slope penalty (`exp(-(slope/10 deg)^2)`). The map is the mean over 9 to 16 LTST.

The demo also converts the proxy to kelvin with a scale fitted to the rover's observed ground-minus-air gap (sol 800: 1.756; sol 1163: 2.792). That scale cancels in the percentile division, so it affects the rover sanity check and `rover_sol<N>_table.csv` only, not the map. The scale changing by 59% between seasons shows the proxy does not follow the seasonal change in the observed gap (likely the tau = 0.5 placeholder).

## Notebooks and run order

```
1. build_dust_devil_feature_table  ->  features CSV + meta.json
2. dust_devil_likelihood_demo      ->  likelihood .npz + rover table
3. write_likelihood_geotiff        ->  GeoTIFF          (independent of 4)
4. dust_devil_overlay_preview_pil   ->  preview PNGs     (independent of 3)
```

Run each notebook top to bottom, and **run each in its own kernel** (restart between notebooks). Steps 3 and 4 can run in either order, but both need step 2 first. Re-run step 1 only if an input raster or the bounding box changes.

| # | Notebook | Purpose | Libraries | Reads (in `processed_data/`) | Writes (in `processed_data/`) |
|---|---|---|---|---|---|
| 1 | `build_dust_devil_feature_table.ipynb` | Resamples every input onto the 100 m THEMIS grid and joins them into one table, one row per pixel. Uses the same resampling as the original demo (area average for DEM and slope, sin/cos average for aspect, bilinear for albedo). | numpy, pandas, rasterio | `gale_ti_night_themis100m_native.tif` (output grid and thermal inertia), `gale_dem_20m.tif`, `gale_slope_20m.tif`, `gale_aspect_20m.tif`, `gale_albedo_my24/25/26_native.tif`, `rems_binned_all_sols.csv` | `gale_dust_devil_features_100m.csv`, `gale_dust_devil_meta.json` |
| 2 | `dust_devil_likelihood_demo.ipynb` | Computes the likelihood for one sol: solar geometry and Ls, tilted-surface insolation per bin, the heuristic score, calibration to the rover's observed gap. | numpy, pandas only | `gale_dust_devil_features_100m.csv`, `gale_dust_devil_meta.json`, `rems_binned_all_sols.csv` | `gale_dust_devil_likelihood_sol800.npz`, `rover_sol800_table.csv` |
| 3 | `write_likelihood_geotiff.ipynb` | Writes the likelihood as a two-band GeoTIFF (band 1 = daily mean, band 2 = maximum over the day) with the template's CRS and transform, for tiling into the web map. | numpy, rasterio | the `.npz`, `gale_dust_devil_meta.json`, `gale_ti_night_themis100m_native.tif` | `gale_dust_devil_likelihood_sol800.tif` |
| 4 | `dust_devil_overlay_preview_pil.ipynb` | Sanity-check images: the top 10% of pixels by score highlighted in `#EF4444` on the zoom-11 CTX imagery and hillshade previews. Prints how well the model matches the rover's observed gap. | numpy, pandas, Pillow (no matplotlib) | the `.npz`, `gale_dust_devil_meta.json`, `rover_sol800_table.csv`, the two zoom-11 previews (.png or .jpg) | `likelihood_overlay_sol800.png` (side by side), `likelihood_overlay_sol800_imagery.png`, `likelihood_overlay_sol800_hillshade.png` |

Optional: `dust_devil_overlay_preview.ipynb` is the same check drawn with matplotlib, plus a map of the likelihood and a plot of modeled versus observed gap. It needs a working matplotlib install; use notebook 4 if matplotlib crashes your kernel.

## Settings you will want to change

| Where | Setting | Meaning |
|---|---|---|
| notebook 2 | `DEMO_SOL` | Sol to model (default 800). Also set it in notebooks 3 and 4, which look for files named after the sol. |
| notebook 2 | `TAU`, `TAU_CSV` | Dust opacity. **`TAU = 0.5` is a placeholder**; give a CSV with columns `sol,tau` to use real values. |
| notebook 2 | `SLOPE_SCALE_DEG`, `DAY_LTST` | Slope falloff (10 deg) and the daily-mean window (9 to 16 LTST). |
| notebook 4 | `IMAGERY_PREVIEW`, `HILLSHADE_PREVIEW` | Paths to the zoom-11 previews. Both must cover exactly the template area, or set `PREVIEW_BOUNDS = (west, east, south, north)` if they cover more. |
| notebook 4 | `LIKELY_TOP_PCT`, `HIGHLIGHT`, `SEPARATE_W` | Share of pixels highlighted (10%), highlight colour, width of the separate images. |

## Things to know

- **Grid.** 1436 x 1477 pixels at about 100 m, covering 136.75 to 139.24 E and 6.57 to 4.15 S (the team's bounding box). `pixel_id = row * 1477 + col`, with row 0 at the north edge.
- **Rover pixel.** Row 304, col 372 (pixel_id 449380) for sol 800. An older `gale_dust_devil_meta.json` may list `rover_row` 372 and `rover_col` 304; that was a swapped-order bug (fixed in notebooks 1 and 2). Notebook 2 computes the pixel itself and prints both, so the old file does no harm, but re-run notebook 1 to correct it.
- **Rounded coordinates.** An older features CSV has `lon` and `lat` rounded to about 0.01 deg. Notebook 2 ignores those columns and uses row, col and the transform. Re-run notebook 1 to fix them.
- **Resolution stack.** Elevation, slope and aspect are 20 m averaged to 100 m; thermal inertia is THEMIS at 100 m; albedo is TES at about 3 km, bilinearly smoothed, so it adds a smooth trend and no fine detail. Pixels missing any layer are dropped from the CSV and become NaN in the map.
- **Score is relative.** It is scaled to its own 99.5th percentile, so the top 10% always shows something. Compare the pattern against terrain, not the absolute values.
- **Rover data.** `rems_binned_all_sols.csv` has 115 sols and 5,118 rows in 15-minute bins (96 per day). Sol 800 has 60 bins and 5 are missing ground temperature. The handover brief describes an older file (92 sols, 2,739 rows, 30-minute bins).
- **Memory.** Notebook 2 holds roughly 2.5 GB of arrays at 60 bins. Close other heavy notebooks first.
- **Untested on real data by the author of these notebooks.** They ran end to end on synthetic data with the real REMS CSV and meta.json grid, with rasterio stubbed. Check the printed `DEM at rover pixel` against the REMS elevation, and the model-versus-observed correlation, before trusting a result.

## If the kernel crashes (exit code 3228369023, 0xC06D007F)

This code means two incompatible copies of a native library (GDAL, numpy's BLAS, freetype and similar) are loaded in one Python environment, usually from mixing conda and pip installs. It crashed notebook 2 (numpy) and the matplotlib overlay, so the fix is the environment, not the code. Notebooks 2 and 4 are written to avoid rasterio and matplotlib, which helps only if the cause is those libraries. Clean fix:

```
python -m venv gale-env
gale-env\Scripts\activate
pip install numpy pandas rasterio matplotlib pillow ipykernel
python -m ipykernel install --user --name gale-env
```

Then pick the `gale-env` kernel. The "Kernel is running over TCP without encryption" and "GDAL_DATA is not defined" messages are only warnings.

## Not built yet

- Real dust devil detection from raw 1 Hz REMS pressure (RMD files in `mslrem_1001`), with a threshold rule rather than a classifier, as decided in the handover brief.
- A real dust opacity per sol (Mastcam tau) to replace the 0.5 placeholder.
- Other sols besides 800, or a seasonal stack.
