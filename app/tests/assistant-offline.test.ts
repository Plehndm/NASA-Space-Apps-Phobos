// The offline route assistant (src/assistant/scripted.ts) and the sector snapshot it shares with the
// live model (src/assistant/context.ts), against a fake route planner with straight-line routes.
import { describe, expect, it } from "vitest";
import { LANDMARKS, type Landmark } from "../src/map/landmarks";
import { HAZARD_ZONES } from "../src/map/hazards";
import { distanceM, toWorld, type Pt } from "../src/map/geo";
import { inside, type Route, type Zone } from "../src/route/router";
import type { RouteApi } from "../src/route/RouteProvider";
import type { AppState } from "../src/state/store";
import { mentioned, scripted } from "../src/assistant/scripted";
import { buildContext, type Sources } from "../src/assistant/context";
import { ASSISTANT_Q } from "../src/state/scenes";

const rover = { ...toWorld({ lon: 137.4417, lat: -4.5895 }), h: 35 };
const lm = (id: string | null | undefined) => LANDMARKS.find(l => l.id === id) ?? null;

function straight(points: Pt[], ok = true, cross: string[] = []): Route {
  let px = 0;
  for (let i = 1; i < points.length; i++) px += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const km = (px * 100) / 1000;
  return { pts: points, legEnds: points.map((_, i) => i), ok, reached: ok ? null : points[0], cross, cap: 18, samples: [], px, min: (km / 8) * 60, maxGrade: 3, asc: 0, desc: 0, steep: [] };
}

/** A planner whose routes are straight lines; `opts` lets a test block, fail or cross zones. */
function fakeRoutes(opts: { zones?: Zone[]; ready?: boolean; safeOk?: boolean; directCross?: string[] } = {}): RouteApi {
  const zones = opts.zones ?? HAZARD_ZONES;
  const api: Partial<RouteApi> = {
    ready: opts.ready ?? true,
    lm,
    zones: zones as RouteApi["zones"],
    capSafe: 18,
    capDirect: 25,
    blockedBy: (p: Pt) => (zones.find(z => inside(p, z)) ?? null) as ReturnType<RouteApi["blockedBy"]>,
    routeOpts: (ids: string[]) => {
      const pts = [rover, ...ids.map(id => lm(id)!)];
      return { direct: straight(pts, true, opts.directCross ?? []), safe: straight(pts, opts.safeOk ?? true) };
    },
    elevOf: () => -4500,
    slopeOf: () => 2,
  };
  return api as RouteApi;
}

const state = (over: Partial<AppState> = {}) => ({
  rover, extraLm: [] as Landmark[], elev: 0, heat: "off", hazOn: true, stops: [] as string[], nav: null,
  hazTypes: { weather: true, steep: true, rough: true, radiation: true, sand: true }, ...over,
}) as unknown as AppState;

const sources = (over: Partial<Sources> = {}): Sources => ({
  S: state(),
  r: fakeRoutes(),
  tele: { tempK: 206, tempSub: "Ls 195° · 23:30", tau: { tau: 0.78, ls: 195, source: "test" }, slope: 2 },
  adv: { sol: 1850, tau: 0.44, here: 1, high: { p: rover, km: 6.2, dir: "NNE" } },
  clock: "14:32",
  ...over,
});

describe("mentioned", () => {
  it("finds landmarks in the order they are named", () => {
    expect(mentioned("safest route to murray buttes then hematite", LANDMARKS).map(l => l.id)).toEqual(["murray", "hematite"]);
    expect(mentioned("go to T-4", LANDMARKS).map(l => l.id)).toEqual(["t4"]);
  });

  it("ignores generic words on their own", () => {
    expect(mentioned("the checkpoint by the crater on the rim", LANDMARKS)).toEqual([]);
    expect(mentioned("", LANDMARKS)).toEqual([]);
  });
});

