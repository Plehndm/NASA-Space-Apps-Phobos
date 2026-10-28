# Closed Ideas: What Not to Try Again

Before proposing a change, check here. Each entry says how it was closed:

- **Tested:** measured, with the numbers.
- **Reasoned:** rejected on evidence or arithmetic, not run. It says what would justify reopening it.
- **Spec:** forbidden by `CLAUDE.md`. Reopen only if the user changes the rule.

Older closed ideas are in `CLAUDE.md` (Anti-patterns) and the handover brief (section 5): random-row or whole-sol scoring, the Mars Climate Database as baseline, flipping aspect, extrapolating tau, hand-joining the training table and others. They still apply.

## Numerics

| Idea | Status | Why closed |
|---|---|---|
| Grid stretch 1.15 | Tested | Half-space amplitude off by 1.18% at 2 delta (limit 1%). Replaced by 1.10. |
| Smaller dt to pass the half-space check | Tested | 4x smaller dt only improved the error from -1.18% to -0.94%; the error is spatial. |
| Plain spin-up from radiative equilibrium | Tested | About 60 sols (limit 50). Replaced by the deep-temperature shift. |
| Shifting only during the first 3-10 sols | Tested | 12-28 sols, against 11-13 when shifting after every sol. |
| Raising the spin-up limit to about 70 sols | Reasoned | Works, but every run is about 40% longer, which matters for the roughly 530,000-pixel map. The shift is faster and more accurate. |
| Warm-starting spin-up to save time | Tested | No speedup (12-13 sols either way). Kept only because the spec asks for it; do not count on it for speed. |

## Fitting the physics baseline

Decided Oct 28: no bound changes or new parameters before Step 5.

| Idea | Status | Why closed | Reopen if |
|---|---|---|---|
| Lower `ti_scale` bound from 0.7 to 0.5 | Tested (Oct 28) | Fits stay at 0.69-0.88, scores change by at most 0.04 K, block 0 night bias unchanged (+9 K). One global scale cannot cool block 0 without cooling nights that are already 3 K cold elsewhere. | Never as a global bound change; block 0 needs a local explanation. |
| Thermal inertia fitted per rover pixel or per block | Reasoned | Cannot transfer to the map's unobserved pixels and leaks between LOBO folds. That correction belongs in the residual model. | Never for the baseline. |
| Fitting albedo | Reasoned | Closing the midday gap by albedo alone needs a drop of about 0.15-0.2, to roughly 0.05-0.10, which is implausible for Gale. It also trades off against `g_diff` at midday. | An independent albedo source shows TES is badly off at the rover. |
| `g_diff` above 1 | Reasoned | Unphysical (more diffuse light than was scattered). The midday deficit does not grow with tau, so more diffuse light also over-corrects the dusty season. | Never. |
| Forward-scattering correction to dust extinction | Reasoned | Its effect grows with tau, but the deficit does not; it would not fix clear-season sols. It also changes the direct beam that Gate 2 checked. | A tau-dependent error remains after the residual model and literature constants are available. |
| Fitting or lowering emissivity | Spec | Raises both day and night temperatures (nights already warm), and `CLAUDE.md` forbids fitting it with sky IR. Only a 0.90-1.00 sensitivity run is allowed. | User changes the rule. |
| Two-layer soil (dust over denser ground) | Spec | Out of scope in `CLAUDE.md` and adds at least 2 parameters. Physically the best match for hot days with moderated nights. | The user brings it into scope after the heatmap ships. |
| Tuning to beat the benchmark | Spec | `CLAUDE.md`: if the baseline does not beat the benchmark, that is the finding. | Never. |

## Residual model

| Idea | Status | Why closed | Reopen if |
|---|---|---|---|
| Elevation as a residual predictor | Tested | 0.07 K macro gain, under the 0.2 K bar fixed before the run; it can act as a campaign ID. | A within-block test shows a real elevation effect. |
| Model absorbed flux as a residual predictor | Tested | 0.04 K worse macro, better in 4 of 9 blocks. | Never on its own; time and tau already carry it. |
| Static covariates dropped (`time_only`) | Tested | 0.34 K worse macro than `no_elev`. | - |

## Block 0 explanations (Oct 28)

| Idea | Status | Why closed | Reopen if |
|---|---|---|---|
| Sky IR explains block 0's warm nights | Tested | Block 0's best `f_ir` (0.030) equals the global fit; fixing nights by sky IR alone leaves -8.8 K by day (RMSE 8.7 K vs 5.7 K with TI). | Never. |

## Residual model inputs (Oct 28)

| Idea | Status | Why closed | Reopen if |
|---|---|---|---|
| Albedo as a residual predictor (linear learner) | Tested | Rover albedo spans 0.24-0.26; the term moved the residual by 29 K over 0.10-0.35, and dropping it improved macro RMSE by 0.14 K. | An albedo source with real spread along the traverse. |
| Unclamped linear residual model on the map | Tested | Extrapolates linearly (TI 14 K, slope 5 K, albedo 29 K over map ranges). Clamping costs 0.02 K macro. | Never. |

## Second learners for the residual model (Oct 28, reasoned with the user)

| Idea | Status | Why closed | Reopen if |
|---|---|---|---|
| Prophet | Reasoned | Built for one time series with Earth calendar cycles and a time trend. No notion of space; the map needs a function of terrain, not date. Not installed. | Never for this map. |
| PINNs | Reasoned | The implicit solver already solves the heat equation to about 0.03 K; the error is in forcing and parameters, not the PDE. Cannot identify TI at unvisited pixels. Needs PyTorch or JAX (not installed). | A spatially resolved inverse problem with data at many pixels. |
| NeuralGCM | Reasoned | Earth atmosphere model trained on Earth reanalysis; no Mars version; cells of hundreds of km against a 10 km area. Brings in atmospheric coupling (out of scope). | Never. |
| xgboost as the second learner | Reasoned | Same tree family as the current learner, so the same failure outside the training TI range; monotone constraints already exist in HistGradientBoosting. Expected change under 0.1 K. | A tree-specific need appears (for example GPU speed for the map). |

## Tooling

| Idea | Status | Why closed |
|---|---|---|
| Writing into arrays from pandas `.to_numpy()` | Tested | Read-only under pandas 3; crashed the first LOBO run. Copy first. |
| Bash heredocs to generate large notebook files | Tested | Quoting broke on long generators. Write the generator with the Write tool instead. |
