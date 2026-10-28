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
| Lower `ti_scale` bound from 0.7 to 0.5 | Reasoned | One global scale cannot separate block 0 (TI too high) from the rest (nights already near 0 to +4 K bias). It would cool nights elsewhere, and a 0.5 fit would undermine the THEMIS map for the whole crater. | The residual model leaves a large night bias that a TI change would fix, and the user wants a sensitivity run. Report it beside the headline fit, never as the headline. |
| Thermal inertia fitted per rover pixel or per block | Reasoned | Cannot transfer to the map's unobserved pixels and leaks between LOBO folds. That correction belongs in the residual model. | Never for the baseline. |
| Fitting albedo | Reasoned | Closing the midday gap by albedo alone needs a drop of about 0.15-0.2, to roughly 0.05-0.10, which is implausible for Gale. It also trades off against `g_diff` at midday. | An independent albedo source shows TES is badly off at the rover. |
| `g_diff` above 1 | Reasoned | Unphysical (more diffuse light than was scattered). The midday deficit does not grow with tau, so more diffuse light also over-corrects the dusty season. | Never. |
| Forward-scattering correction to dust extinction | Reasoned | Its effect grows with tau, but the deficit does not; it would not fix clear-season sols. It also changes the direct beam that Gate 2 checked. | A tau-dependent error remains after the residual model and literature constants are available. |
| Fitting or lowering emissivity | Spec | Raises both day and night temperatures (nights already warm), and `CLAUDE.md` forbids fitting it with sky IR. Only a 0.90-1.00 sensitivity run is allowed. | User changes the rule. |
| Two-layer soil (dust over denser ground) | Spec | Out of scope in `CLAUDE.md` and adds at least 2 parameters. Physically the best match for hot days with moderated nights. | The user brings it into scope after the heatmap ships. |
| Tuning to beat the benchmark | Spec | `CLAUDE.md`: if the baseline does not beat the benchmark, that is the finding. | Never. |

## Tooling

| Idea | Status | Why closed |
|---|---|---|
| Writing into arrays from pandas `.to_numpy()` | Tested | Read-only under pandas 3; crashed the first LOBO run. Copy first. |
| Bash heredocs to generate large notebook files | Tested | Quoting broke on long generators. Write the generator with the Write tool instead. |
