// Rover panoramas for Street Level, built by mars_streetview/build_panos.py into app/data/panos/ and
// served with the map data (/mapdata/panos/). panos.json lists each panorama (position, camera, sol,
// tile pyramid size) and its links to neighbours within 5 km; tiles are <id>/<zoom>_<x>_<y>.jpg,
// zoom z holding 2^z × 2^z tiles of an equirectangular sphere (x = 0 at north, heading clockwise).
import { useEffect, useState } from "react";
import { dataUri } from "../map/data";
import { distanceM, toWorld, type Pt } from "../map/geo";

export interface PanoLink { pano: string; heading: number; distance_m: number; description: string }
export interface Pano extends Pt {
  id: string;
  title: string;
  lat: number;
  lon: number;
  world_w: number; // equirect width at the top zoom, px
  max_zoom: number;
  heading: number; // compass bearing of the source image's centre
  sol: number | null;
  camera: string;
  hfov: number; // degrees of real imagery horizontally (the rest of the sphere is filled)
  vfov: number; // degrees of real imagery vertically
  pitch: number; // elevation of the imagery's vertical centre
  waypoint: string | null; // landmark id this panorama is the street-level view of (manifest "waypoint")
  links: PanoLink[];
  source: string;
}
export interface Panos { tile: number; credit: string; list: Pano[]; byId: Record<string, Pano> }

/** How far from a waypoint a panorama still counts as its street-level view. */
export const STREET_RADIUS_KM = 3;

const ID = /^[a-z0-9_]{1,40}$/;
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** panos.json comes over the network: keep only well-formed entries, and links between them. */
export function parsePanos(raw: unknown): Panos | null {
  const o = raw as { tile?: unknown; credit?: unknown; panos?: unknown };
  if (!o || typeof o !== "object" || !num(o.tile, 64, 2048) || !o.panos || typeof o.panos !== "object") return null;
  const list: Pano[] = [];
  for (const v of Object.values(o.panos as Record<string, unknown>).slice(0, 200)) {
    const p = v as Record<string, unknown>;
    if (!p || typeof p.id !== "string" || !ID.test(p.id)) continue;
    if (!num(p.lat, -90, 90) || !num(p.lon, -180, 360) || !num(p.max_zoom, 0, 6) || !Number.isInteger(p.max_zoom)) continue;
    if (!num(p.world_w, 256, 32768) || !num(p.heading, -360, 720)) continue;
    const links = (Array.isArray(p.links) ? p.links : []).slice(0, 20)
      .map(l => l as Record<string, unknown>)
      .filter(l => l && typeof l.pano === "string" && ID.test(l.pano) && num(l.heading, -360, 720) && num(l.distance_m, 0, 1e6))
      .map(l => ({ pano: l.pano as string, heading: ((l.heading as number) % 360 + 360) % 360, distance_m: l.distance_m as number, description: str(l.description, 80) }));
    list.push({
      id: p.id, title: str(p.title, 80) || p.id, lat: p.lat, lon: p.lon, world_w: p.world_w, max_zoom: p.max_zoom,
      heading: p.heading, sol: num(p.sol, 0, 100000) ? Math.round(p.sol) : null, camera: str(p.camera, 20),
      hfov: num(p.hfov, 1, 360) ? p.hfov : 360, vfov: num(p.vfov, 1, 180) ? p.vfov : 90, pitch: num(p.pitch, -90, 90) ? p.pitch : 0,
      waypoint: typeof p.waypoint === "string" && /^[a-z0-9-]{1,24}$/.test(p.waypoint) ? p.waypoint : null, links, source: /^https:\/\//.test(str(p.source, 300)) ? str(p.source, 300) : "",
      ...toWorld({ lon: p.lon, lat: p.lat }),
    });
  }
  const byId = Object.fromEntries(list.map(p => [p.id, p]));
  for (const p of list) p.links = p.links.filter(l => byId[l.pano] && l.pano !== p.id);
  return list.length ? { tile: o.tile, credit: str(o.credit, 120), list, byId } : null;
}

let panosPromise: Promise<Panos | null> | null = null;
export function loadPanos(): Promise<Panos | null> {
  if (!panosPromise) {
    panosPromise = fetch(dataUri("panos/panos.json"))
      .then(r => (r.ok ? r.json() : null))
      .then(parsePanos)
      .catch(() => null);
  }
  return panosPromise;
}

/** The panoramas: undefined while loading, null when none are built or they can't be reached. */
export function usePanos(): Panos | null | undefined {
  const [p, setP] = useState<Panos | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadPanos().then(v => live && setP(v));
    return () => { live = false; };
  }, []);
  return p;
}

/**
 * The panorama for a waypoint, with its distance: the one the manifest assigns to it, at any distance
 * (landmark positions are approximate, and a rim view can look toward a waypoint far away), else the
 * nearest within `km`.
 */
export function panoNear(panos: Panos | null | undefined, p: Pt & { id?: string }, km = STREET_RADIUS_KM): { pano: Pano; km: number } | null {
  const own = p.id ? panos?.list.find(q => q.waypoint === p.id) : undefined;
  if (own) return { pano: own, km: distanceM(p, own) / 1000 };
  let best: { pano: Pano; km: number } | null = null;
  for (const q of panos?.list ?? []) {
    const d = distanceM(p, q) / 1000;
    if (d <= km && (!best || d < best.km)) best = { pano: q, km: d };
  }
  return best;
}

export const tileUri = (id: string, z: number, x: number, y: number) => dataUri(`panos/${id}/${z}_${x}_${y}.jpg`);

/** Degrees in [0, 360). */
export const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** Signed difference a − b in (−180, 180]. */
export const diff180 = (a: number, b: number) => { const d = norm360(a - b); return d > 180 ? d - 360 : d; };
export const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compassName = (h: number) => COMPASS[Math.round(norm360(h) / 22.5) % 16];

/** Compass bearing (degrees) from a to b on the map grid. */
export const bearing = (a: Pt, b: Pt) => norm360((Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI);

// --- the imagery strip ---
// The viewer turns along the strip of real imagery, which repeats end to end so dragging never stops:
// a full circle simply goes round, a partial panorama (Rocknest is 171° wide) starts again at its other
// edge. Strip position u (degrees, any value) maps to the true bearing of the pixel under it.

/** Degrees of imagery horizontally: 360 for a full circle. */
export const stripSpan = (p: Pano) => (p.hfov >= 359.5 ? 360 : p.hfov);
/** Bearing at the strip's left edge (u = 0). */
const stripLeft = (p: Pano) => p.heading - stripSpan(p) / 2;
/** True bearing at strip position u. */
export const stripToAz = (p: Pano, u: number) => {
  const s = stripSpan(p);
  return norm360(stripLeft(p) + (((u % s) + s) % s));
};
/** Strip position (0 ≤ u < span) showing bearing az, or null when that bearing has no imagery. */
export const azToStrip = (p: Pano, az: number): number | null => {
  const d = norm360(az - stripLeft(p));
  return d < stripSpan(p) ? d : null;
};
/** The copy of strip position u0 nearest to u (so turning toward something takes the short way). */
export const nearestCopy = (p: Pano, u0: number, u: number) => {
  const s = stripSpan(p);
  return u0 + Math.round((u - u0) / s) * s;
};
/** Elevation band of real imagery, trimmed for the ragged black edges of mosaics (up to ~8% of their height). */
export const imageryBand = (p: Pano) => {
  const inset = p.vfov * 0.08;
  return { top: Math.min(90, p.pitch + p.vfov / 2 - inset), bottom: Math.max(-90, p.pitch - p.vfov / 2 + inset) };
};
