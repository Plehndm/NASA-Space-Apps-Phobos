// Route planner over the real terrain (no React Native imports, so it can be tested with plain Node).
//
// The design's algorithm (Mars Navigator App Design/README.md, "Routing internals"), on the real DEM:
//   A* on a grid of NODE x NODE world px (200 m), 8 neighbours, with a tangent grade cap: an edge is
//   allowed only if |Δelevation| / horizontal distance <= tan(cap). Cost per edge is
//   d · (1 + 3 (grade/cap)²), times a roughness factor where the 20 m slope inside a cell is steeper
//   than the cap, and (safe routes only) a factor for dust-devil heating. Hazard zones (ellipses ×1.06)
//   are blocked on safe routes. The path is then straightened by line-of-sight smoothing.
//
// Route #1 (direct) uses a 25° cap and ignores hazards. Route #2 (safe) uses the rover grade limit
// from Settings and avoids every enabled hazard zone. "Override" lifts both caps to 45°.
import { GRID, M_PER_PX, type Pt } from "../map/geo";

export const NODE = 2; // world px per routing node (2 × 100 m = 200 m)
export const CAP_DIRECT = 25;
export const CAP_OVERRIDE = 45;
const ROUGH_FACTOR = 1.6; // cells whose upper-quartile 20 m slope exceeds the cap cost this much more
const DUST_FACTOR = [1, 1, 1.4, 2.5]; // safe routes: by dust-devil heating level 0-3

/** Rover speed (km/h) for a grade (°), from the design: ≤8° 8, ≤15° 5, ≤20° 3, else 2. */
export const speedFor = (g: number) => (g > 20 ? 2 : g > 15 ? 3 : g > 8 ? 5 : 8);
export const pxToKm = (px: number) => (px * M_PER_PX) / 1000;

export interface TerrainArrays {
  elev: Int16Array;
  elevNodata: number;
  slopeQ3: Uint8Array | null;
  slopeScale: number;
}

export interface Zone {
  id: string; name: string; detail: string;
  x: number; y: number; rx: number; ry: number; rot: number;
}

/** Elevation and roughness per routing node. */
export interface RouteGrid {
  W: number; H: number; // nodes
  elev: Float32Array; // m, NaN where there is no data
  rough: Float32Array; // mean upper-quartile 20 m slope in the node, degrees
  terrain: TerrainArrays;
}

export function makeGrid(t: TerrainArrays): RouteGrid {
  const W = Math.ceil(GRID.W / NODE), H = Math.ceil(GRID.H / NODE);
  const elev = new Float32Array(W * H), rough = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let se = 0, ne = 0, sr = 0, nr = 0;
      for (let dy = 0; dy < NODE; dy++) {
        const y = j * NODE + dy;
        if (y >= GRID.H) continue;
        for (let dx = 0; dx < NODE; dx++) {
          const x = i * NODE + dx;
          if (x >= GRID.W) continue;
          const c = y * GRID.W + x, e = t.elev[c];
          if (e !== t.elevNodata) { se += e; ne++; }
          if (t.slopeQ3 && t.slopeQ3[c] !== 255) { sr += t.slopeQ3[c] * t.slopeScale; nr++; }
        }
      }
      elev[j * W + i] = ne ? se / ne : NaN;
      rough[j * W + i] = nr ? sr / nr : 0;
    }
  }
  return { W, H, elev, rough, terrain: t };
}

/** Elevation (m) at a world point from the 100 m grid, or NaN. */
export function elevAt(t: TerrainArrays, p: Pt): number {
  const x = Math.min(GRID.W - 1, Math.max(0, Math.floor(p.x))), y = Math.min(GRID.H - 1, Math.max(0, Math.floor(p.y)));
  const e = t.elev[y * GRID.W + x];
  return e === t.elevNodata ? NaN : e;
}

// --- hazard geometry (world px) ---

function ellFrame(p: Pt, h: Zone) {
  const a = (-h.rot * Math.PI) / 180, dx = p.x - h.x, dy = p.y - h.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}
