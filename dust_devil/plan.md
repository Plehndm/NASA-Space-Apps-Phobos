# Dust devil layer: multi-sol plan, progress and closed ideas

Handover for the next session (last updated Oct 30, 2026). Read `CLAUDE.md` and `README.md` in this folder first;
this file says where the work stands and what to do next. Where this file and `CLAUDE.md` disagree, this file
records a later user decision (see "Decisions changed since CLAUDE.md").

---

## 1. Where things stand (one paragraph)

The multi-sol model is implemented and tested in `dev/multisol.py`; the full suite passes (`53 passed in 50.84s`).
A real-data sanity run over sols 799-804 behaves physically (share above threshold follows tau; max day-to-day change
in the daily-mean score 0.012). **Not done:** the notebook (`dust_devil_pipeline.ipynb` is still the old single-sol
version), the README, a real run that exercises the tau climatology, and a commit. Nothing from this work is committed.

---

## 2. Next steps (in order)

### Step A. Ask the user the four open questions (before writing code)

1. **Cache records the LTST grid and `LIKELY_TOP_PCT`?** `load_reference` cannot tell a reference built on the old
   REMS-bin scheme from one built on the fixed grid, and does not check `LIKELY_TOP_PCT` (the threshold depends on it).
   Fixing it needs a small change to `tests/test_dd_7_reference_cache.py` (add the keys to `REF` and two mismatch cases).
   Recommend: yes. Do not change the test without the user's OK (standing rule: fix code, not tests).
2. **Notebook command.** `gale-env/Scripts/jupyter.exe nbconvert` picked up Anaconda's `jupyter-nbconvert`/`zmq` from PATH
   (warning paths were `C:\Users\aypen\anaconda3\...`), although `gale-env` itself is clean (`include-system-site-packages = false`,
   its own `zmq` and `nbconvert`). Recommend `gale-env/Scripts/python.exe -m nbconvert ...`. This changes the command in the
   root `CLAUDE.md`, so it is the user's call. Mixing conda and pip caused the past 0xC06D007F crashes.
3. **Which sols for the final notebook run** (`SOLS`). Recommend: `[799, 800, 801, 802, 803, 804]` plus the climatology
   sols `[21, 22, 23, 26]` and the Mastcam-gap sols `[1770, 1775, 1860]` (see Step D). Note the GIF then spans years; it may
   be better as two runs (two GIFs). User decides.
4. **Commit now?** Workflow says commit after each gate passes. `dev/` and `tests/` are untracked; the suite passes.
   Suggested message: "Dust devil multi-sol: tests gates 1-8 + rover check + fixed LTST grid, dev implementation".

### Step B. Update `dust_devil_pipeline.ipynb` (the deliverable)

The notebook must be self-contained: copy the working code from `dev/multisol.py` into cells; do not import from `dev/`.

- **Config cell** gains (names exactly as in `dev/run_sanity.py`): `SOLS`, `REF_SOL = 800`, `SCORE_CAP = 1.0`,
  `RUN_REFERENCE = "auto"`, `MIN_BINS = 40`, `TAU_CLIM_LS_WINDOW = 10.0`, `TAU_CLIM_EXCLUDE = (2082, 2133)`,
  `TAU_CLIM_MIN_SOLS = 5`, `REFERENCE_JSON = PROC / "dust_devil_reference_sol800.json"`, `GIF_W = 1000`, `GIF_MS = 800`.
  Remove the placeholder `TAU` from the multi-sol path (`TAU_CSV = None` must not be an option any more).
  Keep `DEMO_SOL` only for stage 1 (`meta.json`); stage 2 never reads the rover from `meta.json`.
- **Stages 0 and 1 unchanged.**
- **Replace stages 2-4** with these cells (each with a short markdown explanation):
  1. Helpers: `ls_deg`, `sun_vector`, `solar_const`, `MAP_LTST`, `load_grid`, `sols_with_min_bins` (print the list), `rover_pixel`, `tau_for_sol`.
  2. Model: `_surface`, `_proxy`, `bin_proxy`, `slope_weight`, `reference_proxy`, `score_maps`, `rover_series`, `rover_check`.
  3. Reference: `build_reference` / `save_reference` / `load_reference` with the `RUN_REFERENCE` flag; print ref proxy, threshold, tau.
  4. Per-sol loop: `run_sol`, npz, 2-band GeoTIFF, rover table, overlays; print the per-sol line (DEM vs REMS, rover corr, tau source).
  5. Summary CSV and GIF.
- Keep the wording "heuristic, not a probability" in every title and legend.
- **Run top to bottom in one kernel** on the real data. Outputs go to `../processed_data/` and overwrite the old sol-800
  npz/tif/table/overlays; that is fine because the old ones are in `../processed_data/baseline_sol800/`.
