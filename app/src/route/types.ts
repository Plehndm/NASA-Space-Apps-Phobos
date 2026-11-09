// Route and expedition state kept in the app store.
import type { Pt } from "../map/geo";

/** A running expedition (the design's `nav`). Distances are world px along `pts`. */
export interface Nav {
  stops: string[]; // landmark ids still to visit, in order
  pts: Pt[];
  legEnds: number[]; // index into pts where each leg ends (legEnds[0] = 0)
  cum: number[]; // cumulative length at each point
  prog: number; // distance driven along pts
  legIdx: number; // current leg
  startedAt: number; // Date.now() at the start
  driven: number; // world px driven since the start, across reroutes
  grade: number; // degrees, just ahead of the rover
  spd: number; // km/h at that grade
  safe: boolean; // planned on Route #2
}

export interface Arrived {
  name: string;
  km: number;
  min: number; // simulated minutes (demo speed applied)
  stops: number;
}
