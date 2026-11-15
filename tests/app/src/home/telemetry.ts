// Live telemetry for the Home card: surface temperature from the ground model, dust opacity τ from the
// Mastcam table, and slope from the DEM, all at the rover.
import { useEffect, useState } from "react";
import { useApp } from "../state/store";
import { mtcSeconds, SOL } from "../state/clock";
import { GRID, toLonLat, type Pt } from "../map/geo";
import { loadGroundFrame, loadTau, terrainAt, useMapData, type Manifest } from "../map/data";
import { nearestSeason, tauForSol, type Tau } from "./tau";

// The pure τ helpers live in tau.ts (testable without React Native); re-exported for existing imports.
export { nearestSeason, tauForSol, tauLevel, type Tau } from "./tau";

/** The rover's local true solar time (hours) now: LTST ≈ MTC + east longitude / 15. */
export function ltstHours(p: Pt): number {
  return (((mtcSeconds() / 3600 + toLonLat(p).lon / 15) % 24) + 24) % 24;
}

/** The 30-minute frame label ("1430") for an LTST in hours. */
export const frameFor = (h: number) => {
  const m = (Math.round(h * 2) % 48) * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`;
};

/** Ground temperature (K) at p from a telemetry frame, or null. */
export function tempAt(m: Manifest, codes: Uint8Array, p: Pt): number | null {
  const g = m.telemetry!.ground;
  if (p.x < 0 || p.y < 0 || p.x >= GRID.W || p.y >= GRID.H) return null;
  const r = Math.floor(p.y / g.cell_world_px), c = Math.floor(p.x / g.cell_world_px);
  if (r >= g.rows || c >= g.cols) return null;
  const v = codes[r * g.cols + c];
  if (v === g.nodata) return null;
  const [lo, hi] = g.range_k;
  return lo + (v / g.levels) * (hi - lo);
}

export interface Telemetry {
  tempK: number | null;
  tempSub: string; // "Ls 195° · 14:30 LTST"
  tau: Tau | null;
  slope: number | null;
}

/** Re-reads every minute (the LTST frame changes every 30 minutes) and when the rover moves to another cell. */
export function useTelemetry(): Telemetry {
  const { state: S } = useApp();
  const { manifest, terrain } = useMapData();
  const [tau, setTau] = useState<Tau | null>(null);
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));
  const [temp, setTemp] = useState<{ key: string; k: number | null } | null>(null);

  useEffect(() => {
    let live = true;
    loadTau(manifest).then(t => live && setTau(t ? tauForSol(t, SOL) : null));
    return () => { live = false; };
  }, [manifest]);
  useEffect(() => {
    const id = setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 30000);
    return () => clearInterval(id);
  }, []);

  const g = manifest?.telemetry?.ground;
  const season = g && tau ? nearestSeason(g.seasons, tau.ls) : null;
  const frame = frameFor(ltstHours(S.rover));
  const cell = g ? `${Math.floor(S.rover.y / g.cell_world_px)},${Math.floor(S.rover.x / g.cell_world_px)}` : "";
  const key = `${season?.tag}|${frame}|${cell}|${minute}`;
  useEffect(() => {
    if (!manifest || !season) return;
    let live = true;
    loadGroundFrame(manifest, season.tag, frame).then(codes => {
      if (live) setTemp({ key, k: codes ? tempAt(manifest, codes, S.rover) : null });
    });
    return () => { live = false; };
    // S.rover is covered by `cell` in the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, key]);

  return {
    tempK: temp?.k ?? null,
    tempSub: season ? `Ls ${season.ls}° · ${frame.slice(0, 2)}:${frame.slice(2)}` : "",
    tau,
    slope: terrainAt(terrain, S.rover)?.slope ?? null,
  };
}
