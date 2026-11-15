// Street Level panoramas (src/street/panos.ts): checking panos.json, the looping strip, and which
// panorama a waypoint opens. Also checks the built app/data/panos/panos.json when it exists.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LANDMARKS } from "../src/map/landmarks";
import { toWorld } from "../src/map/geo";
import {
  azToStrip, bearing, diff180, imageryBand, nearestCopy, norm360, panoNear, parsePanos, stripSpan, stripToAz, tileUri,
} from "../src/street/panos";

const pano = (id: string, extra: Record<string, unknown> = {}) => ({
  id, title: id.toUpperCase(), lat: -4.59, lon: 137.448, world_w: 8192, max_zoom: 4, heading: 90, pitch: -10,
  hfov: 171, vfov: 37.5, sol: 70, camera: "Mastcam", source: "https://example.org/x", links: [], ...extra,
});

describe("parsePanos", () => {
  it("accepts a well-formed file", () => {
    const p = parsePanos({ tile: 512, credit: "NASA", panos: { a: pano("a", { links: [{ pano: "b", heading: 270, distance_m: 21, description: "B" }] }), b: pano("b") } })!;
    expect(p.list.map(x => x.id)).toEqual(["a", "b"]);
    expect(p.byId.a.links).toEqual([{ pano: "b", heading: 270, distance_m: 21, description: "B" }]);
    expect(p.byId.a.x).toBeCloseTo(toWorld({ lon: 137.448, lat: -4.59 }).x, 9);
  });

  it("drops entries that could reach outside the tile folder or carry bad numbers", () => {
    const p = parsePanos({
      tile: 512,
      panos: {
        a: pano("../../etc"), b: pano("ok_one"), c: pano("x", { lat: 999 }), d: pano("y", { world_w: "big" }),
        e: pano("z", { max_zoom: 2.5 }), f: pano("UPPER"), g: pano("w", { heading: Number.NaN }),
      },
    })!;
    expect(p.list.map(x => x.id)).toEqual(["ok_one"]);
  });

  it("keeps links only between panoramas it knows, never to itself", () => {
    const p = parsePanos({ tile: 512, panos: { a: pano("a", { links: [
      { pano: "b", heading: 10, distance_m: 5 }, { pano: "nowhere", heading: 10, distance_m: 5 },
      { pano: "a", heading: 10, distance_m: 5 }, { pano: "../b", heading: 10, distance_m: 5 }, { pano: "b", heading: "x", distance_m: 5 },
    ] }), b: pano("b") } })!;
    expect(p.byId.a.links.map(l => l.pano)).toEqual(["b"]);
  });

  it("rejects non-https sources and anything that isn't the expected shape", () => {
    const p = parsePanos({ tile: 512, panos: { a: pano("a", { source: "javascript:alert(1)" }) } })!;
    expect(p.byId.a.source).toBe("");
    for (const bad of [null, 42, "x", { tile: 512 }, { tile: 5, panos: {} }, { tile: 512, panos: {} }]) expect(parsePanos(bad)).toBeNull();
  });

  it("builds tile URLs under /mapdata/panos/", () => {
    expect(tileUri("rocknest_mastcam", 4, 3, 2)).toBe("http://localhost:8081/mapdata/panos/rocknest_mastcam/4_3_2.jpg");
  });
});

