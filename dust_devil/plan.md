# Dust devil layer: multi-sol plan, progress and closed ideas

Handover for the next session (last updated Nov 2, 2026). Read `CLAUDE.md` and `README.md` in this folder first;
this file says where the work stands and what to do next. Where this file and `CLAUDE.md` disagree, this file
records a later user decision (see "Decisions changed since CLAUDE.md").

---

## 1. Where things stand (one paragraph)

Done (Nov 2): reference sol 1850, and the overlays and GIFs now shade **three fixed levels** (low / moderate / high, cut at
the top 50 / 30 / 10% of sol 1850's map: 0.348 / 0.474 / 0.590). The dusty sols 799-804 show their pattern in low (27%)
and moderate (7-10%) instead of a nearly blank map. Notebook run top to bottom (three runs), README updated (new
"What the score means" section). Suite `69 passed` (Gate 12 added). Nothing further is scheduled; see "Later" in section 3.

---

## 2. What the score means (agreed with the user, Nov 2)

**One sentence:** a score of 0.59 means that, averaged over 9:00-16:00 local solar time, this pixel's surface heating is
59% of the near-maximum heating on the reference sol (1850). It is a relative measure of how hard the Sun drives the
ground, not a probability and not a count of dust devils.

**Why heating:** dust devils form when the ground is much hotter than the air above it. The score estimates that
ground-air gap from three things: sunlight reaching the surface (time of day, season, slope orientation, dust),
the share absorbed (`1 - albedo`; dark ground absorbs more), and how fast the surface heats (`1 / sqrt(TI)`; loose sand
heats fast, bedrock slowly).

**Recipe:** per quarter-hour, `proxy = (1 - albedo) * sunlight / sqrt(TI)`; divide by `REF_PROXY` (16.47: only 0.5% of
sol 1850's pixel x quarter-hour values are higher), cap at 1, multiply by the slope weight `exp(-(slope / 10 deg)^2)`
(1.0 flat, 0.78 at 5 deg, 0.37 at 10 deg); average the 28 quarter-hours from 9:00 to 16:00.

**Worked example** (pixel row 834, col 905, crater floor: slope 1 deg, albedo 0.14, TI 363):

| | sol 1850 (tau 0.44) | sol 800 (tau 1.50) |
|---|---|---|
| sunlight at 11:52 (peak) | 277 W/m2, per-bin score 0.76 | 229 W/m2, 0.62 |
| 9:00-16:00 average sunlight | 219 W/m2 | 174 W/m2 |
| map value (x slope weight 0.99) | **0.591** (high) | **0.469** (moderate) |

**Rough kelvin reading:** with sol 1850's rover calibration (2.7 K per proxy unit) a score of 1.0 is about a 45 K
ground-air gap, so 0.59 is about 26 K averaged over the day. Loose: the calibration is fitted at one rover pixel and is
max/max (one REMS spike moves it), which is why it stays out of the maps.

**Not:** a probability, a dust devil density, or calibrated against observed dust devils. All weights are assumptions.
Because tau is one value per sol for the whole crater, dust only scales the map up or down; it cannot move where
activity is likely (sol 800's map correlates 0.996 with sol 1850's).

---

## 3. Next steps

### Done: three-level overlay (user go-ahead Nov 2; design kept for reference)

**Problem.** One binary threshold (0.590, top 10% of sol 1850) sits just above sol 800's 99th percentile (0.548), so the
dusty overlays show 0.3%. The pattern is there (correlation 0.996 with sol 1850), only below the cutoff.

**Design.**
- Three fixed levels, cut at the top 50 / 30 / 10% of the reference sol's daily-mean map: on sol 1850 the cuts are
  0.348, 0.474, 0.590. Same cut values for every sol.
- Levels: none (< 0.348, no shading), low (0.348-0.474), moderate (0.474-0.590), high (>= 0.590). A pixel is in a level
  if its score is >= that level's cut (same rule as the current threshold). NaN pixels are unshaded.
- Expected shares (from the saved maps): sol 1850 50/20/20/10 %, sol 800 64.9/27.4/7.4/0.3 %, sol 21 47.3/16.9/19.8/16.1 %.
- Config: `CLASS_TOP_PCTS = (50, 30, 10)`, strictly decreasing, and its last value must equal `LIKELY_TOP_PCT`, so the
  high cut is the existing threshold, bit for bit.
- Reference cache gains `class_top_pcts` and `class_cuts` (ascending); `class_top_pcts` joins the settings checked at load.
- npz gains `class_cuts`. Summary CSV gains `frac_low`, `frac_moderate`, `frac_high` (shares of valid pixels in each
  band; `frac_high` equals `frac_above_threshold`, kept for continuity).
- Overlays and GIF: one colour per level, light to dark, `LEVEL_COLOURS = ("#FACC15", "#F97316", "#DC2626")` (yellow,
  orange, red) at the existing `ALPHA`. Replaces `HIGHLIGHT`. Legend names score bands, not shares of the shown sol:
  "Low 0.348-0.474", "Moderate 0.474-0.590", "High >= 0.590 (top 10% of sol 1850)", plus this sol's share per level.
  Keep "heuristic, not a probability".
- GeoTIFF unchanged (it already holds the continuous score).

**Tests first** (`tests/test_dd_12_levels.py`): cuts equal the reference sol's percentiles and the high cut equals the
threshold exactly; bad `CLASS_TOP_PCTS` fails; a cache with other `CLASS_TOP_PCTS` fails to load; level assignment at the
boundaries and for NaN; summary shares sum to 1 with `frac_high == frac_above_threshold`; the overlay panel blends each
level's colour exactly. Needed test-helper changes: `CLASS_TOP_PCTS` in `dd_synth.base_cfg`, the new keys in Gate 7's
`REF`, the new columns in Gate 8's `SUMMARY_COLS`.

**Done means:** suite passes, notebook rerun (three runs), dusty overlays show the pattern, README legend section updated.

### Later (ask the user first)

1. **Remaining saturation.** About 100 of 263 sols would still have > 20% of pixels at the cap against sol 1850
   (subsampled estimate). A design change (a reference pooled over all sols, or one per season) would change
   `CLAUDE.md` decision 2 again. User decision.
2. **Sols 2875 and 2878** have 110 and 124 REMS bins (max 96): probably duplicated rows. Check the REMS table
   (`../data_prep/`) before using them.
3. **Sols 21 and 1830** have the lowest rover correlations (0.80, 0.84).
4. **Tiling** the GeoTIFFs into the web map is not part of this folder's task.

Commands (from the project root):

```bash
gale-env/Scripts/python.exe -m pytest dust_devil/tests -q      # full suite, about 80 s
gale-env/Scripts/python.exe -m nbconvert --to notebook --execute dust_devil/dust_devil_pipeline.ipynb \n  --output-dir executed --ExecutePreprocessor.timeout=3600 --ExecutePreprocessor.kernel_name=gale-env   # about 6 min
```

The notebook in `dust_devil/` is the executed copy (outputs included); to refresh it, run the command above and copy
`executed/dust_devil_pipeline.ipynb` over it. The notebook's stage 2-4 cells are copied verbatim from `dev/multisol.py`;
change both together.

---

## 4. Decisions changed since CLAUDE.md (user decisions, Oct 30 and Nov 2)

| Topic | CLAUDE.md says | Now |
|---|---|---|
| LTST bins for the maps | each sol uses its own REMS bins | **Maps and reference use a fixed grid** `MAP_LTST` = 96 quarter-hour centres (0.125..23.875). Daily mean over the 28 inside 9-16 LTST (9.125..15.875); daily max and the reference p99.5 over all 96. Each sol's REMS bins are used **only** for the rover check. |
| Sol-800 regression target | reproduce the single-sol output (`baseline_sol800/`, < 1e-5) | The fixed grid changes sol 800 by up to 0.035 (mean) / 0.015 (max) vs the baseline, by design. Gate 1 now compares with the single-sol oracle run on the fixed grid (synthetic; real 300 x 300 crop). The baseline still checks the core arithmetic when fed sol 800's REMS bins (< 1e-5) and the rover table's `gap_obs_k` and `gap_model_k_rover`. |
| `frac_at_cap` | "how many pixels hit the cap" | Fraction of valid pixels (finite TI) whose uncapped ratio proxy / ref_proxy reaches `SCORE_CAP` in at least one of the 96 bins; 0 when `SCORE_CAP = None`. |
| Rover pixel | `col = (lon - T_C)/T_A`, `row = (lat - T_F)/T_E` | Same formula with `floor`, not `int()`: `int()` maps positions up to one pixel north/west of the edge to row/col 0. No in-template pixel changes (sols 799-804 stay at (304, 372)). |
| Rover check | max/max scale, correlation | Unchanged, plus a test file for noisy and missing REMS temperatures (`tests/test_dd_9_rover_check.py`, user request). |
| Reference cache | ref_sol, tau band, slope scale, day window, cap | **Also `likely_top_pct` and `map_ltst`** (the 96 bin centres); loading a cache without them (old scheme) or with other values fails. Gate 7 extended (user OK, Nov 2). |
| Summary CSV name | `dust_devil_multisol_summary.csv` | `dust_devil_multisol_summary_<first>-<last>.csv`, like the GIF, so runs do not overwrite each other (Nov 2). |
| Sols for the notebook | example 799-804 | Two runs: `SOLS = [799..804]` and `SOLS_CLIM_CHECK = [21, 22, 23, 26, 1770, 1775, 1860]`, one GIF each (Nov 2). |
| Notebook command | `jupyter.exe nbconvert` | `gale-env/Scripts/python.exe -m nbconvert` (root `CLAUDE.md` and `README.md` updated, Nov 2). |
| Reference sol | `REF_SOL = 800` (decision 2) | **`REF_SOL = 1850`** (Nov 2): median of the reference statistic over the 263 sols with >= 40 bins; sol 800 was the 12th dimmest, so 243 sols had > 20% of pixels at the cap. Sol 800 stays in the runs as the dusty-season example. Tests keep sol 800 (they check arithmetic, and `baseline_sol800/` is sol 800); Gate 11 checks another reference sol. |
| Runs in the notebook | `SOLS` | `SOLS_CLEAR = [1830, 1840, 1845, 1850, 1860, 1865]`, `SOLS_DUSTY = [799..804]`, `SOLS_CLIM_CHECK` (Nov 2). |

---

## 5. Progress log

### Nov 2, 2026 (third part): three-level overlay

- "What the score means" written into this plan (section 2) and the README first, as the user asked.
- Tests first: `tests/test_dd_12_levels.py` (10 tests) plus helper changes (`CLASS_TOP_PCTS` and `LEVEL_COLOURS` in
  `dd_synth`, new keys in Gate 7's `REF`, new columns in Gate 8). 12 failed + 7 errors before the change; then
  `score_levels`, `level_shares`, `class_cuts` in the reference, per-level panel blending and legends. Suite `69 passed`.
- The cached sol-1850 reference (no `class_top_pcts`) was refused at load, as designed; deleted and rebuilt (it is derived).
- Notebook: cuts equal sol 1850's p50 / p70 / p90 exactly; sol 1850 shares 20.0 / 20.0 / 10.0%.

| Run | low | moderate | high |
|---|---|---|---|
| clear 1830-1865 | 20.0-22.2 % | 19.3-20.0 % | 6.4-10.0 % |
| dusty 799-804 | 27.2-27.4 % | 6.7-9.7 % | 0.2-0.4 % |
| climatology | 16.4-22.5 % | 19.2-19.8 % | 5.9-17.3 % |

- Run time: 23 min 45 s with about 1.1 GB free RAM (paging), 5 min 50 s on a rerun with 2.65 GB free; outputs of the two
  runs identical apart from "built" vs "loaded" reference. Overlay code itself: about 8 s per sol.
- GIF frames use a 256-colour palette: swatch colours shift slightly and the cyan rover ring can drop out. PNG overlays exact.

### Nov 2, 2026 (second part): reference sol 1850

Candidate search (scratch script, subsampled grid every 6th row/col; sol 800 p995 12.798 vs 12.785 full grid):

| Ref | Ls | tau | rover corr | median % at cap (263 sols) | sols > 20% at cap | median % above thr | sols < 1% above |
|---|---|---|---|---|---|---|---|
| 800 | 228 | 1.50 | 0.97 | 76 % | 243 | 32 % | 0 |
| 90 (sunniest) | 202 | 0.62 | 0.93 | 0.002 % | 0 | 0.04 % | most |
| **1850** | 76 | 0.44 | 0.97 | 9 % | 100 | 12 % | 21 |
| 2905 | 292 | 0.92 | 0.96 | 4 % | 81 | 7 % | 32 |

- Excluded: sol 3095 (sealed test block 8), sol 2878 (124 bins), sols 82-90 (tau from one measurement 3-5 sols away),
  sol 640 (rover corr 0.67).
- Gate 11 (`tests/test_dd_11_reference_sol.py`) written; it passed at once (the code never hard-coded sol 800). Suite
  `59 passed`.
- Notebook run (5 min 39 s): reference `ref_proxy_p995 16.4738`, `threshold 0.5903`; threshold equals p90 of sol 1850's
  map exactly; sol 1850 10.00 % above.

| Run | above threshold | at cap | tau |
|---|---|---|---|
| clear 1830-1865 | 6.4-10.0 % | 3.2-6.3 % | 0.44-0.51 |
| dusty 799-804 | 0.2-0.4 % | 0.0-0.1 % | 1.44-1.52 |
| climatology | 5.9-17.3 % | 2.3-19.7 % | 0.48-0.80 |

Rover: sols 1830-1865 corr 0.84 (1830) to 0.97, DEM - REMS +6 to +20 m.

### Nov 2, 2026

- Answered the four open questions (user: "go with your suggestions").
- Suite rerun `53 passed in 77.81s`; committed `5a03c54` (dev implementation + tests).
- Gate 7 extended first (4 new cases failed), then `_settings` records `likely_top_pct` and `map_ltst`. Summary CSV named
  by range (Gate 8 changed first, failed, then fixed). Suite `57 passed`; committed `56ff998` with the command change.
- Notebook rebuilt by a script that copies the `dev/multisol.py` functions verbatim (AST check: the geometry cell's
  functions equal multisol's, docstrings aside). Run with `python.exe -m nbconvert`: 4 min 28 s, no errors; zmq now
  loads from `gale-env`. Free RAM at the start was 1.1 GB.
- Checks in the notebook: reference equal to the sanity run (`ref_proxy_p995 12.785097122192383`, `threshold
  0.5932551622390747`); maps of sols 799-804 bit-identical to `dust_devil_sanity/`; sol 800 vs `baseline_sol800/` max abs
  diff 0.0347 (mean) / 0.0147 (max), NaN pattern identical (the expected fixed-grid change).
- "±" renders in the overlay title and GIF frame (PIL default font); checked visually on sol 21.

Climatology run (first end-to-end use of the fallback):

| Sol | Ls | tau (climatology, n) | bins | above threshold | at cap | rover (row, col) | corr | scale (K) | DEM - REMS (m) |
|---|---|---|---|---|---|---|---|---|---|
| 21 | 162.0 | 0.793 (69) | 40 | 34.5 % | 83.6 % | (261, 410) | **0.80** | 3.013 | +3.3 |
| 22 | 162.5 | 0.797 (68) | 41 | 34.5 % | 83.7 % | (261, 410) | 0.90 | 3.194 | +4.2 |
| 23 | 163.1 | 0.800 (65) | 41 | 34.5 % | 83.8 % | (261, 410) | 0.94 | 3.160 | +4.2 |
| 26 | 164.7 | 0.797 (66) | 43 | 35.2 % | 85.4 % | (261, 411) | 0.97 | 2.762 | -1.5 |
| 1770 | 40.2 | 0.634 (80) | 51 | 27.5 % | 59.0 % | (339, 367) | 0.95 | 3.346 | +27.9 |
| 1775 | 42.5 | 0.631 (77) | 54 | 26.6 % | 56.2 % | (339, 367) | 0.92 | 3.366 | +27.9 |
| 1860 | 80.9 | 0.477 (82) | 62 | 27.7 % | 56.5 % | (342, 370) | 0.94 | 2.034 | +19.8 |

Main run (799-804): identical to the Oct 30 table below.

### Oct 30, 2026


**Step 0, baseline.** `rover_sol800_table.csv` existed; the sol-800 npz and tif were missing everywhere (not in
`dust_devil.zip`, `outputs/`, `_Trash_Review/`). Recreated by re-running the unmodified notebook (commit a8de56f) via
nbconvert on `gale-env`; stages 0-1 skipped. Evidence: the regenerated rover table is identical to the Oct 27 file
(max abs diff 0.0, all 11 columns); printed values match the notebook's stored outputs (tau 1.498, scale 3.475,
corr 0.97, mean max 0.86833054, threshold 0.567). Copied to `processed_data/baseline_sol800/` (npz, tif, rover table).
Side effect: the old single-sol sol-800 npz, tif and overlays were rewritten in `processed_data/`.

**Tests written first, confirmed failing** (42 tests, all `NotImplementedError` against a stub), then implemented.

**Implementation** in `dev/multisol.py`; sanity runner `dev/run_sanity.py` (`SOLS_SANITY = [799..804]`, outputs in
`processed_data/dust_devil_sanity/`). First version used each sol's REMS bins:

| Check | Result (REMS-bin scheme) |
|---|---|
| Sol 800 vs baseline | mean 2.4e-7, max 6.0e-8 max abs diff, NaN pattern identical |
| Share above threshold, 799-804 | 17.1, 10.0, 12.2, 18.3, 20.6, 17.4 % (unrelated to tau) |
| Max day-to-day change, daily mean | 0.067 (799 -> 800) |

Diagnosis: REMS bin coverage inside 9-16 LTST differs by sol (16-21 bins); re-scoring all sols on sol 800's bins gave
shares 9.1-12.5 % ordered by tau and max day-to-day change 0.012. User approved the fixed LTST grid.

**Fixed LTST grid** (tests first: rewritten Gate 1, new `tests/test_dd_10_fixed_ltst.py`; 7 failed before the change):

| Sol | tau | REMS bins | above threshold | at cap | rover corr | scale (K) | DEM - REMS (m) |
|---|---|---|---|---|---|---|---|
| 799 | 1.517 | 58 | 9.1 % | 6.3 % | 0.98 | 3.702 | +24.2 |
| 800 | 1.498 | 60 | 10.0 % | 7.4 % | 0.97 | 3.475 | +24.2 |
| 801 | 1.478 | 58 | 10.9 % | 8.6 % | 0.94 | 3.734 | +24.2 |
| 802 | 1.460 | 58 | 11.7 % | 9.9 % | 0.97 | 3.560 | +24.2 |
| 803 | 1.442 | 60 | 12.5 % | 11.3 % | 0.95 | 3.731 | +23.7 |
| 804 | 1.468 | 56 | 11.2 % | 9.0 % | 0.97 | 3.577 | +23.7 |

- All tau from Mastcam 880 nm. Rover at (304, 372) on every sol.
- Reference (fixed grid): `ref_proxy_p995 = 12.7851`, `threshold = 0.59326` (old scheme: 12.9769, 0.5671).
- Max day-to-day change, daily mean: 0.0079, 0.0080, 0.0074, 0.0075, 0.0121 (803 -> 804); daily max up to 0.0157.
  Signs follow the change in tau.
- Sol 800 fixed grid vs baseline: mean up to 0.035, max up to 0.015 (expected change); rover `gap_model_k_rover` identical.

**Final suite:** `53 passed in 50.84s` (includes 3 `realdata` tests, about 45 s).

---

## 6. Discoveries (evidence)

- **Clear sols saturate against the sol-800 reference** (Nov 2). Climatology sols (tau 0.48-0.80, other seasons) reach
  the cap on 56-85% of pixels and clear the threshold on 27-35%, against 6-11% and 9-12.5% for sols 799-804 (tau about
  1.5). Sols 21-26 (Ls 162-165: about mean Sun distance, declination about +3 deg, so the noon Sun is nearly overhead at
  Gale, 4.6 S) saturate more than 1770-1860 (Ls 40-81: near aphelion, declination +14 to +25 deg) despite higher tau,
  consistent with stronger sunlight. The maps for such sols show little spatial contrast.
- **Climatology path works end to end on real data** (Nov 2): labels in npz, summary CSV, overlay title and GIF frame.
- **REMS coverage, not dust, drove day-to-day map changes** under the per-sol-bin scheme (see progress table). The maps
  are pure model and do not need REMS times.
- **Gate 2 monotonicity holds in practice.** The diffuse term grows with tau, so in principle more dust can raise the
  score where the direct beam is weak. Probe (tau 0.5 vs 1.5, daily mean, shared reference): 0 pixels on the synthetic
  grid (slopes 0-20 deg) and on 200 k noisy synthetic pixels (slopes 0-60 deg); on the real grid a handful of pixels on
  70-73 deg slopes, largest increase 2.5e-24 (killed by the slope weight).
- **Memory:** only about 1.7 GB free; a full-grid (96, 1436, 1477) oracle would need 3-4 GB. The reference percentile
  stores only lit bins (night bins are counted, not stored; exact, because zeros are the smallest values).
- **Climatology coverage on real data:** 7 REMS sols with >= 40 bins use it (21, 22, 23, 26, 1770, 1775, 1860), each with
  65-82 sols in the Ls +-10 window. No REMS sol fails the >= 5 rule.
- **Environment:** `gale-env/Scripts/jupyter.exe nbconvert` loaded Anaconda's `zmq` (PATH lookup of the subcommand);
  `gale-env/Scripts/python.exe` imports its own `zmq` and `nbconvert`.

---

## 7. Closed ideas (do not retry without new evidence)

| Idea | Why closed | Evidence |
|---|---|---|
| Score the maps on each sol's own REMS bins | Coverage gaps (16-21 bins in 9-16 LTST) dominated the day-to-day change | max day-to-day 0.067 vs 0.012 on a common grid; share above threshold unrelated to tau |
| Add noise / steeper slopes to the synthetic grid to strengthen Gate 2 | The grid is already random per pixel; steeper terrain changes nothing | probe: 0 pixels rise with tau up to 60 deg slopes |
| README caveat that more dust can raise the score | Effect is negligible | largest increase 2.5e-24, only on 70-73 deg slopes |
| Full-grid single-sol oracle in the real-data test | Does not fit in memory (needs 3-4 GB at 96 bins) | 1.7 GB free; replaced by a real 300 x 300 crop (exact, both sides compute their own percentile) |
| `int()` for the rover pixel | Truncation maps positions up to one pixel outside the north/west edge to row/col 0 | Gate 6 case (-0.3 pixel north) |
| `frac_at_cap` as the share of pixel x bin pairs at the cap | User chose "pixels reaching the cap in at least one bin" | decision Oct 30 |
| Per-sol 99.5th-percentile normalisation | Replaced by the shared sol-800 reference (CLAUDE.md decision 2) | spec |
| Kelvin scale in the maps | Does not cancel under a shared reference (CLAUDE.md) | Gate 3 tests it stays out |
| Placeholder `TAU = 0.5` in multi-sol runs | Forbidden (CLAUDE.md decision 4) | `tau_for_sol` has no placeholder path |

---

## 8. File map

| Path | What it is |
|---|---|
| `dev/multisol.py` | the implementation (copy into the notebook in Step B) |
| `dev/run_sanity.py` | real-data sanity run, sols 799-804, prints regression and day-to-day diffs |
| `tests/conftest.py` | sys.path setup, `realdata` marker, `grid` / `ms` fixtures |
| `tests/dd_oracle.py` | the old single-sol stage 2, verbatim arithmetic; never "improve" it |
| `tests/dd_synth.py` | synthetic 24 x 30 grid, REMS sols and full input sets |
| `tests/test_dd_1_regression.py` ... `test_dd_8_outputs.py` | the eight CLAUDE.md gates (Gate 1 rewritten for the fixed grid) |
| `tests/test_dd_9_rover_check.py` | noisy / missing REMS temperatures (user request) |
| `tests/test_dd_10_fixed_ltst.py` | fixed LTST grid |
| `../processed_data/baseline_sol800/` | old single-sol sol-800 npz, tif, rover table (do not overwrite) |
| `../processed_data/dust_devil_sanity/` | sanity-run outputs for sols 799-804 (fixed grid), incl. reference JSON and GIF |

Commands (from the project root):

```bash
gale-env/Scripts/python.exe -m pytest dust_devil/tests -q            # full suite, about 50 s
gale-env/Scripts/python.exe -m pytest dust_devil/tests -q -m "not realdata"   # synthetic only, about 5 s
gale-env/Scripts/python.exe dust_devil/dev/run_sanity.py              # real sanity run, about 60 s
```

## 9. Known weaknesses to keep in view

- The rover kelvin scale is max/max: one REMS spike moves it (documented by `test_single_spike_moves_scale`). It only
  affects the rover table and the printed check, never the maps.
- Sol 800 is dusty (tau about 1.5): clearer sols saturate at the cap. `frac_at_cap` is reported per sol.
- Tau is one value per sol, applied to broadband sunlight; climatology tau comes from a different Mars year.
- Out of scope (CLAUDE.md): forecasting sols without REMS, detection from 1 Hz pressure, tau within a sol, a frequency map.
