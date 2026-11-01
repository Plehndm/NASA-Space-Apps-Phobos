import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform } from "react-native";
import type { Geometry } from "../layout/geometry";
import { EASE } from "../theme";
import { DEFAULT_SETTINGS, loadOverrides, saveOverrides, type Settings } from "./settings";

/** Which card stack the sheet / side panel shows. */
export type Mode = "home" | "search" | "waypoint" | "route" | "nav" | "arrived" | "layers" | "assistant";
export type SnapName = "full" | "half" | "peek";

/** Map view transform: world px → screen px is `translate(tx,ty) scale(s)`. */
export interface View {
  s: number;
  tx: number;
  ty: number;
  anim: boolean; // animate to this view instead of jumping
}

export interface AppState {
  mode: Mode;
  sheetY: number; // phone only: the snap point the bottom sheet is at (or moving to)
  settingsOpen: boolean;
  overrides: Partial<Settings>; // in-app settings changes on top of DEFAULT_SETTINGS
  toast: string | null;
  view: View;
  // Dock state. Each layer feature owns the behaviour; the shell only toggles the flags.
  elev: 0 | 1 | 2 | 3; // elevation strata shown (0 = off)
  elevOpen: boolean; // elevation popover open (layer picker = dock)
  heat: "off" | "on";
  heatOpen: boolean; // heat popover open (layer picker = dock)
  hazOn: boolean;
  navActive: boolean; // true while an expedition is running (header shows "DEMO ×N")
  q: string; // search text
}

export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 4.2;

function initialView(g: Geometry): View {
  return g.device === "desktop" ? { s: 2.1, tx: -28, ty: -298, anim: false } : { s: 1.3, tx: -116, ty: -284, anim: false };
}

const webScene = () => (Platform.OS === "web" && typeof location !== "undefined" ? new URLSearchParams(location.search).get("scene") : null);

interface Store {
  state: AppState;
  geo: Geometry;
  settings: Settings; // resolved: defaults + overrides
  /** Phone sheet's live top edge. Animated, so drags and snaps don't re-render the app. */
  sheetTop: Animated.Value;
  patch: (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
  setMode: (mode: Mode, snap?: SnapName) => void;
  snapTo: (name: SnapName) => void;
  toast: (msg: string, ms?: number) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  resetSettings: () => void;
  /** Zoom by factor k around a point in map-area px (defaults to the visible map centre). */
  zoomBy: (k: number, ox?: number, oy?: number) => void;
  /** Visible map centre in map-area px (phone: the part not covered by the sheet). */
  viewCenter: () => { x: number; y: number };
}

const Ctx = createContext<Store | null>(null);

export function AppProvider({ geo, children }: { geo: Geometry; children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    mode: "home",
    sheetY: geo.snap.peek,
    settingsOpen: webScene() === "settings",
    overrides: {},
    toast: null,
    view: initialView(geo),
    elev: 0,
    elevOpen: false,
    heat: "off",
    heatOpen: false,
    hazOn: false,
    navActive: false,
    q: "",
  }));
  const sheetTop = useRef(new Animated.Value(geo.snap.peek)).current;

  useEffect(() => {
    loadOverrides().then(overrides => setState(s => ({ ...s, overrides: { ...overrides, ...s.overrides } })));
  }, []);

  const patch = useCallback<Store["patch"]>(p => setState(s => ({ ...s, ...(typeof p === "function" ? p(s) : p) })), []);

  const moveSheet = useCallback(
    (y: number) => {
      Animated.timing(sheetTop, { toValue: y, duration: 350, easing: Easing.bezier(...EASE), useNativeDriver: false }).start();
    },
    [sheetTop],
  );

  const snapTo = useCallback(
    (name: SnapName) => {
      patch({ sheetY: geo.snap[name] });
      moveSheet(geo.snap[name]);
    },
    [geo, patch, moveSheet],
  );

  const setMode = useCallback(
    (mode: Mode, snap?: SnapName) => {
      patch({ mode });
      if (snap && geo.device === "phone") snapTo(snap);
    },
    [geo, patch, snapTo],
  );

  // When the layout changes (rotation, resize, phone ↔ desktop), keep the sheet on a snap point.
  const prevDevice = useRef(geo.device);
  useEffect(() => {
    const deviceChanged = prevDevice.current !== geo.device;
    prevDevice.current = geo.device;
    setState(s => {
      const p = geo.snap;
      const name = (["full", "half", "peek"] as SnapName[]).sort((a, b) => Math.abs(p[a] - s.sheetY) - Math.abs(p[b] - s.sheetY))[0];
      sheetTop.setValue(p[name]);
      return { ...s, sheetY: p[name], view: deviceChanged ? initialView(geo) : s.view };
    });
  }, [geo, sheetTop]);

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
        : { x: geo.W / 2, y: Math.max(184, (geo.headerH + state.sheetY) / 2) },
    [geo, state.sheetY],
  );

  const zoomBy = useCallback<Store["zoomBy"]>(
    (k, ox, oy) => {
      const c = viewCenter();
      const x = ox ?? c.x, y = oy ?? c.y;
      setState(s => {
        const ns = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.view.s * k));
        const kk = ns / s.view.s;
        return { ...s, view: { s: ns, tx: x - (x - s.view.tx) * kk, ty: y - (y - s.view.ty) * kk, anim: true } };
      });
    },
    [viewCenter],
  );

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...state.overrides }), [state.overrides]);

  const value = useMemo<Store>(
    () => ({ state, geo, settings, sheetTop, patch, setMode, snapTo, toast, setSetting, resetSettings, zoomBy, viewCenter }),
    [state, geo, settings, sheetTop, patch, setMode, snapTo, toast, setSetting, resetSettings, zoomBy, viewCenter],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}