describe("the imagery strip", () => {
  const partial = parsePanos({ tile: 512, panos: { r: pano("r") } })!.byId.r; // 171° centred east
  const full = parsePanos({ tile: 512, panos: { f: pano("f", { hfov: 360, heading: 180 }) } })!.byId.f;

  it("maps strip positions to true bearings and back", () => {
    expect(stripSpan(partial)).toBe(171);
    expect(stripToAz(partial, 0)).toBeCloseTo(4.5, 9); // left edge: 90 - 171/2
    expect(stripToAz(partial, 85.5)).toBeCloseTo(90, 9);
    for (const az of [5, 47.3, 90, 175]) expect(stripToAz(partial, azToStrip(partial, az)!)).toBeCloseTo(az, 9);
  });

  it("repeats a partial strip end to end", () => {
    expect(stripToAz(partial, 171 + 10)).toBeCloseTo(stripToAz(partial, 10), 9);
    expect(stripToAz(partial, -171 + 10)).toBeCloseTo(stripToAz(partial, 10), 9);
  });

  it("knows which bearings have no imagery", () => {
    expect(azToStrip(partial, 274.5)).toBeNull(); // Bradbury seen from Rocknest
    expect(azToStrip(partial, 0)).toBeNull();
    for (const az of [0, 90, 359.9]) expect(azToStrip(full, az)).not.toBeNull();
  });

  it("turns toward the nearest copy of a bearing", () => {
    const u0 = azToStrip(partial, 80)!;
    expect(nearestCopy(partial, u0, 1000)).toBeCloseTo(u0 + Math.round((1000 - u0) / 171) * 171, 9);
    expect(Math.abs(nearestCopy(partial, u0, 1000) - 1000)).toBeLessThanOrEqual(171 / 2);
  });

  it("trims the imagery band and keeps it on the sphere", () => {
    const b = imageryBand(partial);
    expect(b.top).toBeCloseTo(-10 + 37.5 / 2 - 37.5 * 0.08, 9);
    expect(b.bottom).toBeCloseTo(-10 - 37.5 / 2 + 37.5 * 0.08, 9);
    const tall = parsePanos({ tile: 512, panos: { t: pano("t", { vfov: 180, pitch: 30 }) } })!.byId.t;
    expect(imageryBand(tall).top).toBeLessThanOrEqual(90);
  });

  it("has angle helpers that wrap correctly", () => {
    expect(norm360(-30)).toBe(330);
    expect(norm360(720)).toBe(0);
    expect(diff180(10, 350)).toBe(20);
    expect(diff180(350, 10)).toBe(-20);
    expect(bearing({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(0, 9); // north is -y
    expect(bearing({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90, 9);
  });
});

describe("which panorama a waypoint opens", () => {
  const at = (id: string) => LANDMARKS.find(l => l.id === id)!;
  const panos = parsePanos({
    tile: 512,
    panos: {
      near: pano("near", { lat: at("rocknest").lat, lon: at("rocknest").lon + 0.003 }),
      own: pano("own", { lat: at("rocknest").lat + 0.004, lon: at("rocknest").lon, waypoint: "rocknest" }),
      far: pano("far", { lat: -4.80655, lon: 137.37932, waypoint: "peace" }),
    },
  })!;

  it("prefers the panorama the manifest assigns to the waypoint", () => {
    expect(panoNear(panos, at("rocknest"))!.pano.id).toBe("own");
  });

  it("uses an assigned panorama at any distance", () => {
    const hit = panoNear(panos, at("peace"))!;
    expect(hit.pano.id).toBe("far");
    expect(hit.km).toBeGreaterThan(3);
  });

  it("otherwise picks the nearest within the radius, or none", () => {
    expect(panoNear(panos, { ...at("yellowknife"), id: undefined })!.pano.id).toBe("near");
    expect(panoNear(panos, at("lz3"))).toBeNull();
    expect(panoNear(undefined, at("rocknest"))).toBeNull();
  });
});

const built = fileURLToPath(new URL("../data/panos/panos.json", import.meta.url));
const hasBuilt = existsSync(built);
describe.skipIf(!hasBuilt)("the built panos.json", () => {
  if (!hasBuilt) return; // skipIf still runs this body while collecting tests
  const raw = JSON.parse(readFileSync(built, "utf8"));
  const p = parsePanos(raw)!;

  it("passes the app's checks with nothing dropped", () => {
    expect(p).not.toBeNull();
    expect(p.list.length).toBe(Object.keys(raw.panos).length);
  });

  it("links the landing-site panoramas both ways and gives every waypoint a real landmark", () => {
    for (const a of p.list) for (const l of a.links) expect(p.byId[l.pano].links.some(b => b.pano === a.id)).toBe(true);
    for (const a of p.list) if (a.waypoint) expect(LANDMARKS.some(l => l.id === a.waypoint), a.id).toBe(true);
  });

  it("opens each assigned waypoint on its own panorama", () => {
    for (const a of p.list) if (a.waypoint) expect(panoNear(p, LANDMARKS.find(l => l.id === a.waypoint)!)!.pano.id).toBe(a.id);
  });
});
