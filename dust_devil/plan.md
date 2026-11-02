# Dust devil layer: multi-sol plan, progress and closed ideas

Handover for the next session (last updated Nov 2, 2026). Read `CLAUDE.md` and `README.md` in this folder first;
this file says where the work stands and what to do next. Where this file and `CLAUDE.md` disagree, this file
records a later user decision (see "Decisions changed since CLAUDE.md").

---

## 1. Where things stand (one paragraph)

The multi-sol task in `CLAUDE.md` is done (Nov 2). `dust_devil_pipeline.ipynb` is the multi-sol version, run top to bottom
in one kernel on the real data (two runs: sols 799-804 and the climatology sols 21, 22, 23, 26, 1770, 1775, 1860), with its
outputs stored in the notebook. README rewritten. Suite `57 passed in 76.65s`. The main run is bit-identical to the Oct 30
sanity run. **Open problem:** clearer sols saturate against the dusty sol-800 reference (56-85% of pixels reach the cap on
the climatology sols, 27-35% above the threshold), so their maps show little contrast. Nothing further is scheduled.

---

## 2. Next steps

Nothing is scheduled. Ask the user before starting any of these:

1. **Saturation on clear sols** (the main weakness, see section 5). Options, none decided: a clearer reference sol
   (would change every map and the threshold; Gate 1's sol-800 framing would need rework), `SCORE_CAP = None` (breaks the
   0-1 contract for the web map), or accept it and say so on the map. Any choice is a user decision; it changes
   `CLAUDE.md` decision 2 or the cap.
2. **Sol 21** has the lowest rover correlation (0.80, exactly 40 bins). Worth a look at its rover table before using it.
3. **Tiling** the new GeoTIFFs into the web map is not part of this folder's task.

Commands (from the project root):

```bash
gale-env/Scripts/python.exe -m pytest dust_devil/tests -q      # full suite, about 75 s
gale-env/Scripts/python.exe -m nbconvert --to notebook --execute dust_devil/dust_devil_pipeline.ipynb   --output-dir executed --ExecutePreprocessor.timeout=3600 --ExecutePreprocessor.kernel_name=gale-env   # about 4.5 min
```

The notebook in `dust_devil/` is the executed copy (outputs included); to refresh it, run the command above and copy
`executed/dust_devil_pipeline.ipynb` over it. The notebook's stage 2-4 cells are copied verbatim from `dev/multisol.py`
(the Nov 2 build checked the copied code by AST); change both together.

---

## 3. Decisions changed since CLAUDE.md (user decisions, Oct 30 and Nov 2)

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

---

## 4. Progress log

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

## 5. Discoveries (evidence)

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

## 6. Closed ideas (do not retry without new evidence)

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

## 7. File map

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

## 8. Known weaknesses to keep in view

- The rover kelvin scale is max/max: one REMS spike moves it (documented by `test_single_spike_moves_scale`). It only
  affects the rover table and the printed check, never the maps.
- Sol 800 is dusty (tau about 1.5): clearer sols saturate at the cap. `frac_at_cap` is reported per sol.
- Tau is one value per sol, applied to broadband sunlight; climatology tau comes from a different Mars year.
- Out of scope (CLAUDE.md): forecasting sols without REMS, detection from 1 Hz pressure, tau within a sol, a frequency map.
