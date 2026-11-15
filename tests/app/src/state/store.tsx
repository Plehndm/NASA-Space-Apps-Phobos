import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing } from "react-native";
import type { Geometry } from "../layout/geometry";
import { GRID, toWorld, type Pt } from "../map/geo";
import { EASE } from "../theme";
import { mtcSeconds } from "./clock";
import { landmarkById, type Category, type Landmark } from "../map/landmarks";
import type { Arrived, Nav } from "../route/types";
import { DEFAULT_SETTINGS, loadOverrides, loadRecent, RECENT_MAX, saveOverrides, saveRecent, type Settings } from "./settings";

/** Which card stack the sheet / side panel shows. */
export type Mode = "home" | "search" | "waypoint" | "route" | "nav" | "arrived" | "layers" | "assistant";
export type SnapName = "full" | "half" | "peek" | "min";

/** Map view transform: world px → screen px is `translate(tx,ty) scale(s)`. */
export interface View {
  s: number;
  tx: number;
  ty: number;
  anim: boolean; // animate to this view instead of jumping
}

/** Rover pose in world px; h is the heading in degrees clockwise from north. */
export interface Rover extends Pt { h: number }

export type HazType = "weather" | "steep" | "rough" | "radiation" | "sand";

export interface AppState {
  mode: Mode;
  sheetY: number; // phone only: the snap point the bottom sheet is at (or moving to)
  settingsOpen: boolean;
  about: { from: "settings" | "map"; at?: "limits" } | null; // About & credits open: where it was opened from (closing returns there), and a section to scroll to
  overrides: Partial<Settings>; // in-app settings changes on top of DEFAULT_SETTINGS
  toast: string | null;
  view: View;
  // Dock state. Each layer feature owns the behaviour; the shell only toggles the flags.
  elev: 0 | 1 | 2 | 3; // elevation strata shown (0 = off)
  elevOpen: boolean; // elevation popover open (layer picker = dock)
  heat: "off" | "on";
  heatOpen: boolean; // heat popover open (layer picker = dock)
  heatT: number; // frame index into the manifest's heat frames (30-minute LTST steps from 00:00)
  heatPlay: boolean;
  heatKind: "ground" | "air";
  heatSeason: string; // manifest season tag, e.g. "ls075"
  hazOn: boolean;
  hazTypes: Record<HazType, boolean>; // hazard filter chips
  dustSol: number; // which pipeline sol the dust-devil heating index shows
  lz: boolean; // landing points shown
  sel: string | null; // selected landmark id
  navActive: boolean; // true while an expedition is running (header shows "DEMO ×N"); mirrors nav !== null
  // Routing (src/route/)
  stops: string[]; // the multi-stop sequence, landmark ids in order
  routeOpt: 1 | 2; // 1 = direct, 2 = safe
  override: string | null; // landmark id whose grade and hazard limits the crew lifted ("Override at risk")
  nav: Nav | null; // running expedition
  viaPending: boolean; // REROUTE armed: the next map tap places a via-point
  arrived: Arrived | null; // summary for the Arrived screen
  extraLm: Landmark[]; // points added at run time ("Nearest safe approach")
  q: string; // search text
  cat: Category | "All"; // search category chip
  recent: string[]; // recent searches, landmark ids (most recent first, max 4)
  rover: Rover;
  coord: string | null; // coordinate pill text (tap on the map, recenter)
  street: { pano: string; heading: number; from: string | null } | null; // Street Level open: panorama, view heading, the waypoint it was opened from
}

// Zoom is screen px per world px (100 m). The prototype's range was 0.7–4.2 on a 51 km map; the real
// grid is 148 km wide. The minimum, 0.36, shows the whole crater on a desktop and about 110 km across a
// phone (it was 0.25; zooming out further mostly showed storm). Past the grid's edges the map shows a
// dust storm (StormLayer), not empty space. The maximum is as close as
// the imagery holds up: its finest tiles (zoom 11, about 20 m per pixel) carry 4.9 px per world px,
// so at 10 a 2x screen shows them about 1:1 (40 m across a screen point, ~4 km across a phone).
export const ZOOM_MIN = 0.36;
export const ZOOM_MAX = 10;

/** Curiosity's landing site, Bradbury Landing (the prototype's rover position). */
export const ROVER_START: Rover = { ...toWorld({ lon: 137.4417, lat: -4.5895 }), h: 35 };

