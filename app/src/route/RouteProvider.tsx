// Routing and the expedition simulation, shared by the map and the route cards.
//
// Routes come from router.ts on the real terrain. They are built during render and cached by
// (points, safe, caps, hazard filters, dust sol); a route around the crater takes ~25–100 ms in Node.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "../state/store";
import { useMapData, loadDustLevels, terrainAt } from "../map/data";
import { distanceM, fmtLatLon, M_PER_PX, type Pt } from "../map/geo";
import { HAZARD_ZONES, type HazardZone } from "../map/hazards";
import { LANDMARKS, type Landmark } from "../map/landmarks";
import { mtcSeconds } from "../state/clock";
import { buildRoute, CAP_DIRECT, CAP_OVERRIDE, cumul, edgeDist, inside, makeGrid, nodeElev, posAt, profile, pxToKm, segHit, speedFor, type Profile, type Route, type RouteGrid } from "./router";
import { fmtKm, fmtMin } from "./format";
import type { Nav } from "./types";

const TICK_MS = 100; // the design's simulation step

export interface RouteOptions { direct: Route; safe: Route }

export interface RouteApi {
  ready: boolean; // terrain loaded and the routing grid built
  lm: (id: string | null | undefined) => Landmark | null;
  zones: HazardZone[]; // hazard zones whose filter chip is on
  capSafe: number;
  capDirect: number;
  routeOpts: (ids: string[]) => RouteOptions | null;
  /** The route the crew picked (Route #2 unless #1 is chosen or #2 has no path). */
  activeRoute: (ids: string[]) => Route | null;
  blockedBy: (p: Pt) => HazardZone | null;
  nearestHazard: (p: Pt) => { z: HazardZone; km: number } | null;
  elevOf: (p: Pt) => number | null;
  slopeOf: (p: Pt) => number | null;
  /** Steepest grade the gentlest possible route to these stops still needs (for "No safe route"). */
  neededGrade: (ids: string[]) => number | null;
  /** Profile (length, time, grades, steep parts) of any point list, on the routing grid. */
  profileOf: (pts: Pt[]) => Profile | null;
  // actions
  /**
   * Open a landmark's Waypoint card. From search with a sequence already planned, the landmark is
   * appended to the sequence instead (the design's rule).
   */
  select: (id: string, from?: "map" | "search") => void;
  pickRoute: (opt: 1 | 2) => void;
  addStopSel: () => void;
  startNav: () => void;
  navAll: () => void;
  moveStop: (i: number, d: -1 | 1) => void;
  removeStop: (i: number) => void;
  clearRoute: () => void;
  addStopFromNav: () => void;
  toggleReroute: () => void;
  addVia: (p: Pt) => void;
  autoReroute: () => void;
  endNav: () => void;
  dismissArrived: () => void;
  goSafeApproach: () => void;
  overrideRisk: () => void;
}

const Ctx = createContext<RouteApi | null>(null);

export function useRoutes(): RouteApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoutes must be used inside <RouteProvider>");
  return v;
}