export function inside(p: Pt, h: Zone, k = 1): boolean {
  const f = ellFrame(p, h);
  return (f.x * f.x) / (h.rx * h.rx * k * k) + (f.y * f.y) / (h.ry * h.ry * k * k) < 1;
}
/** Distance (world px) from p to the zone's edge; negative inside. */
export function edgeDist(p: Pt, h: Zone): number {
  const f = ellFrame(p, h), th = Math.atan2(f.y, f.x);
  const r = (h.rx * h.ry) / Math.sqrt((h.ry * Math.cos(th)) ** 2 + (h.rx * Math.sin(th)) ** 2);
  return Math.hypot(f.x, f.y) - r;
}
/** Does the straight segment a→b enter the zone itself (safe routes keep a 6 % margin around it)? */
export function segHit(a: Pt, b: Pt, h: Zone): boolean {
  const n = Math.max(20, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (inside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, h)) return true;
  }
  return false;
}

// --- A* ---

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

class Heap {
  private k = new Float64Array(1024);
  private v = new Int32Array(1024);
  n = 0;
  push(key: number, val: number) {
    if (this.n === this.k.length) {
      const k = new Float64Array(this.n * 2), v = new Int32Array(this.n * 2);
      k.set(this.k); v.set(this.v); this.k = k; this.v = v;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= key) break;
      this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p;
    }
    this.k[i] = key; this.v[i] = val;
  }
  pop(): number {
    const top = this.v[0], lk = this.k[--this.n], lv = this.v[this.n];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      if (l >= this.n) break;
      const c = r < this.n && this.k[r] < this.k[l] ? r : l;
      if (this.k[c] >= lk) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = lk; this.v[i] = lv;
    return top;
  }
}

/**
 * Node elevation interpolated bilinearly between node centres. Along the line between two
 * neighbouring nodes this changes linearly, so a short step's grade equals the A* edge grade.
 */
export function nodeElev(g: RouteGrid, p: Pt): number {
  const fx = Math.min(g.W - 1, Math.max(0, p.x / NODE - 0.5)), fy = Math.min(g.H - 1, Math.max(0, p.y / NODE - 0.5));
  const i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = Math.min(g.W - 1, i0 + 1), j1 = Math.min(g.H - 1, j0 + 1);
  const u = fx - i0, v = fy - j0, e = g.elev;
  const a = e[j0 * g.W + i0], b = e[j0 * g.W + i1], c = e[j1 * g.W + i0], d = e[j1 * g.W + i1];
  const h = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  return h === h ? h : e[Math.round(fy) * g.W + Math.round(fx)];
}

const nodeOf = (g: RouteGrid, p: Pt) => {
  const i = Math.min(g.W - 1, Math.max(0, Math.floor(p.x / NODE))), j = Math.min(g.H - 1, Math.max(0, Math.floor(p.y / NODE)));
  return j * g.W + i;
};
const nodePt = (g: RouteGrid, n: number): Pt => {
  const i = n % g.W;
  return { x: (i + 0.5) * NODE, y: ((n - i) / g.W + 0.5) * NODE };
};

export interface Costs {
  cap: number; // degrees
  blocked: Uint8Array | null; // per node
  dust: Uint8Array | null; // per world cell, levels 0-3 (safe routes)
}