- **Acceptance check:** for sols 799-804 the notebook's npz arrays must equal `processed_data/dust_devil_sanity/*.npz`
  (same code; expect bit-identical, or report the max abs diff). Also compare the reference JSON values.
- **Memory:** only about 1.7 GB of 11.4 GB RAM was free on Oct 30. The reference buffer is about 0.4 GB (lit bins x
  2.12 M pixels, float32); per-sol scoring holds a few full-grid float32 arrays. Free large arrays between stages
  (`del`, `gc.collect()`). The sanity run took 57 s for 6 sols.

### Step C. Update `README.md`

- Stage 2 description: unitless proxy, shared sol-800 reference (`REF_PROXY` = p99.5 over 96 fixed bins x all pixels),
  fixed threshold (p90 of sol 800's daily mean), fixed LTST grid, REMS bins only for the rover check.
- Settings table: the new config names from Step B.
- Caveats:
  - Shared reference: sols clearer or sunnier than sol 800 (tau about 1.5, dusty) saturate at `SCORE_CAP`.
    `frac_at_cap` is about 6-11% even for sols 799-804; it counts pixels that reach the cap in at least one bin.
  - The kelvin scale is per sol and only for the rover check; it is max/max, so one spike in REMS moves it.
  - Climatology tau comes from other Mars years at the same Ls; it is labelled in every output.
- New outputs table (copy from `CLAUDE.md`), plus `dust_devil_reference_sol800.json`.
- Replace "The score is relative ... top 10% always shows something" (no longer true: the share now varies by sol).
- Update the "sols with >= 40 bins" note: the current REMS file has 263 such sols.

### Step D. Real-data checks to run and report

- Rerun the full suite after the notebook work: `gale-env/Scripts/python.exe -m pytest dust_devil/tests -q` (paste the summary line).
- **Climatology on real sols (never run end to end yet):** sols 21, 22, 23, 26 (before Mastcam starts at sol 33) and
  1770, 1775, 1860 (Mastcam gaps) all fall back to the climatology; `tau_for_sol` gives n = 65-82 sols in the window and
  tau 0.48-0.80. Run at least one of each group through the full path, check the label in the npz, summary CSV,
  overlay title and GIF frame.
- **Check that the "±" renders** in the overlay PNG title and GIF frame (PIL default font). In the terminal it printed
  garbled (console code page only; the CSV is UTF-8). If the font cannot draw it, write "+-" in the image text only, and
  say so.
- For every sol, report the DEM-vs-REMS elevation difference and the rover correlation; call out low correlations and
  climatology tau (CLAUDE.md "Done means").

### Step E. Done means (from CLAUDE.md, still valid)

Full suite passes (paste output); notebook updated and run top to bottom in one kernel; sol 800 checked (now: regression
gates in `tests/test_dd_1_regression.py`, see below); per-sol DEM and correlation reviewed; README updated.

---

## 3. Decisions changed since CLAUDE.md (user decisions, Oct 30)

| Topic | CLAUDE.md says | Now |
|---|---|---|
| LTST bins for the maps | each sol uses its own REMS bins | **Maps and reference use a fixed grid** `MAP_LTST` = 96 quarter-hour centres (0.125..23.875). Daily mean over the 28 inside 9-16 LTST (9.125..15.875); daily max and the reference p99.5 over all 96. Each sol's REMS bins are used **only** for the rover check. |
| Sol-800 regression target | reproduce the single-sol output (`baseline_sol800/`, < 1e-5) | The fixed grid changes sol 800 by up to 0.035 (mean) / 0.015 (max) vs the baseline, by design. Gate 1 now compares with the single-sol oracle run on the fixed grid (synthetic; real 300 x 300 crop). The baseline still checks the core arithmetic when fed sol 800's REMS bins (< 1e-5) and the rover table's `gap_obs_k` and `gap_model_k_rover`. |
| `frac_at_cap` | "how many pixels hit the cap" | Fraction of valid pixels (finite TI) whose uncapped ratio proxy / ref_proxy reaches `SCORE_CAP` in at least one of the 96 bins; 0 when `SCORE_CAP = None`. |
| Rover pixel | `col = (lon - T_C)/T_A`, `row = (lat - T_F)/T_E` | Same formula with `floor`, not `int()`: `int()` maps positions up to one pixel north/west of the edge to row/col 0. No in-template pixel changes (sols 799-804 stay at (304, 372)). |
| Rover check | max/max scale, correlation | Unchanged, plus a test file for noisy and missing REMS temperatures (`tests/test_dd_9_rover_check.py`, user request). |

---

## 4. Progress log (Oct 30, 2026)

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
