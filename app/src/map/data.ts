// Map data: where it is served from, the manifest that lists it, and the terrain grid.
//
// The files are built from the pipeline outputs by scripts/build_map_data.py into app/data/, and the
// Expo dev server serves them at /mapdata/ (metro.config.js). So the app loads them from the same
// address it was loaded from: LAN, IPv6 hotspot or --tunnel, with no setup. For a hosted demo,
// upload app/data/ anywhere static and set EXPO_PUBLIC_DATA_URL (e.g. in app/.env.local).
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { GRID, inWorld, type Pt } from "./geo";

function dataUrl(): string {
  const env = process.env.EXPO_PUBLIC_DATA_URL;
  if (env) return env.replace(/\/+$/, "");
  if (Platform.OS === "web" && typeof location !== "undefined") return `${location.origin}/mapdata`;
  // "192.168.1.5:8081", "[2607:…]:8081" or "abc-8081.exp.direct": host and port, kept whole.
  const hostUri = Constants.expoConfig?.hostUri ?? "localhost:8081";
  return `http://${hostUri}/mapdata`;
}

export const DATA_URL = dataUrl();
export const dataUri = (path: string) => `${DATA_URL}/${path}`;

// --- manifest (data/manifest.json; see build_map_data.py for every field) ---

export interface Manifest {
  version: number;
  built: string;
  grid: typeof GRID;
  imagery?: { path: string; zooms: [number, number]; per_zoom: Record<string, { rows: [number, number]; cols: [number, number] }>; attribution: string };
  terrain?: { path: string; elev: { nodata: number }; slope: { scale_deg: number; nodata: number }; slope_q3?: { scale_deg: number; nodata: number }; elev_range_m: [number, number] };
  strata?: { levels: { level: 1 | 2 | 3; path: string; min_m: number | null; max_m: number | null; share: number }[]; ramp: string[]; elev_range_m: [number, number]; rect: Rect };
  heat?: {
    kinds: Record<HeatKind, { title: string; range_by_season_k: Record<string, [number, number]>; caveats?: unknown }>;
    seasons: { tag: string; ls: number; tau: number }[];
    frames: string[]; // "0000" … "2330"
    path: string; // heat/{kind}/{season}/{frame}.webp
    rect: Rect;
    range_k: [number, number];
    legend_stops: string[];
    credit: string;
  };
  dustDevil?: {
    sols: { sol: number; ls: number; tau: number; tau_source: string; path: string; levels_path?: string; share_low_mod_high: [number, number, number] }[];
    ref_sol: number;
    class_cuts: [number, number, number];
    colours: [string, string, string];
    levels: string[];
    rect: Rect;
    meaning: string;
  };
}
export type HeatKind = "ground" | "air";
export type Rect = [number, number, number, number]; // x, y, w, h in world px

export const heatUri = (m: NonNullable<Manifest["heat"]>, kind: HeatKind, season: string, frame: string) =>
  dataUri(m.path.replace("{kind}", kind).replace("{season}", season).replace("{frame}", frame));

// --- terrain grid ---

export interface Terrain {
  elev: Int16Array; // metres, H*W row-major (mean of the 20 m DEM)
  slope: Uint8Array; // quarter degrees (mean of the 20 m slope raster)
  slopeQ3: Uint8Array | null; // quarter degrees: upper-quartile 20 m slope in the cell
  elevNodata: number;
  slopeScale: number;
  slopeNodata: number;
}

/** Elevation (m) and slope (°) of the cell under world point p, or null outside the data. */
export function terrainAt(t: Terrain | null, p: Pt): { elev: number; slope: number } | null {
  if (!t || !inWorld(p)) return null;
  const i = Math.floor(p.y) * GRID.W + Math.floor(p.x);
  const e = t.elev[i], s = t.slope[i];
  if (e === t.elevNodata || s === t.slopeNodata) return null;
  return { elev: e, slope: s * t.slopeScale };
}

// --- provider ---

export interface MapData {
  status: "loading" | "ready" | "offline";
  manifest: Manifest | null;
  terrain: Terrain | null;
}

const Ctx = createContext<MapData>({ status: "loading", manifest: null, terrain: null });

async function load(): Promise<{ manifest: Manifest; terrain: Terrain | null }> {
  const res = await fetch(dataUri("manifest.json"));
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  const g = manifest.grid;
  if (g.W !== GRID.W || g.H !== GRID.H || Math.abs(g.LON0 - GRID.LON0) > 1e-9 || Math.abs(g.LAT0 - GRID.LAT0) > 1e-9) {
    throw new Error("map data was built for a different grid than src/map/geo.ts");
  }
  let terrain: Terrain | null = null;
  if (manifest.terrain) {
    const buf = await (await fetch(dataUri(manifest.terrain.path))).arrayBuffer();
    const n = GRID.W * GRID.H;
    const hasQ3 = !!manifest.terrain.slope_q3;
    if (buf.byteLength !== n * (hasQ3 ? 4 : 3)) throw new Error(`terrain.bin is ${buf.byteLength} bytes, expected ${n * (hasQ3 ? 4 : 3)}`);
    terrain = {
      elev: new Int16Array(buf, 0, n), // little-endian, like every platform the app runs on
      slope: new Uint8Array(buf, n * 2, n),
      slopeQ3: hasQ3 ? new Uint8Array(buf, n * 3, n) : null,
      elevNodata: manifest.terrain.elev.nodata,
      slopeScale: manifest.terrain.slope.scale_deg,
      slopeNodata: manifest.terrain.slope.nodata,
    };
  }
  return { manifest, terrain };
}

/** Loads the manifest and terrain once. Layers render nothing until their part of the manifest exists. */
export function MapDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MapData>({ status: "loading", manifest: null, terrain: null });
  useEffect(() => {
    let live = true;
    load()
      .then(d => live && setData({ status: "ready", ...d }))
      .catch(err => {
        console.warn(`Map data unavailable from ${DATA_URL}: ${err}. Build it with scripts/build_map_data.py (see app/README.md).`);
        if (live) setData({ status: "offline", manifest: null, terrain: null });
      });
    return () => { live = false; };
  }, []);
  return createElement(Ctx.Provider, { value: data }, children);
}

export const useMapData = () => useContext(Ctx);

/** Per-cell dust-devil heating level (0 none, 1 low, 2 moderate, 3 high) for one sol, or null. */
const levelCache = new Map<string, Promise<Uint8Array | null>>();
export function loadDustLevels(m: Manifest | null, sol: number): Promise<Uint8Array | null> {
  const entry = m?.dustDevil?.sols.find(s => s.sol === sol);
  if (!entry?.levels_path) return Promise.resolve(null);
  let p = levelCache.get(entry.levels_path);
  if (!p) {
    p = fetch(dataUri(entry.levels_path))
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(b => (b.byteLength === GRID.W * GRID.H ? new Uint8Array(b) : null))
      .catch(() => null);
    levelCache.set(entry.levels_path, p);
  }
  return p;
}
