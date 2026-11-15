// Dust-devil advisory and the top hazard banner, from real data: the pipeline's Dust Devil Heating
// Index (the design's moving "Dust Devil #84" was fake) and the hazard zones.
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/store";
import { distanceM, GRID, type Pt } from "../map/geo";
import { loadDustLevels, useMapData } from "../map/data";
import { useRoutes } from "../route/RouteProvider";
import { edgeDist, pxToKm } from "../route/router";

const SEARCH_CELLS = 300; // look 30 km around the rover
export const WATCH_KM = 5; // "WATCH" when strong heating is closer than this

/** Compass point ("SSE") of b as seen from a. */
export function compass(a: Pt, b: Pt): string {
  const deg = ((Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI + 360) % 360;
  return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16];
}

/** Centre of the nearest cell at `level` or above, within SEARCH_CELLS of p. */
function nearestCell(levels: Uint8Array, p: Pt, level: number): Pt | null {
  const cx = Math.floor(p.x), cy = Math.floor(p.y);
  let best: Pt | null = null, bestD = Infinity;
  const y0 = Math.max(0, cy - SEARCH_CELLS), y1 = Math.min(GRID.H - 1, cy + SEARCH_CELLS);
  const x0 = Math.max(0, cx - SEARCH_CELLS), x1 = Math.min(GRID.W - 1, cx + SEARCH_CELLS);
  for (let y = y0; y <= y1; y++) {
    const row = y * GRID.W, dy = y - cy;
    if (dy * dy >= bestD) continue;
    for (let x = x0; x <= x1; x++) {
      if (levels[row + x] < level) continue;
      const d = (x - cx) ** 2 + dy * dy;
      if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5 }; }
    }
  }
  return best;
}

export interface DustAdvisory {
  sol: number;
  tau: number;
  here: number; // heating level under the rover, 0-3
  high: { p: Pt; km: number; dir: string } | null;
}

export function useDustAdvisory(): DustAdvisory | null {
  const { state: S } = useApp();
  const { manifest } = useMapData();
  const [levels, setLevels] = useState<{ sol: number; v: Uint8Array | null } | null>(null);
  useEffect(() => {
    let live = true;
    loadDustLevels(manifest, S.dustSol).then(v => live && setLevels({ sol: S.dustSol, v }));
    return () => { live = false; };
  }, [manifest, S.dustSol]);
  const cellKey = `${Math.floor(S.rover.x)},${Math.floor(S.rover.y)}`;
  return useMemo(() => {
    const info = manifest?.dustDevil?.sols.find(s => s.sol === S.dustSol);
    if (!levels?.v || levels.sol !== S.dustSol || !info) return null;
    const r = S.rover;
    const here = levels.v[Math.floor(r.y) * GRID.W + Math.floor(r.x)] ?? 0;
    const p = nearestCell(levels.v, r, 3);
    return { sol: info.sol, tau: info.tau, here, high: p ? { p, km: distanceM(r, p) / 1000, dir: compass(r, p) } : null };
    // the rover's cell stands in for S.rover
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, S.dustSol, cellKey, manifest]);
}

/** The nearest enabled hazard (zone edge or strong dust-devil heating) for the banner, or null. */
export function useNearestHazard(adv: DustAdvisory | null): { name: string; km: number; detail: string; color: string } | null {
  const { state: S } = useApp();
  const r = useRoutes();
  let best: { name: string; km: number; detail: string; color: string } | null = null;
  for (const z of r.zones) {
    const km = Math.max(0, pxToKm(edgeDist(S.rover, z)));
    if (!best || km < best.km) best = { name: z.name, km, detail: z.detail, color: z.color };
  }
  if (S.hazTypes.weather && adv?.high && (!best || adv.high.km < best.km)) {
    best = { name: "Dust devil heating", km: adv.high.km, detail: `High heating index, sol ${adv.sol}`, color: "#d946ef" };
  }
  return best;
}
