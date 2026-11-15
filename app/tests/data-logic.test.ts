// Plain data logic: landmarks, search, coordinate queries and dust opacity τ.
import { describe, expect, it } from "vitest";
import { GRID, inWorld, toLonLat, toWorld } from "../src/map/geo";
import { LANDMARKS } from "../src/map/landmarks";
import { HAZARD_ZONES } from "../src/map/hazards";
import { MAX_QUERY, matches, parseCoords, results } from "../src/home/search";
import { tauForSol, tauLevel } from "../src/home/tau";
import type { TauTable } from "../src/map/data";

describe("landmarks", () => {
  it("has 19 landmarks with unique ids, all on the map", () => {
    expect(LANDMARKS).toHaveLength(19);
    expect(new Set(LANDMARKS.map(l => l.id)).size).toBe(19);
    for (const l of LANDMARKS) expect(inWorld(l), l.id).toBe(true);
  });

  it("places the PDS-located sites on the rover's recorded positions", () => {
    // PDS msl_places localized_pos.csv: Rocknest (site 5, sol 59), John Klein (site 6, sols 166-270).
    const at = (id: string) => LANDMARKS.find(l => l.id === id)!;
    expect(at("rocknest").lat).toBeCloseTo(-4.59, 4);
    expect(at("rocknest").lon).toBeCloseTo(137.44834, 4);
    expect(at("yellowknife").lat).toBeCloseTo(-4.58948, 4);
    expect(at("yellowknife").lon).toBeCloseTo(137.44913, 4);
    expect(at("bradbury").lat).toBeCloseTo(-4.5895, 3);
  });

  it("round-trips world and lon/lat coordinates", () => {
    for (const l of LANDMARKS) {
      const ll = toLonLat(l);
      expect(ll.lon).toBeCloseTo(l.lon, 9);
      expect(ll.lat).toBeCloseTo(l.lat, 9);
    }
  });

  it("keeps hazard zones on the map", () => {
    for (const z of HAZARD_ZONES) expect(inWorld(z), z.id).toBe(true);
  });
});

describe("search", () => {
  const rover = toWorld({ lon: 137.4417, lat: -4.5895 });

  it("matches name, category and description, case-insensitively", () => {
    const rock = LANDMARKS.find(l => l.id === "rocknest")!;
    expect(matches(rock, "ROCK", "All")).toBe(true);
    expect(matches(rock, "geolog", "All")).toBe(true);
    expect(matches(rock, "scoop", "All")).toBe(true);
    expect(matches(rock, "rock", "Habitats")).toBe(false);
    expect(matches(rock, "  ", "All")).toBe(true);
  });

  it("orders results nearest first and filters by category", () => {
    const all = results("", "All", rover);
    expect(all).toHaveLength(19);
    const d = all.map(l => Math.hypot(l.x - rover.x, l.y - rover.y));
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(results("", "Relays", rover).every(l => l.cat === "Relays")).toBe(true);
    expect(results("no such place", "All", rover)).toEqual([]);
  });

  it("parses coordinate queries in the accepted forms", () => {
    for (const q of ["4.59S 137.44E", "4.59°S, 137.44°E", "-4.59 137.44", " -4.59, 137.44 "]) {
      const p = parseCoords(q);
      expect(p, q).not.toBeNull();
      const ll = toLonLat(p!);
      expect(ll.lat).toBeCloseTo(-4.59, 6);
      expect(ll.lon).toBeCloseTo(137.44, 6);
    }
  });

  it("rejects coordinates off the map and anything that isn't a coordinate", () => {
    for (const q of ["0 0", "4.59N 137.44E", "-4.59 10", "hello", "4.59S", "", "1e3 137", "-4.59 137.44 extra"]) {
      expect(parseCoords(q), q).toBeNull();
    }
    expect(parseCoords("9".repeat(MAX_QUERY * 4))).toBeNull();
  });

  it("only returns points inside the grid", () => {
    const p = parseCoords(`${-GRID.LAT0 + 0.0001}S ${GRID.LON0 + 0.0001}E`);
    expect(p && inWorld(p)).toBe(true);
  });
});

describe("dust opacity τ", () => {
  const table: TauTable = { sol: [100, 104, 200], tau: [0.4, 0.8, 1.2], ls: [10, 12, 60], band: "880", max_gap_sols: 5, source: "test" };

  it("uses a measurement on the sol itself", () => {
    expect(tauForSol(table, 104)).toEqual({ tau: 0.8, ls: 12, source: "Mastcam, sol 104" });
  });

  it("interpolates between measurements within the gap limit", () => {
    const t = tauForSol(table, 102)!;
    expect(t.tau).toBeCloseTo(0.6, 9);
    expect(t.ls).toBeCloseTo(11, 9);
    expect(t.source).toBe("Mastcam, interpolated sols 100–104");
  });

  it("falls back to the nearest measured sol beyond the gap limit", () => {
    expect(tauForSol(table, 150)!.source).toBe("Mastcam, nearest sol 104");
    expect(tauForSol(table, 180)!.source).toBe("Mastcam, nearest sol 200");
    expect(tauForSol(table, 5)!.source).toBe("Mastcam, nearest sol 100");
    expect(tauForSol(table, 999)!.source).toBe("Mastcam, nearest sol 200");
    expect(tauForSol({ ...table, sol: [], tau: [], ls: [] }, 1)).toBeNull();
  });

  it("names the opacity level", () => {
    expect([0.3, 0.59, 0.6, 0.99, 1, 1.99, 2, 8.6].map(tauLevel)).toEqual(["LOW", "LOW", "MODERATE", "MODERATE", "HIGH", "HIGH", "STORM", "STORM"]);
  });
});