describe("scripted answers", () => {
  it("plans a route to a named landmark", () => {
    const a = scripted("Safest route to Murray Buttes", sources());
    expect(a.route).toEqual(["murray"]);
    expect(a.reply).toMatch(/^Route to Murray Buttes on the safe track: \d+\.\d km/);
  });

  it("leaves out a landmark inside an enabled hazard zone", () => {
    const m = lm("murray")!;
    const zone: Zone = { id: "rough", name: "Rough terrain", detail: "test", x: m.x, y: m.y, rx: 5, ry: 5, rot: 0 };
    const a = scripted("route to murray buttes", sources({ r: fakeRoutes({ zones: [zone] }) }));
    expect(a.route).toEqual([]);
    expect(a.reply).toContain("inside the rough terrain zone");
  });

  it("describes the hazards between here and a named place", () => {
    const a = scripted("What hazards are between here and Pahrump Hills?", sources({ r: fakeRoutes({ directCross: ["sand"] }) }));
    expect(a.reply).toMatch(/^Between here and Pahrump Hills: The direct line crosses low thermal inertia/);
    expect(a.route).toEqual(["pahrump"]);
    expect(a.avoid).toEqual(["sand"]);
  });

  it("gives the nearest threat for a general hazard question", () => {
    const a = scripted("any hazards nearby?", sources());
    expect(a.reply).toMatch(/^Nearest threat is /);
    expect(a.route).toEqual([]);
  });

  it("says so when every hazard filter is off", () => {
    const off = state({ hazTypes: { weather: false, steep: false, rough: false, radiation: false, sand: false } as AppState["hazTypes"] });
    const a = scripted("any danger here?", sources({ S: off }));
    expect(a.reply).toContain("Every hazard filter is off");
  });

  it("plans a three-stop science day from reachable science sites", () => {
    const a = scripted("plan a science day", sources());
    expect(a.route).toHaveLength(3);
    for (const id of a.route) expect(["Geological", "Water-Ice"]).toContain(lm(id)!.cat);
    expect(a.reply).toMatch(/^A 3-stop science loop on the safe track/);
    expect(a.reply).toContain("75 min of stops");
  });

  it("plans the science day the assistant demo scene asks for", () => {
    const a = scripted(ASSISTANT_Q, sources());
    expect(a.route).toHaveLength(3);
    expect(a.reply).toMatch(/^A 3-stop science loop on the safe track/);
  });

  it("reports the weather from telemetry", () => {
    const a = scripted("how cold is it and what is the dust like", sources());
    expect(a.reply).toContain("-67°C");
    expect(a.reply).toContain("τ 0.78 is moderate");
    expect(a.route).toEqual([]);
  });

  it("falls back to help for anything else", () => {
    const a = scripted("write me a poem about cats", sources());
    expect(a.reply).toMatch(/^I can plan a traverse/);
    expect(a.route).toEqual([]);
  });

  it("waits for the terrain before planning", () => {
    const a = scripted("plan a science day", sources({ r: fakeRoutes({ ready: false }) }));
    expect(a.reply).toContain("terrain is still loading");
    expect(a.route).toEqual([]);
  });

  it("offers the direct route when there is no safe one", () => {
    const a = scripted("route to glen torridon", sources({ r: fakeRoutes({ safeOk: false }) }));
    expect(a.reply).toMatch(/^There is no safe track to Glen Torridon under the 18° limit\. The direct route works/);
    expect(a.route).toEqual(["glen"]);
  });
});

describe("the wider range of offline questions", () => {
  // [question, start of the reply (or a part of it), the route it proposes]
  const cases: [string, RegExp, string[]][] = [
    ["hi", /^I'm the route assistant/, []],
    ["what can you do?", /^I'm the route assistant/, []],
    ["thanks!", /^Anytime/, []],
    ["where am I?", /^The rover is at 4\.59°S 137\.44°E, at Bradbury Landing/, []],
    ["give me a sitrep", /^Sol 742, 14:32 MTC\. Rover at Bradbury Landing\. Ground -67°C, dust τ 0\.78/, []],
    ["nearest water ice", /^Nearest water-ice site is Yellowknife Bay/, ["yellowknife"]],
    ["find a relay for comms", /^Nearest relay mast is Relay Mast R-1/, ["relay1"]],
    ["closest landing pad", /^Nearest landing pad is LZ-2 Aeolis Palus/, ["lz2"]],
    ["take me home", /^Heading back to Habitat Alpha/, ["habitat"]],
    ["emergency, we need to evacuate", /^Nearest pickup point is LZ-3 Emergency Pad/, ["lz3"]],
    ["what's nearby?", /^Closest to the rover: The Rocknest/, []],
    ["any radiation around?", /^Radiation: \d+\.\d km from the rover/, []],
    ["are there sand traps?", /^Low thermal inertia: \d+\.\d km from the rover/, []],
    ["how steep is it here?", /^Ground under the rover slopes 2°/, []],
    ["what is Yellowknife Bay?", /^Yellowknife Bay \(water-ice, visited by Curiosity\): Ancient lakebed/, ["yellowknife"]],
    ["how far is Murray Buttes?", /^Murray Buttes is \d+\.\d km from the rover.*On foot at 4 km\/h/, ["murray"]],
    ["what's the elevation of Peace Vallis Fan", /^Peace Vallis Fan sits at −4,500 m/, []],
    ["how steep is Glen Torridon", /^Ground slope at Glen Torridon is 2°/, ["glen"]],
    ["how fast can the rover go?", /^The rover drives up to 8 km\/h/, []],
    ["is there a dust storm coming?", /Dust opacity τ 0\.78 is moderate/, []],
    ["what sol is it", /^It's sol 742, 14:32/, []],
    ["what do the map layers show?", /^Map layers: elevation strata off/, []],
  ];
  for (const [q, re, route] of cases) {
    it(`answers “${q}”`, () => {
      const a = scripted(q, sources());
      expect(a.reply).toMatch(re);
      expect(a.route).toEqual(route);
    });
  }
});

describe("the sector snapshot", () => {
  const ctx = buildContext(sources());

  it("lists every landmark and hazard with its status", () => {
    expect(ctx.landmarks).toHaveLength(19);
    expect(ctx.hazards.map(h => h.id).sort()).toEqual(["dust", "radiation", "rough", "sand", "steep"]);
    expect(ctx.landmarks.find(l => l.id === "bradbury")!.status).toBe("the rover is here");
    expect(ctx.landmarks.find(l => l.id === "murray")!.status).toMatch(/^reachable, safe route/);
  });

  it("carries telemetry and limits in plain numbers", () => {
    expect(ctx.telemetry.surfaceC).toBe(-67);
    expect(ctx.telemetry.tauLevel).toBe("MODERATE");
    expect(ctx.capSafe).toBe(18);
    expect(ctx.sol).toBe(742);
    const km = ctx.landmarks.find(l => l.id === "habitat")!.km;
    expect(km).toBeCloseTo(distanceM(rover, lm("habitat")!) / 1000, 1);
  });
});
