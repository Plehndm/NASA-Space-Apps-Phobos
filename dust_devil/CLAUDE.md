# CLAUDE.md — Gale Crater dust devil layer (multi-sol)

Dust devil layer of the NASA Space Apps 2026 entry "Interplanetary Survival Guide: Martian Map".
Read `README.md` in this folder first: it documents the current single-sol pipeline (stages 0-4),
inputs, grid conventions and known pitfalls. This file covers how to work here and the current task.

## Folder layout and paths

- This folder: `dust_devil/` (inside `MarsDataPipeline/`). Main deliverable: `dust_devil_pipeline.ipynb`.
- Notebook paths are relative to this folder: inputs in `../processed_data/`, outputs in `outputs/`
  (moved from `../processed_data/` on Nov 2, user request; git-ignored), executed copies in `executed/`,
  Mastcam tau tables in `../raw_data/`, zoom-11 previews in `../gale_tiles/out_tiles/`.
- Put iteration scripts in `dev/` and tests in `tests/` (create them). Do not write into `../raw_data/`.
- Before overwriting any existing sol-800 output, copy it to `outputs/_dev/baseline_sol800/`
  (`gale_dust_devil_likelihood_sol800.npz`, `.tif`, `rover_sol800_table.csv`). The regression test needs it.

## Environment

- Windows, Python venv `gale-env` (numpy, pandas, rasterio, matplotlib, pillow, ipykernel, add pytest).
  Do not mix conda and pip (kernel crash 0xC06D007F, see README).
- The 20 m rasters are large; stage 1 output (`gale_dust_devil_features_100m.csv`) already exists, so do not rebuild it.
- Avoid `np.corrcoef` and other BLAS-heavy calls on big arrays (existing code computes correlation by hand on purpose).
- Grid is 1436 x 1477 (about 2.1 M pixels). Keep full-grid arrays float32. Never hold a (bins x H x W) array
  for more than one sol at a time; prefer per-bin loops that accumulate.

## How to work (user's standing preferences)

- Tests are gates. Write the tests first, run them, confirm they fail, then implement until they pass.
  Never say something works without running the tests; report the actual pytest output.
  After any change, rerun the FULL suite. If a test fails, fix the code, not the test, unless the test
  itself is wrong, and then say so and why.
- Iterate in `.py` scripts under `dev/`. The final deliverable is the updated `dust_devil_pipeline.ipynb`,
  self-contained: working code copied into cells (not imported from `dev/`), logical cells with markdown
  explanations. Run it top to bottom before calling it done.
- Let code fail explicitly. Use `assert` with a clear message for bad inputs; no broad try/except, no silent
  fallbacks. The one sanctioned fallback is the tau climatology below, and it must be labelled in every output.
- Be objective: lead with risks and flaws, not agreement. Flag bad assumptions.
- The score is a heuristic, not a probability. Keep that wording in titles and legends.

## Current task: multi-sol outputs with a shared reference (outputs renamed to `heating_index` on Nov 2; see `plan.md`)

**Status (Nov 2): done; read `plan.md` first.** It holds the next steps, progress and closed ideas, and records later user
decisions that override parts of this section: the maps and the reference now use a fixed LTST grid (96 quarter-hour
centres, daily mean over the 28 in 9-16 LTST), each sol's REMS bins are used only for the rover check, and Gate 1 was
rewritten accordingly.

### Decisions already made (do not re-litigate without new facts)

1. **Sols**: an observed list or range set in the config, e.g. `SOLS = [799, 800, 801, 802, 803, 804]`.
   Each sol uses its own REMS bins (`rems_binned_all_sols.csv`) and its own rover position.
   Provide a helper that lists sols with >= `MIN_BINS` (40) bins so the user can pick.
2. **Shared reference = sol 800** (`REF_SOL = 800`). **Changed to sol 1850 on Nov 2 (user decision; see `plan.md`).** Replace the per-sol 99.5th percentile with ONE reference
   value computed from sol 800, used for every sol, so dusty / low-sun sols show less activity.
3. **Fixed threshold**: the highlight cutoff is the 90th percentile of sol 800's daily-mean score
   (`LIKELY_TOP_PCT = 10` now only defines the cutoff on the reference sol). Other sols use that same
   cutoff, so their highlighted share varies.
4. **Tau**: Mastcam interpolation within `MAX_TAU_GAP_SOLS` (5) as now; if none, fall back to an Ls climatology
   (spec below). Never use the placeholder `TAU = 0.5` in multi-sol runs.
5. **Outputs**: per-sol npz + 2-band GeoTIFF + rover table + overlay PNGs (same as current stages 2-4,
   named by sol), plus ONE animated GIF on the hillshade for sanity checking.
   Also write a small run summary CSV (one row per sol); it feeds the GIF labels.

### Model changes (stage 2)

- Map from the **unitless proxy** `(1 - albedo) * flux / sqrt(clip(TI, 50))`. The rover-fitted
  proxy-to-kelvin scale no longer cancels under a shared reference, so it must NOT enter the maps.
  Keep it per sol only for the rover check (scale, model-vs-observed correlation, rover table).
- `REF_PROXY = nanpercentile(proxy over all REMS bins x all pixels of sol 800, 99.5)`, the same definition as
  the current code (which takes the percentile over the full bins x pixels array), just unitless.
  Because percentile(scale * x) = scale * percentile(x), sol 800 must reproduce the current sol-800 output.