/** Heat frame (30-minute steps) for the rover's local solar time now: LTST ≈ MTC + east longitude / 15 h. */
function ltstFrameNow(): number {
  const ltstH = (mtcSeconds() / 3600 + 137.44 / 15) % 24;
  return Math.round(ltstH * 2) % 48;
}

/** Opening view: the rover at the same screen spot as in the prototype, about 1.5× closer than its zoom. */
function initialView(g: Geometry, r: Pt = ROVER_START): View {
  const [s, sx, sy] = g.device === "desktop" ? [3.2, 421, 450] : [2.0, 162, 179];
  return { s, tx: sx - r.x * s, ty: sy - r.y * s, anim: false };
}

/** Keep the middle of the map area over the grid, so the map can't be dragged away into the storm. */
export function clampView(v: View, g: Geometry): View {
  const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.s));
  const cx = g.mapW / 2, cy = g.H / 2;
  const wx = Math.min(GRID.W, Math.max(0, (cx - v.tx) / s));
  const wy = Math.min(GRID.H, Math.max(0, (cy - v.ty) / s));
  return { s, tx: cx - wx * s, ty: cy - wy * s, anim: v.anim };
}

interface Store {
  state: AppState;
  geo: Geometry;
  settings: Settings; // resolved: defaults + overrides
  /** Phone sheet's live top edge. Animated, so drags and snaps don't re-render the app. */
  sheetTop: Animated.Value;
  patch: (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
  setMode: (mode: Mode, snap?: SnapName) => void;
  /** Put a landmark at the top of the recent searches (saved on the device). */
  pushRecent: (id: string) => void;
  /** Leave the current card: back to the expedition, the sequence or Home, whichever is active. */
  goHome: (snap?: SnapName) => void;
  snapTo: (name: SnapName) => void;
  toast: (msg: string, ms?: number) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  resetSettings: () => void;
  /** Zoom by factor k around a point in map-area px (defaults to the visible map centre). */
  zoomBy: (k: number, ox?: number, oy?: number) => void;
  /** Visible map centre in map-area px (phone: the part not covered by the sheet). */
  viewCenter: () => { x: number; y: number };
  /** Set the view (clamped). Gestures pass anim=false; buttons and selections animate. */
  setView: (v: View) => void;
  /** Glide so world point p sits at the visible centre, optionally at zoom s. */
  centerOn: (p: Pt, s?: number) => void;
  /** Show the coordinate pill for ms milliseconds. */
  showCoord: (text: string, ms?: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function AppProvider({ geo, children }: { geo: Geometry; children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    mode: "home",
    sheetY: geo.snap.peek,
    settingsOpen: false,
    about: null,
    overrides: {},
    toast: null,
    view: initialView(geo),
    elev: 0,
    elevOpen: false,
    heat: "off",
    heatOpen: false,
    heatT: ltstFrameNow(),
    heatPlay: false,
    heatKind: "ground",
    heatSeason: "ls075",
    hazOn: false,
    hazTypes: { weather: true, steep: true, rough: true, radiation: true, sand: true },
    dustSol: 1850,
    lz: true,
    sel: null,
    navActive: false,
    stops: [],
    routeOpt: 2,
    override: null,
    nav: null,
    viaPending: false,
    arrived: null,
    extraLm: [],
    q: "",
    cat: "All",
    recent: ["rocknest", "pahrump", "murray"], // the design's defaults until the device has its own
    rover: ROVER_START,
    coord: null,
    street: null,
  }));
  const sheetTop = useRef(new Animated.Value(geo.snap.peek)).current;

  useEffect(() => {
    loadOverrides().then(overrides => setState(s => ({ ...s, overrides: { ...overrides, ...s.overrides } })));
    loadRecent(id => !!landmarkById(id)).then(recent => { if (recent) setState(s => ({ ...s, recent })); });
  }, []);

  const patch = useCallback<Store["patch"]>(p => setState(s => ({ ...s, ...(typeof p === "function" ? p(s) : p) })), []);

  const moveSheet = useCallback(
    (y: number) => {
      Animated.timing(sheetTop, { toValue: y, duration: 350, easing: Easing.bezier(...EASE), useNativeDriver: false }).start();
    },
    [sheetTop],
  );

  // Where the phone sheet is going, updated at once (state.sheetY only changes on the next render),
  // so a centerOn() right after setMode(…, "half") centres for the sheet's new position.
  const sheetTarget = useRef(state.sheetY);
  sheetTarget.current = state.sheetY;
  const snapTo = useCallback(
    (name: SnapName) => {
      sheetTarget.current = geo.snap[name];
      patch({ sheetY: geo.snap[name] });
      moveSheet(geo.snap[name]);
    },
    [geo, patch, moveSheet],
  );

  const setMode = useCallback(
    (mode: Mode, snap?: SnapName) => {
      // Back on Home nothing is selected any more (the selected marker's highlight goes too).
      patch(mode === "home" ? { mode, sel: null } : { mode });
      if (snap && geo.device === "phone") snapTo(snap);
    },
    [geo, patch, snapTo],
  );

  const pushRecent = useCallback((id: string) => {
    if (!landmarkById(id)) return; // run-time points (approaches, via-points) aren't remembered
    setState(s => {
      const recent = [id, ...s.recent.filter(r => r !== id)].slice(0, RECENT_MAX);
      saveRecent(recent);
      return { ...s, recent };
    });
  }, []);

  const goHome = useCallback(
    (snap: SnapName = "peek") => {
      setState(s => ({ ...s, mode: s.nav ? "nav" : s.stops.length ? "route" : "home", sel: null, q: "", cat: "All" }));
      if (geo.device === "phone") snapTo(snap);
    },
    [geo, snapTo],
  );

  // When the layout changes (rotation, resize, phone ↔ desktop), keep the sheet on a snap point.
  const prevDevice = useRef(geo.device);
  useEffect(() => {
    const deviceChanged = prevDevice.current !== geo.device;
    prevDevice.current = geo.device;
    setState(s => {
      const p = geo.snap;
      const name = (["full", "half", "peek", "min"] as SnapName[]).sort((a, b) => Math.abs(p[a] - s.sheetY) - Math.abs(p[b] - s.sheetY))[0];
      sheetTop.setValue(p[name]);
      return { ...s, sheetY: p[name], view: deviceChanged ? initialView(geo, s.rover) : clampView(s.view, geo) };
    });
  }, [geo, sheetTop]);

  const coordTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showCoord = useCallback(
    (text: string, ms = 2600) => {
      patch({ coord: text });
      clearTimeout(coordTimer.current);
      coordTimer.current = setTimeout(() => patch({ coord: null }), ms);
    },
    [patch],
  );
  useEffect(() => () => clearTimeout(coordTimer.current), []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback(
    (msg: string, ms = 3200) => {
      patch({ toast: msg });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => patch({ toast: null }), ms);
    },
    [patch],
  );
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const setSetting = useCallback<Store["setSetting"]>(
    (k, v) =>
      setState(s => {
        const overrides = { ...s.overrides, [k]: v };
        saveOverrides(overrides);
        return { ...s, overrides };
      }),
    [],
  );
  const resetSettings = useCallback(() => {
    saveOverrides({});
    patch({ overrides: {} });
  }, [patch]);

  const viewCenter = useCallback(
    () =>
      geo.device === "desktop"
        ? { x: geo.mapW / 2, y: geo.H / 2 }
        : { x: geo.W / 2, y: Math.max(184, (geo.headerH + sheetTarget.current) / 2) },
    [geo],
  );

  const zoomBy = useCallback<Store["zoomBy"]>(
    (k, ox, oy) => {
      const c = viewCenter();
      const x = ox ?? c.x, y = oy ?? c.y;
      setState(s => {
        const ns = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.view.s * k));
        const kk = ns / s.view.s;
        return { ...s, view: clampView({ s: ns, tx: x - (x - s.view.tx) * kk, ty: y - (y - s.view.ty) * kk, anim: true }, geo) };
      });
    },
    [viewCenter, geo],
  );

  const setView = useCallback((v: View) => patch({ view: clampView(v, geo) }), [patch, geo]);

  const centerOn = useCallback<Store["centerOn"]>(
    (p, ns) => {
      const c = viewCenter();
      setState(s => {
        const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, ns ?? s.view.s));
        return { ...s, view: clampView({ s: z, tx: c.x - p.x * z, ty: c.y - p.y * z, anim: true }, geo) };
      });
    },
    [viewCenter, geo],
  );

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...state.overrides }), [state.overrides]);

  const value = useMemo<Store>(
    () => ({ state, geo, settings, sheetTop, patch, setMode, goHome, pushRecent, snapTo, toast, setSetting, resetSettings, zoomBy, viewCenter, setView, centerOn, showCoord }),
    [state, geo, settings, sheetTop, patch, setMode, goHome, pushRecent, snapTo, toast, setSetting, resetSettings, zoomBy, viewCenter, setView, centerOn, showCoord],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}
