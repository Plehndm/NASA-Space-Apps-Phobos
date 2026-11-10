// What the temperature maps can't tell you. Shown next to the heat layer (legend, popover, Layers card)
// and in full on the About screen. Plain TypeScript, no React, so the tests can check it.
//
// Numbers come from the pipeline's own write-ups, never from here: MarsDataPipline/README.md ("Results in
// one paragraph": ground ≈4.9 K RMSE in leave-one-block-out tests and 5.3 K sealed, air ≈4.1 K, all REMS
// data within about 10 x 5 km), docs/plan.md ("Watch for (ground)": 82% of pixels below 361 tiu) and
// docs/literature_check.md (published REMS thermal inertia backs the THEMIS scaling at the rover, not one
// scale for the whole crater). Change them there first.
import type { HeatKind, Manifest } from "./data";

/** The one-line version, for the map legend. */
export const HEAT_CHECKED = "Checked at the rover only";

/** The short list beside the heat controls, the same for ground and air. */
export const KEY_LIMITS: readonly string[] = [
  "At the rover: about 5 K error (RMSE) for ground, 4 K for air. Not clearly better than a seasonal average of Curiosity's REMS readings.",
  "Away from the rover, accuracy is not measured: all REMS data comes from an area of about 10 × 5 km.",
  "Most of the map (82% of pixels) is outside the thermal-inertia range the rover data tests.",
  "Night air is nearly uniform across the crater: a model limit, not physics.",
  "Published REMS studies back the THEMIS thermal-inertia scaling near the rover only, not one scale for the whole crater.",
];

/** Where the full story is, in the project repository. */
export const LIMITS_DOCS = "MarsDataPipline/README.md and MarsDataPipline/docs/ (plan.md, literature_check.md)";

/**
 * Used when the map data's manifest has no caveats for a kind (an older build). Paraphrased from
 * MarsDataPipline/docs/plan.md, README.md and CLAUDE.md; the manifest's own text is preferred.
 */
export const FALLBACK_CAVEATS: Record<HeatKind, readonly string[]> = {
  ground: [
    "Spatial skill is not measured: all rover positions lie within about 10 × 5 km.",
    "82% of pixels have THEMIS thermal inertia below the rover's range (361 tiu); there the model runs at ti_scale × THEMIS, untested by the rover data.",
    "Slope is clamped to the rover's 1.25–12.27° in the correction only, so steep crater walls and Mount Sharp's flanks rest on the physics baseline alone.",
  ],
  air: [
    "Does not clearly beat a seasonal average of Curiosity's REMS air readings.",
    "Night air is nearly uniform across the crater: a model limit, not physics.",
    "No elevation or lapse-rate term: terrain enters only through the ground map.",
    "Spatial skill is not measured: all rover positions lie within about 10 × 5 km.",
    "Built from the ground map, so every ground caveat applies too.",
  ],
};

const MAX_LINES = 12; // the manifest comes over the network: keep a bad one from flooding the screen

/**
 * The caveats for one map (ground or air): the manifest's own list when it has one, else the built-in
 * fallback. `from` says which, so the screen can say where the text came from.
 */
export function heatCaveats(heat: Manifest["heat"] | null | undefined, kind: HeatKind): { lines: string[]; from: "manifest" | "fallback" } {
  const raw = heat?.kinds?.[kind]?.caveats;
  const list = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  const lines = list
    .filter((s): s is string => typeof s === "string")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES);
  return lines.length ? { lines, from: "manifest" } : { lines: [...FALLBACK_CAVEATS[kind]], from: "fallback" };
}
