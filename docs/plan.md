# Plan: What We Try Next

The long-range plan is `1D Thermal Baseline Build Steps.md`. This file holds only the next step's concrete design. Replace it when the step is done, and move what happened to `progress.md`.

## Where Step 5 stands (Oct 28)

Ground temperature is done at the rover. The chosen residual model, `flann_safe`, is a FLANN ridge with no albedo terms and covariates clamped to the rover's 1st-99th percentiles. It scores a LOBO macro RMSE of 4.74 K against the benchmark's 5.38 K. 9 configurations were tried. Details are in `progress.md`.

**User decision (Oct 28): the map uses `flann_safe_no_ti`, not `flann_safe`.** That is the same model without its TI terms:

- It scores a LOBO macro RMSE of 4.86 K (4.99 K without sols 3763-3778) and a pooled RMSE of 5.83 K.
- The TI terms earned only 0.12 K at the rover, under the 0.2 K bar every other addition had to clear.
- Through the clamp, the TI terms would have warmed nights by about 3.3 K on the 82% of crater pixels whose THEMIS TI is below the rover's 361 tiu minimum.
- TI still enters through the physics baseline: THEMIS TI x `ti_scale`, as fitted.

## Next: Step 6, the map

Starting it brings the full-grid export into scope (the user's go-ahead, Oct 28). Begin with a dry run on a small window around the rover before the full grid.

### Decisions made (Oct 28)

| Item | Decision |
|---|---|
| Residual model | `flann_safe_no_ti`, refit on all training rows (all-blocks baseline parameters), with its all-blocks clamp ranges for slope and the baseline-as-predictor. |
| Ls values | 15, 75, 195, 255, 340 deg |
| Tau per Ls | Median per-sol `tau` of the training sols within +-15 deg of each Ls. Placeholder-tau sols are excluded, and the sealed test is not read. Tau is one value for the whole map at each Ls, and is never extrapolated. |
| Baseline parameters | All-blocks fit from `outputs/baseline/fit_params.csv`: `g_diff` 0.8193, `f_ir` 0.0312, `ti_scale` 0.7396. |

Tau values, computed Oct 28 from `gale_rems_training.csv`:

| Ls (deg) | Sols in window | Blocks | Median tau | IQR | Range |
|---|---|---|---|---|---|
| 15 | 21 | 1, 5 | 0.78 | 0.73-0.79 | 0.68-0.89 |
| 75 | 17 | 3, 5 | 0.49 | 0.46-0.51 | 0.42-0.53 |
| 195 | 37 | 0, 2 | 0.69 | 0.67-0.71 | 0.63-1.16 |
| 255 | 14 | 0, 2 | 1.09 | 1.04-1.24 | 1.01-1.35 |
| 340 | 22 | 5, 7, 9 | 1.11 | 1.03-1.16 | 0.95-1.51 |

Ls 255 has the fewest sols (14). Recompute these values in the Step 6 notebook rather than hard-coding them, and assert that they match this table.

### Design

1. **Grid.** Block-average the 100 m static table (`gale_dust_devil_features_100m.csv`, 1436 x 1477) 2 x 2 to about 200 m (718 x 738). Average aspect as a circular mean of sin and cos, never as raw degrees. 1477 is odd, so drop the last column, and state it in the metadata. Latitude per row comes from the transform in `gale_dust_devil_meta.json`, with the pixel size doubled for the 200 m grid. Read the CSV by columns, in chunks if needed.
2. **Inputs per pixel.** Slope, aspect, THEMIS TI and `albedo_mean` from the table. Albedo still drives the physics; it is only absent from the residual model.
3. **Baseline: the 5 Ls values in parallel, one process each** (user decision, Oct 28).
   - **Code.** A new module, `map_export.py`, holds `run_ls(ls, ...)`. A driver notebook, `notebooks/map_run.ipynb`, starts 5 workers with `concurrent.futures.ProcessPoolExecutor(max_workers=5)`. The worker function must live in a module, not the notebook, because Windows starts workers with spawn.
   - **Workers.** Each worker sets `OMP_NUM_THREADS`, `MKL_NUM_THREADS` and `OPENBLAS_NUM_THREADS` to 1 before importing numpy, so 5 workers do not fight over the 6 cores. Each runs `thermal1d.simulate_sols` over chunks of pixels and writes its float32 master to `outputs/map/master/ls{LLL}.npy`. The encoding into A-D happens after all 5 finish.
   - **Chunks and memory.** Use 10,000 columns per chunk. The flux input and the surface output are each about 77 MB per 10,000 columns as float64, so one worker needs about 250-300 MB, or about 1.5 GB for five. This laptop has 11.4 GB of RAM, but only 2.2 GB was free on Oct 28, so close other programs first. Measure the peak in the dry run, and halve the chunk size if needed.
   - **Checkpoints.** Each worker saves every finished chunk (`outputs/map/master/ls{LLL}_chunk{NNN}.npy`) and skips chunks that already exist on restart. A crash, a reboot or sleep then costs at most one chunk. Merge the chunks after the last one.
   - **Progress.** Each worker appends its chunk number, elapsed time and spin-up sols to `outputs/map/map_progress_ls{LLL}.log`. nbconvert shows nothing until the end.
   - **Runtime.** Serial, it would take about 2.2 h per Ls (0.015 s per column, measured on a 294-column batch), or about 11 h. In parallel, the ideal is about 2.2 h of wall time. This machine is a Ryzen 5 7530U laptop (6 cores, 12 threads), and laptop chips slow down under long full load, so expect about 3-4 h. The dry run gives the real per-column time; re-estimate from it.
   - **Before the full run.** Plug the laptop in, turn off sleep and hibernation, and keep it ventilated.
   - **Cloud option** (assessed Oct 28, not chosen). A Claude Code cloud session works from the GitHub repo (`Ayawningp/MarsDataPipeline`) on a Linux machine. It would need:
     - pushing the local commits (`main` was 6 commits ahead of `origin` on Oct 28);
     - putting the inputs where the session can read them. `processed_data/` is git-ignored, and the 198 MB feature table is over GitHub's 100 MB file limit (72 MB gzipped), so it needs Git LFS or a compressed copy;
     - a fresh Python setup there (`gale-env` is Windows-only), with versions matched to `gale-env`;
     - getting about 1 GB of outputs back, which is too large for plain git.

     The session's run-time limit and core count were not checked. Local parallel is the plan; use the cloud only if the laptop cannot stay on for about 4 h.
4. **Residual.** Apply `flann_safe_no_ti` with clamping. Report the fraction of pixels clamped per covariate.
5. **Time steps.** Output every 30 min of LTST (48 frames per Ls), at the step ending at each frame time. Say whether frames are instants or bin centres in the metadata.
6. **Check (pass condition from the build steps):**
   - The rover pixel of a Step 4 sol at the same Ls and tau reproduces the Step 4 model within 0.05 K.
   - The output loads in the map with the right orientation (row 0 at the north edge).
7. **Optional second map, as a sensitivity:** `flann_safe` (with TI terms). The baseline is shared, so it costs only the residual pass.

### Output format options

The numbers that drive the choice:

- 718 x 738 = 529,884 pixels per frame.
- 5 Ls x 48 frames = 240 frames.
- One frame is 2.1 MB as float32, 1.06 MB as 16-bit and 0.53 MB as 8-bit.
- So the whole set is about 254 MB at 16-bit and 127 MB at 8-bit, before compression.
- The model error is about 5 K, so 0.1 K steps lose nothing that matters.

| Format | What it is | Pros | Cons |
|---|---|---|---|
| **A. Cloud-optimized GeoTIFF (COG)**, one file per Ls with 48 bands | Standard georeferenced raster; int16 at 0.01 K or float32, with a nodata value | Opens in QGIS for checking. Carries georeferencing. Web maps can read it with geotiff.js, georaster-layer-for-leaflet or the OpenLayers GeoTIFF source. | Needs `rasterio` (installed 1.5.2, but not on the allowed list: needs user approval). Decoding in the browser is heavier. The Mars coordinate reference system (IAU 2015:49900) is not an EPSG code, so web maps treat it as plain degrees. |
| **B. 16-bit PNG per frame** (grayscale, value = (T - 100 K) x 100) plus a JSON manifest | Lossless image with values encoded in the pixel | Every browser decodes PNG natively. The client applies the colour scale, so hover readouts and legend changes stay possible. Small after compression. | No georeferencing in the file (the manifest carries bounds). Needs Pillow (installed 13.0.0, not on the allowed list: needs approval). Value decoding is custom code in the web app. |
| **C. Coloured PNG per frame** plus a legend | A ready-to-show picture (for example an image overlay in Leaflet with lat/lon bounds) | The simplest to display; no decoding. | Values are lost, so there is no hover temperature. The colour scale is fixed at export. Needs Pillow (approval). |
| **D. Raw binary plus a JSON manifest** (uint16 at 0.01 K, little-endian, one file per Ls) | Bytes the browser reads straight into a typed array | numpy only (already allowed). Fastest to load in JavaScript. Exact values. | A custom format: no GIS tool opens it, and the web app needs a small loader. |
| **E. float16 NumPy stack (`.npy`/`.npz`) plus `meta.json`** | The handover brief's original proposal | numpy only. Matches `gale_dust_devil_meta.json`. The quickest to write. | Browsers do not read `.npy` without a parser, and float16 needs decoding in JavaScript. Best as an internal or archive format. |
| **F. XYZ map tiles** (z/x/y PNG) | Pyramid tiles for slippy maps | Standard for basemaps with deep zoom. | Overkill for a 718 x 738 grid, which fits in a few tiles. Web Mercator tiling on Mars adds projection questions. |
| **G. NetCDF or Zarr** | Self-describing science arrays | Good for sharing with scientists. | Needs xarray or netCDF4, which are not installed and not part of this phase. Not for the web map. |

**User decision (Oct 28): write all four of A, B, C and D.** `rasterio` and Pillow are allowed for Step 6 (see `CLAUDE.md`). E, F and G are not written.

### Export specification (A-D)

Shared by all four formats:

- **Folder.** Everything goes in `outputs/map/`, which is git-ignored. Add `MAP_OUT_DIR` to `paths.py`.
- **Grid.** 718 rows x 738 columns at about 200 m, with row 0 at the north edge.
  - The transform is the one in `gale_dust_devil_meta.json` with the pixel size doubled, starting at the same north-west corner.
  - The coordinate reference system is Mars 2000 geographic, a sphere of radius 3,396,190 m (IAU 2015:49900), written as WKT. Web maps treat the coordinates as plain degrees.
- **Frames.** For each Ls in `LS{015,075,195,255,340}`, there are 48 LTST instants, 00:00, 00:30, ..., 23:30. Each frame is the temperature at the solver step ending at that time.
- **Master array.** Keep float32 in memory. Every format below is encoded from the same array.
- **Manifest.** `outputs/map/map_manifest.json` holds:
  - the grid shape, transform and CRS WKT, and the list of LTST and Ls values;
  - the tau per Ls;
  - each format's encoding;
  - the model: baseline parameters, residual variant `flann_safe_no_ti`, its clamp ranges and the fraction of pixels clamped per covariate;
  - the git commit and the creation date;
  - caveat text: spatial skill not measured, 82% of pixels below the rover's TI range, the slope clamp in the residual.

| | File naming | Encoding |
|---|---|---|
| **A. COG** | `cog/gale_tsurf_ls{LLL}.tif`, one per Ls, 48 bands | int16. T = 200 K + 0.01 K x value, with nodata -32768. The scale and offset are set in the GeoTIFF tags so GIS shows kelvin. Band descriptions read `LTST hh:mm`. DEFLATE compression with predictor 2. Use the GDAL `COG` driver, and assert it exists before writing. |
| **B. 16-bit PNG** | `png16/ls{LLL}/ltst_{hhmm}.png` | 16-bit grayscale (Pillow mode `I;16`). T = 100 K + 0.01 K x value, with 0 as nodata. Covers 100.01-755 K. |
| **C. Coloured PNG** | `png_color/ls{LLL}/ltst_{hhmm}.png` and `png_color/legend.png` | RGBA 8-bit. Nodata is transparent. One fixed scale for every frame, so frames compare across Ls and time. The matplotlib `inferno` colour map is perceptually uniform. The range is 150-300 K; confirm it in the dry run, record the clipped fraction, and change it only before the full run. |
| **D. Raw binary** | `raw/gale_tsurf_ls{LLL}.u16`, one per Ls | uint16, little-endian, C order, shape (48, 718, 738), so it is frame, then row, then column. Same encoding as B. |

The sizes before compression come to about 1 GB in all:

| Format | Size |
|---|---|
| A | about 254 MB |
| B | about 254 MB |
| C | about 509 MB as RGBA |
| D | 254 MB |

DEFLATE and PNG compression shrink A, B and C a lot. Measure the real size in the dry run.

### Checks (in addition to the design checks)

- **Lossless formats.** Decode each A, B and D file back to kelvin. Every pixel must match the float32 master within 0.005 K, with the same nodata pattern.
- **Coloured PNGs.** Each C frame maps back to the master within one colour-map step.
- **Orientation.** The rover pixel (row 304, col 372 on the 100 m grid; row 152, col 186 on the 200 m grid) sits at the rover's lat/lon in A, read with rasterio, and in B and D, through the manifest transform.
- **QGIS.** Open one A file in QGIS on the user's machine and confirm it lands on Gale. This is a manual step for the user.

- **Frame spacing: every 30 min** (user decision, Oct 28), so 48 frames per Ls and 240 in all.

No open questions remain before Step 6. Start with the dry run on a small window around the rover.

## Later items

1. **Literature check** of REMS-derived TI along the traverse (Hamilton et al. 2014, Vasavada et al. 2017; cited from memory, not checked) against the implied 330-400 tiu.
2. **Air temperature** (separate model). Ask the user before starting.
3. **Sealed test** (blocks 4 and 8): only when the user says so. It is a time test within 1 km of training positions, not a spatial test.
4. **Proposals only (out of scope):**
   - a two-layer soil, for block 0's remaining shape error;
   - a TI mapping that shrinks THEMIS variation instead of scaling it, since every block implies 330-400 tiu;
   - a one-off Mars Climate Database comparison at the Gale cell.

### Watch for

- **Spatial skill cannot be measured here.** All rover positions lie within about 10 x 5 km. Say so beside the map.
- **Most of the map is outside the rover's TI range.** 82% of pixels are below 361 tiu, where the baseline runs at `ti_scale` x THEMIS (a 281 tiu pixel runs at 208 tiu). Nothing in the rover data tests TI below about 330 tiu.
- **Slope is clamped to 1.25-12.27 deg in the residual only.** The physics still sees the true slope, so steep crater walls and Mount Sharp's flanks rest on the baseline alone.
- **Count every configuration tried:** 9 so far (4 tree configurations and 5 FLANN variants; number 9 is a sensitivity run). Step 6 adds none.