/** A* from start to goal. If the goal can't be reached, returns the path to the closest node reached. */
export function astar(g: RouteGrid, start: Pt, goal: Pt, c: Costs): { ok: boolean; pts: Pt[]; visited: number } {
  const N = g.W * g.H, s = nodeOf(g, start), t = nodeOf(g, goal);
  const gi = t % g.W, gj = (t - gi) / g.W;
  const cost = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const tanCap = Math.tan((c.cap * Math.PI) / 180), stepM = NODE * M_PER_PX;
  const heap = new Heap();
  cost[s] = 0;
  heap.push(Math.hypot(gi - (s % g.W), gj - Math.floor(s / g.W)), s);
  let best = s, bestH = Infinity, visited = 0;
  while (heap.n) {
    const n = heap.pop();
    if (closed[n]) continue;
    closed[n] = 1; visited++;
    if (n === t) break;
    const i = n % g.W, j = (n - i) / g.W, hn = g.elev[n];
    const hh = Math.hypot(gi - i, gj - j);
    if (hh < bestH) { bestH = hh; best = n; }
    for (const [di, dj, dd] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.W || nj >= g.H) continue;
      const m = nj * g.W + ni;
      if (closed[m] || (c.blocked && c.blocked[m] && m !== t)) continue;
      const hm = g.elev[m];
      if (!(hm === hm)) continue; // NaN: no terrain data
      const grade = Math.abs(hm - hn) / (dd * stepM);
      if (grade > tanCap) continue;
      if (di && dj) {
        // Diagonal: the interpolated surface (see nodeElev) passes the mean of all four nodes halfway,
        // so check both halves too, or the drawn profile could exceed the cap.
        const mid = (hn + hm + g.elev[j * g.W + ni] + g.elev[nj * g.W + i]) / 4, half = (dd * stepM) / 2;
        if (!(Math.abs(mid - hn) <= tanCap * half && Math.abs(hm - mid) <= tanCap * half)) continue;
      }
      let k = dd * (1 + 3 * (grade / tanCap) ** 2);
      if (g.rough[m] > c.cap) k *= ROUGH_FACTOR;
      if (c.dust) {
        const p = nodePt(g, m);
        k *= DUST_FACTOR[c.dust[Math.floor(p.y) * GRID.W + Math.floor(p.x)]] ?? 1;
      }
      const nc = cost[n] + k;
      if (nc < cost[m]) {
        cost[m] = nc; prev[m] = n;
        heap.push(nc + Math.hypot(gi - ni, gj - nj), m);
      }
    }
  }
  const ok = closed[t] === 1;
  const pts: Pt[] = [];
  for (let n = ok ? t : best; n !== -1; n = prev[n]) pts.push(nodePt(g, n));
  pts.reverse();
  return { ok, pts, visited };
}

/** Node mask of the cells inside any of the zones (×1.06), skipping zones that contain a route point. */
export function blockedMask(g: RouteGrid, zones: Zone[], keepOpen: Pt[]): Uint8Array | null {
  const active = zones.filter(z => !keepOpen.some(p => inside(p, z)));
  if (!active.length) return null;
  const m = new Uint8Array(g.W * g.H);
  for (const z of active) {
    const R = Math.max(z.rx, z.ry) * 1.06;
    const i0 = Math.max(0, Math.floor((z.x - R) / NODE)), i1 = Math.min(g.W - 1, Math.ceil((z.x + R) / NODE));
    const j0 = Math.max(0, Math.floor((z.y - R) / NODE)), j1 = Math.min(g.H - 1, Math.ceil((z.y + R) / NODE));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (inside({ x: (i + 0.5) * NODE, y: (j + 0.5) * NODE }, z, 1.06)) m[j * g.W + i] = 1;
    }
  }
  return m;
}

/** Can the rover drive straight from a to b under the cap, avoiding blocked nodes? */
function segOk(g: RouteGrid, a: Pt, b: Pt, c: Costs): boolean {
  const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / NODE));
  const tanCap = Math.tan((c.cap * Math.PI) / 180);
  let prevH = nodeElev(g, a);
  for (let k = 1; k <= n; k++) {
    const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
    const m = nodeOf(g, p);
    if (c.blocked && c.blocked[m]) return false;
    const h = nodeElev(g, p);
    if (!(h === h)) return false;
    if (Math.abs(h - prevH) / ((L / n) * M_PER_PX) > tanCap) return false;
    if (g.rough[m] > c.cap) return false; // smoothing must not cut across ground A* treated as rough
    prevH = h;
  }
  return true;
}