export function RouteProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { state: S, settings, patch, setMode, goHome, pushRecent, toast, centerOn, snapTo } = app;
  const { terrain, manifest } = useMapData();

  // Routing grid, once the terrain is in.
  const grid = useMemo<RouteGrid | null>(
    () => (terrain ? makeGrid({ elev: terrain.elev, elevNodata: terrain.elevNodata, slopeQ3: terrain.slopeQ3, slopeScale: terrain.slopeScale }) : null),
    [terrain],
  );

  // Dust-devil heating levels of the shown sol (safe routes avoid strong heating).
  const [dust, setDust] = useState<{ sol: number; levels: Uint8Array | null } | null>(null);
  useEffect(() => {
    let live = true;
    loadDustLevels(manifest, S.dustSol).then(levels => live && setDust({ sol: S.dustSol, levels }));
    return () => { live = false; };
  }, [manifest, S.dustSol]);
  const dustLevels = S.hazTypes.weather && dust?.sol === S.dustSol ? dust.levels : null;

  const lm = useCallback(
    (id: string | null | undefined) => (id ? LANDMARKS.find(l => l.id === id) ?? S.extraLm.find(l => l.id === id) ?? null : null),
    [S.extraLm],
  );
  const zones = useMemo(() => HAZARD_ZONES.filter(z => S.hazTypes[z.type]), [S.hazTypes]);

  const overrideOn = !!S.override && (S.override === S.sel || S.stops.includes(S.override) || !!S.nav?.stops.includes(S.override));
  const capSafe = overrideOn ? CAP_OVERRIDE : settings.maxGrade;
  const capDirect = overrideOn ? CAP_OVERRIDE : CAP_DIRECT;

  // --- cached routes ---
  const cache = useRef(new Map<string, Route>());
  useEffect(() => cache.current.clear(), [grid]);
  const route = useCallback(
    (points: Pt[], safe: boolean): Route | null => {
      if (!grid || points.length < 2) return null;
      const key = JSON.stringify([points.map(p => [Math.round(p.x * 2), Math.round(p.y * 2)]), safe, capSafe, capDirect, S.hazTypes, safe && dustLevels ? S.dustSol : 0]);
      let r = cache.current.get(key);
      if (!r) {
        r = buildRoute(grid, points, { cap: safe ? capSafe : capDirect, safe, zones, dust: dustLevels });
        if (cache.current.size > 40) cache.current.delete(cache.current.keys().next().value as string);
        cache.current.set(key, r);
      }
      return r;
    },
    [grid, capSafe, capDirect, S.hazTypes, S.dustSol, zones, dustLevels],
  );

  const pointsFor = useCallback(
    (ids: string[]) => {
      const pts = ids.map(lm).filter((l): l is Landmark => !!l);
      return pts.length === ids.length ? [S.rover as Pt, ...pts] : null;
    },
    [lm, S.rover],
  );
  const routeOpts = useCallback(
    (ids: string[]): RouteOptions | null => {
      const pts = pointsFor(ids);
      const direct = pts && route(pts, false), safe = pts && route(pts, true);
      return direct && safe ? { direct, safe } : null;
    },
    [pointsFor, route],
  );
  const neededGrade = useCallback(
    (ids: string[]) => {
      const pts = pointsFor(ids);
      if (!grid || !pts) return null;
      // Lowest grade limit that still reaches every stop (tried coarse to fine, so most targets take 1–3 plans).
      for (const cap of [8, 10, 12, 15, 18, 22, 25, 30, 35, 45, 60]) {
        if (cap <= capDirect) continue;
        if (buildRoute(grid, pts, { cap, safe: false, zones: [], dust: null }).ok) return cap;
      }
      return null;
    },
    [grid, pointsFor, capDirect],
  );
  const activeRoute = useCallback(
    (ids: string[]) => {
      const o = routeOpts(ids);
      return o ? (S.routeOpt === 1 || !o.safe.ok ? o.direct : o.safe) : null;
    },
    [routeOpts, S.routeOpt],
  );

  const blockedBy = useCallback((p: Pt) => zones.find(z => inside(p, z)) ?? null, [zones]);
  const nearestHazard = useCallback(
    (p: Pt) => {
      let best: { z: HazardZone; km: number } | null = null;
      for (const z of zones) {
        const km = Math.max(0, pxToKm(edgeDist(p, z)));
        if (!best || km < best.km) best = { z, km };
      }
      return best;
    },
    [zones],
  );
  const elevOf = useCallback((p: Pt) => terrainAt(terrain, p)?.elev ?? null, [terrain]);
  const slopeOf = useCallback((p: Pt) => terrainAt(terrain, p)?.slope ?? null, [terrain]);
  const profileOf = useCallback((pts: Pt[]) => (grid && pts.length ? profile(grid, pts) : null), [grid]);

  // --- actions (they read the latest state through a ref, so timers and gestures can call them) ---
  const latest = useRef({ S, activeRoute, route, lm, zones, grid, capSafe });
  latest.current = { S, activeRoute, route, lm, zones, grid, capSafe };

  const select = useCallback(
    (id: string, from: "map" | "search" = "map") => {
      const { S: s, lm: find } = latest.current;
      const l = find(id);
      if (!l) return;
      pushRecent(id);
      if (from === "search" && s.stops.length) {
        if (s.stops.includes(id)) toast(`${l.name} is already in the sequence`);
        patch({ stops: s.stops.includes(id) ? s.stops : [...s.stops, id], sel: null, q: "", cat: "All", elevOpen: false, heatOpen: false });
        setMode("route", "half");
        return;
      }
      patch({ sel: id, elevOpen: false, heatOpen: false, q: "", cat: "All" });
      setMode("waypoint", "half");
      centerOn(l);
    },
    [patch, setMode, centerOn, pushRecent, toast],
  );

  const pickRoute = useCallback((opt: 1 | 2) => patch({ routeOpt: opt }), [patch]);

  const addStopSel = useCallback(() => {
    const s = latest.current.S, id = s.sel;
    if (!id) return;
    if (s.stops.includes(id)) toast(`${latest.current.lm(id)?.name ?? "Stop"} is already in the sequence`);
    patch({ stops: s.stops.includes(id) ? s.stops : [...s.stops, id], sel: null });
    setMode("route", "half");
  }, [patch, setMode, toast]);

  /** Start (or restart, from where the rover is) an expedition through `stops`. */
  const beginNav = useCallback(
    (stops: string[]) => {
      const { activeRoute: active, S: s } = latest.current;
      if (!stops.length) return;
      const r = active(stops);
      if (!r) return toast("Map data still loading");
      if (!r.ok) return toast("No route under the grade limit · see the waypoint card for options");
      const cum = cumul(r.pts);
      const nav: Nav = {
        stops, pts: r.pts, legEnds: r.legEnds, cum, prog: 0, legIdx: 0, startedAt: Date.now(),
        driven: s.nav ? s.nav.driven + s.nav.prog : 0, grade: 0, spd: 8, safe: s.routeOpt === 2 && r.cap === latest.current.capSafe,
      };
      patch({ nav, navActive: true, mode: "nav", sel: null, stops, viaPending: false, override: null, arrived: null });
      snapTo("peek");
      toast(`Navigation started · ${stops.length} leg${stops.length > 1 ? "s" : ""}, ${fmtMin(r.min)}`);
      centerOn(s.rover, Math.max(s.view.s, 1.9));
    },
    [patch, snapTo, toast, centerOn],
  );

  const startNav = useCallback(() => {
    const s = latest.current.S, id = s.sel;
    if (!id) return;
    beginNav(s.stops.includes(id) ? s.stops : [...s.stops, id]);
  }, [beginNav]);
  const navAll = useCallback(() => beginNav(latest.current.S.stops), [beginNav]);

  const moveStop = useCallback((i: number, d: -1 | 1) => patch(s => {
    const st = [...s.stops], j = i + d;
    if (j < 0 || j >= st.length) return {};
    [st[i], st[j]] = [st[j], st[i]];
    return { stops: st };
  }), [patch]);
  const removeStop = useCallback((i: number) => {
    const st = latest.current.S.stops.filter((_, k) => k !== i);
    patch({ stops: st });
    if (!st.length) goHome();
  }, [patch, goHome]);
  const clearRoute = useCallback(() => {
    patch({ stops: [], sel: null, nav: null, navActive: false, viaPending: false });
    setMode("home", "peek");
  }, [patch, setMode]);

  // During an expedition: keep driving, edit the remaining stops in the sequence card.
  const addStopFromNav = useCallback(() => {
    const s = latest.current.S;
    if (s.nav) patch({ stops: s.nav.stops.filter(id => !id.startsWith("via-")), viaPending: false });
    setMode("route", "half");
    toast("Tap a landmark, then Add stop · NAVIGATE restarts from the rover");
  }, [patch, setMode, toast]);

  const toggleReroute = useCallback(() => patch(s => ({ viaPending: !s.viaPending })), [patch]);

  /** Re-plan the rest of the expedition from the rover through `stops`. */
  const replan = useCallback(
    (stops: string[], safe: boolean, extra: Partial<typeof S> = {}) => {
      const { S: s, route: r0, lm: find } = latest.current;
      if (!s.nav) return false;
      const lms = stops.map(id => find(id) ?? (extra.extraLm ?? []).find(l => l.id === id));
      if (lms.some(l => !l)) return false;
      const r = r0([s.rover, ...(lms as Landmark[])], safe);
      if (!r) return false;
      if (!r.ok) {
        toast(safe ? "No hazard-free route from here · staying on the current route" : "Can't reach that point under the grade limit");
        return false;
      }
      const driven = s.nav.driven + s.nav.prog;
      patch({ ...extra, nav: { ...s.nav, stops, pts: r.pts, legEnds: r.legEnds, cum: cumul(r.pts), prog: 0, legIdx: 0, driven, safe }, viaPending: false });
      return true;
    },
    [patch, toast],
  );

  const addVia = useCallback(
    (p: Pt) => {
      const { S: s } = latest.current;
      if (!s.nav) return;
      const rem = s.nav.stops.slice(s.nav.legIdx);
      const via: Landmark = {
        id: `via-${Date.now()}`, name: "Via-point", cat: "Traverse", rank: 1, real: false,
        ...p, ...{ lon: 0, lat: 0 },
        desc: `Crew-placed via-point at ${fmtLatLon(p)}.`, note: "Manual reroute: the rover passes here before continuing.",
      };
      const extraLm = [...s.extraLm.filter(l => !l.id.startsWith("via-") || rem.includes(l.id)), via];
      if (replan([via.id, ...rem], s.routeOpt === 2, { extraLm })) toast("Manual reroute accepted · via-point added");
    },
    [replan, toast],
  );

  const autoReroute = useCallback(() => {
    const s = latest.current.S;
    if (!s.nav) return;
    if (replan(s.nav.stops.slice(s.nav.legIdx), true, { routeOpt: 2 })) toast("Rerouted on Route #2 · hazard-free");
  }, [replan, toast]);

  const endNav = useCallback(() => {
    patch({ nav: null, navActive: false, stops: [], viaPending: false });
    setMode("home", "peek");
    toast("Navigation ended by crew");
  }, [patch, setMode, toast]);

  const dismissArrived = useCallback(() => {
    patch({ arrived: null });
    setMode("home", "peek");
  }, [patch, setMode]);

  /** "Nearest safe approach" / "Nearest reachable point": add a stand-off point as a landmark and select it. */
  const goSafeApproach = useCallback(() => {
    const { S: s, lm: find, zones: zs, route: r0 } = latest.current;
    const l = find(s.sel);
    if (!l) return;
    const h = zs.find(z => inside(l, z));
    let p: Pt;
    if (h) {
      const k = Math.max(h.rx, h.ry) * 1.25, d = Math.hypot(s.rover.x - h.x, s.rover.y - h.y) || 1;
      p = { x: h.x + ((s.rover.x - h.x) / d) * k, y: h.y + ((s.rover.y - h.y) / d) * k };
    } else {
      // The safe route's farthest point: it stays out of hazard zones, unlike the direct route's.
      const pts = [s.rover, ...s.stops.map(id => find(id)!).filter(Boolean), l];
      p = r0(pts, true)?.reached ?? r0(pts, false)?.reached ?? s.rover;
    }
    const short = fmtKm(Math.hypot(p.x - l.x, p.y - l.y));
    const id = `approach-${l.id}`;
    const elevGap = Math.abs((terrainAt(terrain, l)?.elev ?? 0) - (terrainAt(terrain, p)?.elev ?? 0));
    const approach: Landmark = {
      id, name: `${l.name} approach`, cat: l.cat, rank: 1, real: false, x: p.x, y: p.y, lon: 0, lat: 0,
      desc: h
        ? `Nearest safe standoff point, ${short} short of ${l.name}. Continue on foot with a tether.`
        : `Closest point the rover can reach under the grade limit, ${short} short of ${l.name} and ${Math.round(elevGap).toLocaleString()} m below it. Finish on foot.`,
      note: h
        ? `Standoff keeps the rover out of the ${h.name.toLowerCase()} zone. EVA leg from here: ${fmtMin((distanceM(p, l) / 1000 / 4) * 60)}.`
        : `Budget ${fmtMin((distanceM(p, l) / 1000 / 2) * 60)} on foot with rests for the last climb.`,
    };
    patch({ extraLm: [...s.extraLm.filter(x => x.id !== id), approach] });
    setTimeout(() => select(id), 0);
  }, [patch, select, terrain]);

  const overrideRisk = useCallback(() => {
    patch(s => ({ override: s.sel, routeOpt: 1 }));
    toast("Risk acknowledged · grade and hazard limits lifted for this target only");
  }, [patch, toast]);

  // --- the simulation: every 100 ms, drive along the route at the speed the grade allows ---
  const navOn = !!S.nav;
  useEffect(() => {
    if (!navOn) return;
    const id = setInterval(() => {
      const { S: s, grid: g, lm: find } = latest.current;
      const n = s.nav;
      if (!n || !g) return;
      const total = n.cum[n.cum.length - 1];
      const here = posAt(n.pts, n.cum, n.prog), ahead = posAt(n.pts, n.cum, Math.min(total, n.prog + 2));
      const run = Math.hypot(ahead.x - here.x, ahead.y - here.y);
      const grade = run > 0.05 ? (Math.atan(Math.abs(nodeElev(g, ahead) - nodeElev(g, here)) / (run * M_PER_PX)) * 180) / Math.PI : n.grade;
      const spd = speedFor(grade);
      const prog = Math.min(total, n.prog + (spd * settings.demoSpeed * TICK_MS) / 3_600_000 / pxToKm(1));
      const p = posAt(n.pts, n.cum, prog);
      const rover = { x: p.x, y: p.y, h: p.h ?? s.rover.h };
      let legIdx = 0;
      for (let i = 1; i < n.legEnds.length; i++) if (prog >= n.cum[n.legEnds[i]] - 0.01) legIdx = i;
      if (legIdx > n.legIdx && legIdx < n.stops.length) {
        const done = find(n.stops[legIdx - 1]);
        toast(`Reached ${done?.name ?? "stop"} · leg ${legIdx + 1} of ${n.stops.length}`);
      }
      if (prog >= total - 0.01) {
        const last = find(n.stops[n.stops.length - 1]);
        const real = n.stops.filter(x => !x.startsWith("via-")).length;
        patch({
          rover, nav: null, navActive: false, mode: "arrived", stops: [], viaPending: false,
          extraLm: s.extraLm.filter(l => !l.id.startsWith("via-")),
          arrived: { name: last?.name ?? "Destination", km: pxToKm(n.driven + total), min: ((Date.now() - n.startedAt) / 60000) * settings.demoSpeed, stops: real },
        });
        snapTo("half");
        toast("Navigation ended automatically · destination reached", 6000);
        return;
      }
      patch({ rover, nav: { ...n, prog, legIdx: Math.min(legIdx, n.stops.length - 1), grade, spd } });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [navOn, settings.demoSpeed, patch, snapTo, toast]);

  const api = useMemo<RouteApi>(
    () => ({
      ready: !!grid, lm, zones, capSafe, capDirect, routeOpts, activeRoute, neededGrade, blockedBy, nearestHazard, elevOf, slopeOf, profileOf,
      select, pickRoute, addStopSel, startNav, navAll, moveStop, removeStop, clearRoute, addStopFromNav, toggleReroute,
      addVia, autoReroute, endNav, dismissArrived, goSafeApproach, overrideRisk,
    }),
    [grid, lm, zones, capSafe, capDirect, routeOpts, activeRoute, neededGrade, blockedBy, nearestHazard, elevOf, slopeOf, profileOf, select, pickRoute,
      addStopSel, startNav, navAll, moveStop, removeStop, clearRoute, addStopFromNav, toggleReroute, addVia, autoReroute, endNav,
      dismissArrived, goSafeApproach, overrideRisk],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Hazard zone the rest of the route passes through (not the destination's own zone), for the expedition warning. */
export function crossingAhead(pts: Pt[], from: Pt, zones: HazardZone[], dest: Pt | null): HazardZone | null {
  let prev = from;
  for (const p of pts) {
    for (const z of zones) if ((!dest || !inside(dest, z)) && segHit(prev, p, z)) return z;
    prev = p;
  }
  return null;
}

/** MTC "HH:MM" after `min` minutes from now. */
export function arrivalMtc(min: number): string {
  const t = ((mtcSeconds() + Math.round(min * 60)) % 86400 + 86400) % 86400, p = (v: number) => String(v).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}`;
}
