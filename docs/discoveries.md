# Discoveries: What We Learned and Why

Each entry gives the evidence. Data and split findings from before Oct 27 are in the handover brief, section 4.

## Numerics (Oct 27)

- **The spec grid (first layer delta/30, stretch 1.15) is too coarse below about 1 skin depth.** It gives 28 layers. The half-space amplitude at 2 delta was off by -1.18%, and almost all of that is spatial: halving every layer cut it to -0.54%, while a 4x smaller dt only reached -0.94%. **Fix (approved): stretch 1.10**, 37 layers, -0.77%.
- **Spin-up time is fixed in skin-depth units, about 60 sols for a 10-delta column at any thermal inertia.** The slowest mode decays over roughly 13 sols, and the deep layers start 1-4 K off the periodic mean. **Fix (approved):** after each unconverged sol, shift the column so its deepest node equals the sol-mean surface temperature. It is exact in the periodic state (the sol-mean temperature is the same at every depth when the bottom flux is zero), takes 11-13 sols, and lands closer to the converged state (0.013 K vs 0.03 K without it). Shifting after every sol beat shifting only during the first 3-10 sols.
- **Warm-starting spin-up from the previous parameters does not save time** (12-13 sols either way; 4.4 s per evaluation of all 294 sols). The remaining transient sits in the top few skin depths. It is kept because `CLAUDE.md` asks for it.
- **A surface node with half-cell heat storage** (finite-volume, node at z = 0) gives second-order accuracy and exact energy conservation under backward Euler. The sol-mean net surface flux is within 0.0002 W m^-2 in the periodic state.

## Forcing (Oct 27)

- **Gate 2 is a consistency check, not independent validation.** The table's flux and sun-elevation columns come from `insolation()` in `build_rems_training_table.ipynb`, which uses the same orbit constants and formulas. Diffuse light and sky infrared have no table columns and meet data only in the diagnostic.
- **Compare at the bin centre, but check Gate 2 at the table's rounded `ltst_bin_center_hr`.** A 0.005 h shift moves direct flux by several percent near sunrise and sunset at high tau.

## Physics vs REMS (Oct 27-28)

- **At default parameters the model is about 18 K cold at midday in every block, season and tau bin.** The deficit is -16.7 K at tau <= 0.4 and -14.1 K at tau 1.3-2, so it is not too much dust extinction.
- **Thermal inertia looks too high, most of all at block 0 (sols 1-170, Bradbury).** Pre-dawn bias is +1.7 to +3.7 K below 500 tiu and +13.6 K at 550-700 tiu (almost all block 0). REMS warms faster than the model from 07 to 09 h. The fit confirms it: `ti_scale` goes to 0.70-0.74 whenever block 0 is in training and 0.87 when it is held out.
- **One diffuse fraction cannot fit both seasons.** The fit settles at `g_diff` about 0.8. The fitted model is then -4 to -7 K at Ls 30-120 (clear) and +2 to +5 K at Ls 150-270 (dusty), because the diffuse term grows with tau and the midday deficit does not.
- **Fitting halves the error but does not beat the benchmark** (macro 12.77 K at defaults, 6.72 K fitted, benchmark 5.38 K). The benchmark is a lookup of REMS by LTST and Ls at the rover; it carries no spatial information, so it cannot replace the baseline on the map.
- **The placeholder tau (0.5) is not a major error source.** Those sols score like the main group in both the diagnostic and LOBO.
- **Sols 3763-3778 are the only group that is cold at night** (-4 to -6 K), consistent with their suspect 23.9 deg DEM slope cutting the sky view.

## Tooling (Oct 27-28)

- **pandas 3 returns read-only arrays from `.to_numpy()`.** Copy before writing into them. This crashed the first LOBO run after 25 minutes.
- **nbconvert shows no output until a notebook finishes.** Long notebooks should append progress to a log file, as `baseline_fit_lobo.ipynb` does.
- **Dry-run a long notebook with the expensive call stubbed** (for example, the fit returning defaults) before the real run. That caught nothing new here, but it costs 10 s against a 30-minute failure.
