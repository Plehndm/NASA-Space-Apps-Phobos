// Search: which landmarks match the query and category, and coordinate queries.
import { GRID, toWorld, type Pt } from "../map/geo";
import { LANDMARKS, type Category, type Landmark } from "../map/landmarks";

export const CATS: ("All" | Category)[] = ["All", "Traverse", "Water-Ice", "Habitats", "Geological", "Craters", "Relays", "Landing"];
export const CAT_CODE: Record<Category, string> = {
  Traverse: "TR", "Water-Ice": "WI", Habitats: "HB", Geological: "GE", Craters: "CR", Relays: "RL", Landing: "LZ",
};

/** Search queries are capped: they only ever feed substring matching and the coordinate parser. */
export const MAX_QUERY = 80;

/** The design's rule: category matches and the query appears in the name, the category or the description. */
export function matches(l: Landmark, q: string, cat: "All" | Category): boolean {
  if (cat !== "All" && l.cat !== cat) return false;
  const t = q.trim().toLowerCase();
  return !t || l.name.toLowerCase().includes(t) || l.cat.toLowerCase().includes(t) || l.desc.toLowerCase().includes(t);
}

export const isFiltering = (q: string, cat: string) => !!q.trim() || cat !== "All";

/** Matching landmarks, nearest to `from` first. */
export function results(q: string, cat: "All" | Category, from: Pt): Landmark[] {
  const d = (l: Landmark) => Math.hypot(l.x - from.x, l.y - from.y);
  return LANDMARKS.filter(l => matches(l, q, cat)).sort((a, b) => d(a) - d(b));
}

/**
 * A coordinate query inside the map, or null: "4.59S 137.44E", "4.59°S, 137.44°E", "-4.59 137.44".
 * Latitude comes first; N/S and E/W letters set the signs (Gale is south and east).
 */
export function parseCoords(q: string): Pt | null {
  const m = q.trim().slice(0, MAX_QUERY).match(/^(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = Number(m[1]), lon = Number(m[3]);
  if (m[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
  if (m[2]?.toUpperCase() === "N") lat = Math.abs(lat);
  if (m[4]?.toUpperCase() === "W") lon = -Math.abs(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = toWorld({ lon, lat });
  return p.x >= 0 && p.y >= 0 && p.x < GRID.W && p.y < GRID.H ? p : null;
}
