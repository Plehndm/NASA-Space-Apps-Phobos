// The route planner (src/route/router.ts) on synthetic terrain, and, when app/data/ has been built,
// on the real Gale terrain: every landmark reachable within the grade limits.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GRID } from "../src/map/geo";
import { LANDMARKS } from "../src/map/landmarks";
import { HAZARD_ZONES } from "../src/map/hazards";
import { buildRoute, CAP_DIRECT, inside, makeGrid, pxToKm, type TerrainArrays, type Zone } from "../src/route/router";

const N = GRID.W * GRID.H;
const flat = (): TerrainArrays => ({ elev: new Int16Array(N), elevNodata: -32768, slopeQ3: null, slopeScale: 0.25 });

/** A 3000 m wall along x = 700..704, open only for y in [gapFrom, gapTo). */
function walled(gapFrom: number, gapTo: number): TerrainArrays {
  const t = flat();
  for (let y = 0; y < GRID.H; y++) {
    if (y >= gapFrom && y < gapTo) continue;
    for (let x = 700; x < 705; x++) t.elev[y * GRID.W + x] = 3000;
  }
  return t;
}

describe("router on synthetic terrain", () => {
  const plain = makeGrid(flat());

  it("goes straight across flat ground", () => {
    const r = buildRoute(plain, [{ x: 600, y: 300 }, { x: 800, y: 300 }], { cap: 18, safe: false, zones: [], dust: null });
    expect(r.ok).toBe(true);
    expect(r.maxGrade).toBeLessThan(0.5);
    expect(r.px).toBeGreaterThan(199);
    expect(r.px).toBeLessThan(205); // straight line is 200 px (20 km)
    expect(r.pts[0]).toEqual({ x: 600, y: 300 });
    expect(r.pts[r.pts.length - 1]).toEqual({ x: 800, y: 300 });
    expect(pxToKm(r.px)).toBeCloseTo(20, 0);
  });

  it("detours through the only gap in a wall, within the grade limit", () => {
    const g = makeGrid(walled(900, 920));
    const r = buildRoute(g, [{ x: 650, y: 300 }, { x: 750, y: 300 }], { cap: 18, safe: false, zones: [], dust: null });
    expect(r.ok).toBe(true);
    expect(r.maxGrade).toBeLessThanOrEqual(18);
    expect(r.px).toBeGreaterThan(1000); // down to y≈910 and back: far longer than the 100 px straight line
    // Smoothing leaves no point inside the 5 px wall, so check where the path crosses its middle line.
    const crossings: number[] = [];
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      if ((a.x - 702) * (b.x - 702) <= 0 && a.x !== b.x) crossings.push(a.y + ((702 - a.x) / (b.x - a.x)) * (b.y - a.y));
    }
    expect(crossings.length).toBeGreaterThan(0);
    expect(crossings.every(y => y >= 899 && y <= 921)).toBe(true);
  });

  it("reports an unreachable target and where it got to", () => {
    const g = makeGrid(walled(-1, -1)); // no gap
    const r = buildRoute(g, [{ x: 650, y: 300 }, { x: 750, y: 300 }], { cap: 18, safe: false, zones: [], dust: null });
    expect(r.ok).toBe(false);
    expect(r.reached).not.toBeNull();
    expect(r.reached!.x).toBeLessThan(700);
  });

  it("keeps a safe route out of a hazard zone that the direct route crosses", () => {
    const zone: Zone = { id: "z", name: "Zone", detail: "", x: 700, y: 300, rx: 20, ry: 20, rot: 0 };
    const a = { x: 600, y: 300 }, b = { x: 800, y: 300 };
    const direct = buildRoute(plain, [a, b], { cap: 18, safe: false, zones: [zone], dust: null });
    const safe = buildRoute(plain, [a, b], { cap: 18, safe: true, zones: [zone], dust: null });
    expect(direct.cross).toContain("z");
    expect(safe.ok).toBe(true);
    expect(safe.cross).not.toContain("z");
    expect(safe.pts.every(p => !inside(p, zone))).toBe(true);
    expect(safe.px).toBeGreaterThan(direct.px);
  });

  it("returns one leg per stop", () => {
    const r = buildRoute(plain, [{ x: 600, y: 300 }, { x: 650, y: 300 }, { x: 650, y: 350 }], { cap: 18, safe: false, zones: [], dust: null });
    expect(r.ok).toBe(true);
    expect(r.legEnds).toHaveLength(3);
    expect(r.pts[r.legEnds[1]]).toEqual({ x: 650, y: 300 });
  });
});

// --- real terrain (skipped until the map data is built) ---

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const hasData = existsSync(`${dataDir}terrain.bin`) && existsSync(`${dataDir}manifest.json`);

describe.skipIf(!hasData)("router on the real Gale terrain", () => {
  if (!hasData) return; // skipIf still runs this body while collecting tests
  const load = (): TerrainArrays => {
    const m = JSON.parse(readFileSync(`${dataDir}manifest.json`, "utf8"));
    const buf = readFileSync(`${dataDir}terrain.bin`);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return {
      elev: new Int16Array(ab, 0, N), elevNodata: m.terrain.elev.nodata,
      slopeQ3: m.terrain.slope_q3 ? new Uint8Array(ab, N * 3, N) : null, slopeScale: m.terrain.slope.scale_deg,
    };
  };
  const g = makeGrid(load());
  const rover = LANDMARKS.find(l => l.id === "bradbury")!;

  it.each(LANDMARKS.filter(l => l.id !== "bradbury").map(l => [l.name, l] as const))("plans a route to %s within the grade limits", (_, l) => {
    const direct = buildRoute(g, [rover, l], { cap: CAP_DIRECT, safe: false, zones: [], dust: null });
    expect(direct.ok).toBe(true);
    expect(direct.maxGrade).toBeLessThanOrEqual(CAP_DIRECT + 0.5);
    const safe = buildRoute(g, [rover, l], { cap: 18, safe: true, zones: HAZARD_ZONES.filter(z => !inside(l, z)), dust: null });
    if (safe.ok) expect(safe.maxGrade).toBeLessThanOrEqual(18.5);
  });
});
