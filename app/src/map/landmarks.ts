// The 19 landmarks from the design, on the real map.
//
// `real: true` sites are places Curiosity visited (or Mount Sharp's highest point, read off the DEM);
// their positions are approximate published locations, good to a few hundred metres. `real: false`
// sites (habitats, relays, landing pads, checkpoints, two craters) are invented for the scenario and
// placed on suitable real ground near the traverse: flat floor for pads and checkpoints, real craters
// for the craters. Elevation and slope come from the terrain grid at run time, not from this table.
import { toWorld, type Pt } from "./geo";

export type Category = "Traverse" | "Water-Ice" | "Habitats" | "Geological" | "Craters" | "Relays" | "Landing";

export interface Landmark extends Pt {
  id: string;
  name: string;
  cat: Category;
  lon: number;
  lat: number;
  /** Label priority: 1 always shown, 2 from zoom 1.7, 3 from zoom 2.4 (the design's rule). */
  rank: 1 | 2 | 3;
  real: boolean;
  desc: string;
  note: string;
}

const L: Omit<Landmark, "x" | "y">[] = [
  { id: "bradbury", name: "Bradbury Landing", cat: "Landing", lon: 137.4417, lat: -4.5895, rank: 1, real: true,
    desc: "Curiosity touchdown site, Sol 0. Flat alluvial plain with cached supplies.",
    note: "Home base. Every route starts from the rover unless you move it." },
  { id: "yellowknife", name: "Yellowknife Bay", cat: "Water-Ice", lon: 137.4466, lat: -4.5885, rank: 2, real: true,
    desc: "Ancient lakebed mudstone; first drill site (John Klein).",
    note: "Low-slope approach from the west. Good first science stop." },
  { id: "rocknest", name: "The Rocknest", cat: "Geological", lon: 137.4443, lat: -4.5872, rank: 1, real: true,
    desc: "Wind-drift sand shadow; first scoop samples of the mission.",
    note: "Route #2 adds 6 min but stays out of the afternoon dust-devil heating zone." },
  { id: "pahrump", name: "Pahrump Hills", cat: "Geological", lon: 137.37, lat: -4.665, rank: 1, real: true,
    desc: "Murray formation outcrop at the base of Mount Sharp.",
    note: "Surface temps here drop fast after 15:00 MTC. Plan arrival before then." },
  { id: "hematite", name: "Hematite Hotspot", cat: "Geological", lon: 137.368, lat: -4.723, rank: 2, real: true,
    desc: "Strong hematite signature on a ridge-top outcrop.",
    note: "Last 400 m are a 14\u00b0 grade. Keep speed under 4 km/h." },
  { id: "murray", name: "Murray Buttes", cat: "Geological", lon: 137.377, lat: -4.71, rank: 2, real: true,
    desc: "Sandstone buttes and mesas; boulder field to the east.",
    note: "Approach from the north. The east side is flagged rough terrain." },
  { id: "bagnold", name: "Bagnold Dunes", cat: "Geological", lon: 137.382, lat: -4.694, rank: 1, real: true,
    desc: "Active dark basaltic dune field.",
    note: "Low thermal inertia sand: wheels sink. No safe crossing today." },
  { id: "summit", name: "Mount Sharp Summit", cat: "Geological", lon: 137.86, lat: -5.3658, rank: 1, real: true,
    desc: "Highest point of Aeolis Mons on the map grid, about 5.5 km above the crater floor.",
    note: "Critical incline on every flank. EVA time at altitude is radiation-limited." },
  { id: "peace", name: "Peace Vallis Fan", cat: "Water-Ice", lon: 137.4, lat: -4.47, rank: 2, real: true,
    desc: "Alluvial fan fed by the northern rim channel; hydrated minerals.",
    note: "Channel walls shade the fan after 16:00. Cold, but sheltered from wind." },
  { id: "glen", name: "Glen Torridon", cat: "Water-Ice", lon: 137.38, lat: -4.738, rank: 2, real: true,
    desc: "Clay-bearing trough with the strongest smectite signal in the crater.",
    note: "Clay unit is soft but stable. A good shelter stop on long traverses." },
  { id: "habitat", name: "Habitat Alpha", cat: "Habitats", lon: 137.3657, lat: -4.556, rank: 1, real: false,
    desc: "Pressurized hab module, 4 crew. O2 and water resupply.",
    note: "Resupply here before any traverse over 20 km." },
  { id: "relay2", name: "Relay Mast R-2", cat: "Relays", lon: 137.3353, lat: -4.5459, rank: 3, real: false,
    desc: "UHF relay, 12 km line-of-sight radius.",
    note: "Coverage drops behind the rim west of here." },
  { id: "relay1", name: "Relay Mast R-1", cat: "Relays", lon: 137.5175, lat: -4.6353, rank: 3, real: false,
    desc: "UHF relay, 12 km line-of-sight radius.",
    note: "Covers the Rocknest and Pahrump corridor." },
  { id: "lz2", name: "LZ-2 Aeolis Palus", cat: "Landing", lon: 137.639, lat: -4.5965, rank: 2, real: false,
    desc: "Surveyed landing pad. 1.1\u00b0 mean slope, no boulders over 20 cm.",
    note: "Clear for descent. Dust opacity \u03c4 0.32 is within limits." },
  { id: "lz3", name: "LZ-3 Emergency Pad", cat: "Landing", lon: 137.2847, lat: -4.7821, rank: 3, real: false,
    desc: "Emergency ascent-vehicle pad; unlit.",
    note: "Reachable from the Bagnold edge in 40 min if an abort is called." },
  { id: "crater7k", name: "Crater 7-K", cat: "Craters", lon: 137.202, lat: -4.5813, rank: 3, real: false,
    desc: "Fresh 400 m impact crater; ejecta blocks expose bedrock.",
    note: "Rim is loose. Sample from the outer ejecta instead." },
  { id: "rimcrater", name: "North Rim Crater", cat: "Craters", lon: 137.7756, lat: -4.3468, rank: 3, real: false,
    desc: "Degraded crater on the northern floor, below the rim.",
    note: "Outside relay coverage. Log a check-in before leaving the floor." },
  { id: "t4", name: "Checkpoint T-4", cat: "Traverse", lon: 137.4871, lat: -4.6809, rank: 3, real: false,
    desc: "Curiosity traverse marker, Sol 1400.",
    note: "Known-good ground; tracks still visible." },
  { id: "t9", name: "Checkpoint T-9", cat: "Traverse", lon: 137.5175, lat: -4.6724, rank: 3, real: false,
    desc: "Curiosity traverse marker, Sol 2300.",
    note: "Short steep step at the vein field. Walk it, do not drive it." },
];

export const LANDMARKS: Landmark[] = L.map(l => ({ ...l, ...toWorld(l) }));
export const landmarkById = (id: string | null) => LANDMARKS.find(l => l.id === id) ?? null;

/** Zoom at which a rank's label appears. */
export const LABEL_ZOOM: Record<Landmark["rank"], number> = { 1: 0, 2: 1.7, 3: 2.4 };