- Per bin: `score = clip(proxy / REF_PROXY, 0, SCORE_CAP) * exp(-(slope/SLOPE_SCALE_DEG)^2)`.
  `SCORE_CAP = 1.0` by default (keeps the 0-1 contract for the web map). Known trade-off: sols clearer or
  sunnier than sol 800 saturate at the cap. Sol 800 has tau of about 1.5, which is dusty, so this will happen.
  `SCORE_CAP = None` disables the cap. Report how many pixels hit the cap per sol in the summary CSV.
- Daily mean over `DAY_LTST` (9-16 LTST) and daily max over all bins, accumulated one bin at a time.
- Cache the reference in `../processed_data/dust_devil_reference_sol800.json`: ref_sol, ref_proxy_p995,
  threshold, tau and tau_source of sol 800, tau band, slope scale, day window, score cap.
  Rebuild with the same `"auto"` / True / False flag pattern (`RUN_REFERENCE`). Assert at load time that the
  cached settings equal the current config (otherwise the maps are not comparable).
- Rover pixel per sol, from that sol's REMS lat/lon (`col = (lon - T_C)/T_A`, `row = (lat - T_F)/T_E`).
  Assert the rover is static within the sol and inside the template. Do not read the rover from `meta.json`.
  Stage 1 itself stays unchanged; `meta.json` is used only for the grid shape and transform.

### Tau climatology fallback

- Source: `mastcam_tau_per_sol.csv` (stage 0 output, has `ls_deg`).
- For a sol with no Mastcam tau within 5 sols: median tau of rows with circular |Ls - Ls(sol)| <= `TAU_CLIM_LS_WINDOW`
  (default 10 deg; must wrap around 360/0), excluding the 2018 global dust storm sols `TAU_CLIM_EXCLUDE = (2082, 2133)`.
- Assert at least `TAU_CLIM_MIN_SOLS` (5) sols in the window; otherwise fail and name the sol.
- `tau_source` must say `climatology Ls±10, n=<k> sols` and appear in the npz, the summary CSV, the overlay title and the GIF frame.
- In practice this mostly covers sols 1-32 (Mastcam starts at sol 33), using a different Mars year at the same Ls.

### Outputs (originally all in `../processed_data/`; now in `outputs/`, see Folder layout)

| File | Content |
|---|---|
| `gale_dust_devil_likelihood_sol<N>.npz` | mean, max, sol, ls, tau, tau_source, ref_sol, ref_proxy, threshold, rover row/col |
| `gale_dust_devil_likelihood_sol<N>.tif` | band 1 daily mean, band 2 daily max; template CRS/transform; band descriptions mention ref sol 800 |
| `rover_sol<N>_table.csv` | per-bin rover check as now (kelvin columns use that sol's own rover scale) |
| `likelihood_overlay_sol<N>[ _imagery| _hillshade].png` | as now, but the mask is `score >= fixed threshold`; legend says "score >= <thr> (top 10% of sol 800)" |
| `dust_devil_multisol_summary.csv` | sol, ls_deg, tau, tau_source, n_bins, frac_above_threshold, frac_at_cap, rover_corr, rover_scale_k, dem_minus_rems_m |
| `dust_devil_multisol_<first>-<last>.gif` | one frame per sol, sorted by sol, hillshade background, same threshold mask, rover ring, label with sol / Ls / tau / tau_source / % above threshold |

GIF: Pillow only (no matplotlib), `save_all=True`, about 800 ms per frame, loop forever, width about 1000 px.

### Test gates (pytest, `tests/`, synthetic small grids, fast)

Write these first and confirm they fail before implementing:

1. **Regression on the reference sol**: with `SOLS = [800]`, the multi-sol path reproduces the single-sol
   daily mean and max (synthetic grid to 1e-6; on real data, compare with `baseline_sol800/` npz, max abs diff < 1e-5).
2. **Shared reference makes sols comparable**: the same synthetic sol run with a higher tau gives a pointwise
   lower-or-equal daily-mean score and a smaller `frac_above_threshold`.
3. **Kelvin scale does not touch the maps**: changing the rover's observed temperatures changes the rover
   scale but leaves the maps unchanged.
4. **Per-bin accumulation equals full-array computation** for mean and max.
5. **Tau**: interpolation within 5 sols matches `np.interp`; climatology is used only when no measurement is
   within 5 sols; storm sols are excluded; Ls window wraps (Ls 355 includes Ls 3); fails with < 5 sols in the window.
6. **Rover**: the pixel is computed per sol from that sol's REMS position; asserts if the rover moves within the sol
   or falls outside the template.
7. **Reference cache**: loading a cached reference with a different config (tau band, slope scale, day window, cap) fails.
8. **Outputs**: one npz/tif/table/overlay per sol, with sol in the name; GeoTIFF shape/transform equal the template;
   GIF frame count equals the number of sols; summary CSV has one row per sol.

### Done means

- Full pytest suite passes (paste the output).
- `dust_devil_pipeline.ipynb` updated (config cell gains `SOLS`, `REF_SOL`, `SCORE_CAP`, `RUN_REFERENCE`,
  tau-climatology settings) and run top to bottom on the real data, in one kernel.
- Sol 800 matches the baseline. For every sol, check the printed DEM-vs-REMS elevation difference and the
  rover correlation. Call out sols with a low correlation or climatology tau.
- README updated: stage 2 description, settings table, the shared-reference caveat and the new outputs.

### Not in scope

Forecasting sols without REMS data, real dust devil detection from 1 Hz REMS pressure, tau within a sol,
an aggregate (frequency) map. Mention them if relevant, but do not build them.