/** Line-of-sight smoothing: from each kept point, jump to the farthest later point reachable in a straight line. */
function smooth(g: RouteGrid, pts: Pt[], c: Costs): Pt[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 60);
    while (j > i + 1 && !segOk(g, pts[i], pts[j], c)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

// --- profile and the whole route ---

export interface Profile {
  samples: { x: number; y: number; d: number; h: number; t: number }[]; // d: world px along the route; t: drive minutes to here
  px: number; // length, world px
  min: number; // drive time at speed-by-grade, minutes
  maxGrade: number; // degrees, over NODE-length steps
  asc: number; desc: number; // m
  steep: [Pt, Pt][]; // pieces steeper than 12°
}

/**
 * Elevation along the route every NODE world px, with grades, drive time and climb. Elevations are the
 * routing nodes' (200 m means), so grades are measured exactly as the planner limited them.
 */
export function profile(g: RouteGrid, pts: Pt[]): Profile {
  const hAt = (p: Pt) => nodeElev(g, p);
  const samples: Profile["samples"] = [];
  let px = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / NODE));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
      samples.push({ ...p, d: px + (L * k) / n, h: hAt(p), t: 0 });
    }
    px += L;
  }
  if (!samples.length) {
    const p = pts[0] ?? { x: 0, y: 0 };
    samples.push({ ...p, d: 0, h: hAt(p), t: 0 });
  }
  let min = 0, maxGrade = 0, asc = 0, desc = 0;
  const steep: [Pt, Pt][] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], dd = b.d - a.d || 1e-6;
    const dh = (b.h === b.h ? b.h : a.h) - (a.h === a.h ? a.h : b.h) || 0;
    const gr = (Math.atan(Math.abs(dh) / (dd * M_PER_PX)) * 180) / Math.PI;
    if (dh > 0) asc += dh; else desc -= dh;
    if (gr > maxGrade) maxGrade = gr;
    min += (pxToKm(dd) / speedFor(gr)) * 60;
    b.t = min;
    if (gr > 12) steep.push([a, b]);
  }
  return { samples, px, min, maxGrade, asc, desc, steep };
}

export interface Route extends Profile {
  pts: Pt[];
  legEnds: number[]; // index into pts where each leg ends (legEnds[0] = 0)
  ok: boolean; // every leg reached its stop
  reached: Pt | null; // where the first unreachable leg got to
  cross: string[]; // ids of enabled hazard zones the route passes through
  cap: number;
}

/**
 * Route through `points` (rover first). `zones` are the enabled hazard zones: blocked when `safe`,
 * and always checked for crossings.
 */
export function buildRoute(g: RouteGrid, points: Pt[], o: { cap: number; safe: boolean; zones: Zone[]; dust: Uint8Array | null }): Route {
  const c: Costs = {
    cap: o.cap,
    blocked: o.safe ? blockedMask(g, o.zones, points) : null,
    dust: o.safe ? o.dust : null,
  };
  const pts: Pt[] = [points[0]], legEnds = [0], cross = new Set<string>();
  let ok = true, reached: Pt | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = pts[pts.length - 1];
    const r = astar(g, a, points[i], c);
    let seg = smooth(g, r.pts, c).slice(1);
    if (r.ok) {
      if (seg.length) seg[seg.length - 1] = points[i];
      else seg = [points[i]];
    } else {
      ok = false;
      if (!seg.length) seg = [a];
      reached = reached ?? seg[seg.length - 1];
    }
    let prev = a;
    for (const p of seg) {
      for (const z of o.zones) {
        if (!cross.has(z.id) && !inside(points[i], z) && !inside(points[0], z) && segHit(prev, p, z)) cross.add(z.id);
      }
      prev = p;
    }
    pts.push(...seg);
    legEnds.push(pts.length - 1);
  }
  return { ...profile(g, pts), pts, legEnds, ok, reached, cross: [...cross], cap: o.cap };
}

/** Cumulative length (world px) at each point. */
export function cumul(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return c;
}

/** Point (and heading, ° clockwise from north) at distance d along pts. */
export function posAt(pts: Pt[], cum: number[], d: number): Pt & { h: number | null } {
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  if (i >= cum.length) { const e = pts[pts.length - 1]; return { x: e.x, y: e.y, h: null }; }
  const a = pts[i - 1], b = pts[i], t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI };
}

/** Point halfway along pts. */
export function midOf(pts: Pt[]): Pt {
  if (!pts.length) return { x: 0, y: 0 };
  const c = cumul(pts);
  return posAt(pts, c, c[c.length - 1] / 2);
}

/** Drive minutes from the start of the profile to distance d (world px). */
export function timeAt(samples: Profile["samples"], d: number): number {
  if (!samples.length) return 0;
  let lo = 0, hi = samples.length - 1;
  if (d <= samples[0].d) return samples[0].t;
  if (d >= samples[hi].d) return samples[hi].t;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (samples[m].d < d) lo = m; else hi = m; }
  const a = samples[lo], b = samples[hi], f = (d - a.d) / (b.d - a.d || 1);
  return a.t + (b.t - a.t) * f;
}
