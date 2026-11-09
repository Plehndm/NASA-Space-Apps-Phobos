// Hazard zones. The design's five types, placed on the real map from the terrain data
// (MarsDataPipline 100 m feature table; numbers below are from it):
//   steep      the 2 km window with the highest mean slope within 12 km of the rover (20°)
//   rough      the most variable slope (σ 8° over 1.5 km) 3–12 km from the rover
//   sand       the lowest thermal inertia within 12 km (2.4 km mean 236 tiu: loose material)
//   radiation  upper Mount Sharp, the highest ground in the crater interior
// Dust devils (type "weather") are not an ellipse: they are the pipeline's Dust Devil Heating
// Index, drawn by DustDevilLayer.
import { C } from "../theme";
import type { HazType } from "../state/store";
import { toWorld, type Pt } from "./geo";

export interface HazardZone extends Pt {
  id: string;
  type: Exclude<HazType, "weather">;
  name: string;
  label: string; // pill above the zone
  rx: number; // radii in world px (100 m)
  ry: number;
  rot: number; // degrees
  color: string;
  detail: string;
}

const Z = (lon: number, lat: number, z: Omit<HazardZone, "x" | "y">): HazardZone => ({ ...z, ...toWorld({ lon, lat }) });

export const HAZARD_ZONES: HazardZone[] = [
  Z(137.5782, -4.7399, {
    id: "steep", type: "steep", name: "Steep slopes", label: "> 20° MEAN GRADE", rx: 26, ry: 16, rot: -20,
    color: C.hazSteep, detail: "Mount Sharp's northern flank, 20° average over 2 km",
  }),
  Z(137.4146, -4.7888, {
    id: "rough", type: "rough", name: "Rough terrain", label: "BROKEN GROUND // σ 8°", rx: 18, ry: 13, rot: 10,
    color: C.hazRough, detail: "Slope changes sharply from cell to cell: ridges, scarps and blocks",
  }),
  Z(137.5934, -4.6876, {
    id: "sand", type: "sand", name: "Low thermal inertia", label: "SAND TRAP // TI ≈ 236", rx: 22, ry: 13, rot: 28,
    color: C.hazSand, detail: "Lowest thermal inertia near the rover: loose, unconsolidated material",
  }),
  Z(137.8500, -5.2700, {
    id: "radiation", type: "radiation", name: "Radiation", label: "HIGH GROUND // THIN AIR", rx: 70, ry: 48, rot: 0,
    color: C.hazRadiation, detail: "Upper Mount Sharp, near 0 m: least atmosphere overhead, highest dose",
  }),
];

/** Filter chips, in the design's order. */
export const HAZ_TYPES: { type: HazType; name: string; color: string }[] = [
  { type: "rough", name: "Rough terrain", color: C.hazRough },
  { type: "steep", name: "Steep slopes", color: C.hazSteep },
  { type: "weather", name: "Dust devils", color: C.hazDust },
  { type: "radiation", name: "Radiation", color: C.hazRadiation },
  { type: "sand", name: "Sand traps", color: C.hazSand },
];
