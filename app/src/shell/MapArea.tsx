import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, View, type GestureResponderEvent, type HostInstance } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { clampView, useApp, ZOOM_MAX, ZOOM_MIN } from "../state/store";
import { fmtInt, fmtLatLon, GRID, inWorld } from "../map/geo";
import { terrainAt, useMapData } from "../map/data";
import { MapViewProvider, type V3, type Viewport } from "../map/view";
import { TileLayer } from "../map/layers/TileLayer";
import { StrataLayer } from "../map/layers/StrataLayer";
import { HeatLayer } from "../map/layers/HeatLayer";
import { HazardLabels, HazardLayer } from "../map/layers/HazardLayer";
import { DustDevilLayer } from "../map/layers/DustDevilLayer";
import { GridLayer } from "../map/layers/GridLayer";
import { LandmarkLayer } from "../map/layers/LandmarkLayer";
import { RoverMarker } from "../map/layers/RoverMarker";
import { MapOverlays } from "../map/MapOverlays";
import { RouteLayer } from "../route/RouteLayer";
import { useRoutes } from "../route/RouteProvider";
import { C, EASE } from "../theme";
import { Dock } from "./Dock";

type Gesture = {
  n: number; // fingers when this phase began
  start: V3; // view when this phase began
  x0: number; y0: number; // pan: first finger; pinch: midpoint
  d0: number; // pinch: finger distance
  t0: number; // first touch, for tap detection
  tapX: number; tapY: number;
  moved: number; // furthest the first finger travelled, px
  pinched: boolean;
};

const clampS = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));

/**
 * The map area: the world container (every layer, positioned in world px and moved by one
 * translate/scale), gestures, haze, sheet scrim, overlays and the dock.
 *
 * Gestures: one-finger pan, two-finger pinch (with pan), mouse-wheel / trackpad zoom on web, and a
 * tap shows the coordinate pill. While a gesture or glide runs, the shared `view` is written
 * directly (one value, so scale and position always reach the screen together); the store's `view`
 * is updated when a gesture ends.
 */
export function MapArea() {
  const app = useApp();
  const { state: S, geo, sheetTop } = app;
  const data = useMapData();

  const view = useSharedValue<V3>({ s: S.view.s, tx: S.view.tx, ty: S.view.ty });
  const live = useRef<V3>({ s: S.view.s, tx: S.view.tx, ty: S.view.ty }); // JS copy of `view`
  const show = (v: V3) => {
    live.current = v;
    view.value = v;
  };
  const glide = useRef<number | null>(null);

  // Throttled viewport for layers that cull (tiles).
  const [vp, setVp] = useState<Viewport>({ ...live.current, w: geo.mapW, h: geo.H });
  const vpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const size = useRef({ w: geo.mapW, h: geo.H });
  size.current = { w: geo.mapW, h: geo.H };
  const pushVp = (now = false) => {
    if (now) {
      if (vpTimer.current) clearTimeout(vpTimer.current);
      vpTimer.current = null;
      return setVp({ ...live.current, ...size.current });
    }
    if (vpTimer.current) return;
    vpTimer.current = setTimeout(() => {
      vpTimer.current = null;
      setVp({ ...live.current, ...size.current });
    }, 100);
  };
  useEffect(() => () => { if (vpTimer.current) clearTimeout(vpTimer.current); }, []);

  // Store view → shared view: jump, or glide 450 ms. A glide interpolates all three numbers in one
  // frame loop, so each frame shows a consistent view.
  useEffect(() => {
    const v = S.view, to = { s: v.s, tx: v.tx, ty: v.ty };
    if (glide.current !== null) cancelAnimationFrame(glide.current);
    glide.current = null;
    if (!v.anim) {
      show(to);
      pushVp(true);
      return;
    }
    const from = { ...live.current }, t0 = Date.now(), ease = Easing.bezier(...EASE);
    const step = () => {
      const u = Math.min(1, (Date.now() - t0) / 450), e = ease(u);
      show({ s: from.s + (to.s - from.s) * e, tx: from.tx + (to.tx - from.tx) * e, ty: from.ty + (to.ty - from.ty) * e });
      pushVp(u >= 1);
      glide.current = u < 1 ? requestAnimationFrame(step) : null;
    };
    step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.view]);
  useEffect(() => pushVp(true), [geo.mapW, geo.H]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- gesture plumbing; handlers read the latest props through this ref ---
  const routes = useRoutes();
  const latest = useRef({ app, data, routes });
  latest.current = { app, data, routes };

  /** Stop any glide where it is (live already holds the view on screen). */
  const halt = () => {
    if (glide.current !== null) cancelAnimationFrame(glide.current);
    glide.current = null;
  };
  const apply = (v: V3) => {
    const c = clampView({ ...v, anim: false }, latest.current.app.geo);
    show({ s: c.s, tx: c.tx, ty: c.ty });
    pushVp();
  };
  const commit = () => latest.current.app.setView({ ...live.current, anim: false });

  const onTap = (sx: number, sy: number) => {
    const { app: a, data: d, routes: r } = latest.current;
    const p = { x: (sx - live.current.tx) / live.current.s, y: (sy - live.current.ty) / live.current.s };
    a.patch({ heatOpen: false, elevOpen: false });
    // REROUTE armed: this tap is the via-point.
    if (a.state.viaPending && a.state.nav) {
      if (inWorld(p)) r.addVia(p);
      return;
    }
    // Tapping empty map closes a target card (back to the sequence or Home).
    if (a.state.mode === "waypoint") a.goHome();
    if (!inWorld(p)) return;
    const t = terrainAt(d.terrain, p);
    a.showCoord(t ? `${fmtLatLon(p)} · ${fmtInt(t.elev)} m · ${Math.round(t.slope)}° slope` : fmtLatLon(p));
  };

  // Page coordinates → map-area coordinates. The map area may sit inside a centred phone frame.
  const gestureRef = useRef<HostInstance>(null);
  const origin = useRef({ x: 0, y: 0 });
  const measure = () => gestureRef.current?.measureInWindow((x, y) => { origin.current = { x, y }; });

  const points = (e: GestureResponderEvent) => {
    const ne = e.nativeEvent;
    const list = ne.touches && ne.touches.length ? Array.from(ne.touches) : [ne];
    return list.map(t => ({ x: t.pageX - origin.current.x, y: t.pageY - origin.current.y }));
  };

  const g = useRef<Gesture | null>(null);
  const begin = (pts: { x: number; y: number }[], keep?: Gesture) => {
    const [a, b] = pts;
    const two = pts.length >= 2;
    g.current = {
      n: two ? 2 : 1,
      start: { ...live.current },
      x0: two ? (a.x + b.x) / 2 : a.x,
      y0: two ? (a.y + b.y) / 2 : a.y,
      d0: two ? Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) : 0,
      t0: keep?.t0 ?? Date.now(),
      tapX: keep?.tapX ?? a.x,
      tapY: keep?.tapY ?? a.y,
      moved: keep?.moved ?? 0,
      pinched: (keep?.pinched ?? false) || two,
    };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          halt();
          measure();
          begin(points(e));
        },
        onPanResponderMove: e => {
          const cur = g.current;
          if (!cur) return;
          const pts = points(e);
          if (Math.min(pts.length, 2) !== cur.n) return begin(pts, cur); // a finger was added or lifted
          const st = cur.start;
          if (cur.n === 1) {
            const dx = pts[0].x - cur.x0, dy = pts[0].y - cur.y0;
            cur.moved = Math.max(cur.moved, Math.hypot(dx, dy));
            apply({ s: st.s, tx: st.tx + dx, ty: st.ty + dy });
          } else {
            const [a, b] = pts;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const ns = clampS(st.s * Math.hypot(a.x - b.x, a.y - b.y) / cur.d0), k = ns / st.s;
            // Keep the world point that was under the fingers' midpoint under it as they move.
            apply({ s: ns, tx: mx - (cur.x0 - st.tx) * k, ty: my - (cur.y0 - st.ty) * k });
          }
        },
        onPanResponderRelease: () => {
          const cur = g.current;
          g.current = null;
          if (cur && !cur.pinched && cur.moved < 6 && Date.now() - cur.t0 < 450) onTap(cur.tapX, cur.tapY);
          commit();
        },
        onPanResponderTerminate: () => {
          g.current = null;
          commit();
        },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Web: mouse wheel and trackpad pinch (which arrives as wheel + ctrlKey) zoom around the cursor.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = gestureRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== "function") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      halt();
      const r = el.getBoundingClientRect();
      const ox = ev.clientX - r.left, oy = ev.clientY - r.top;
      const lines = ev.deltaMode === 1 ? 16 : 1;
      const cur = live.current, ns = clampS(cur.s * Math.exp(-ev.deltaY * lines * (ev.ctrlKey ? 0.01 : 0.002))), k = ns / cur.s;
      apply({ s: ns, tx: ox - (ox - cur.tx) * k, ty: oy - (oy - cur.ty) * k });
      clearTimeout(timer);
      timer = setTimeout(commit, 180);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The map dims as the phone sheet rises: 0 at peek, 0.5 at full.
  const p = geo.snap;
  const scrim = geo.device === "phone"
    ? sheetTop.interpolate({ inputRange: [p.full, p.peek], outputRange: [0.5, 0], extrapolate: "clamp" })
    : 0;

  const mapView = useMemo(() => ({ view, vp }), [view, vp]);
  const worldStyle = useAnimatedStyle(() => {
    const v = view.value;
    return { transform: [{ translateX: v.tx }, { translateY: v.ty }, { scale: v.s }] };
  });

  return (
    // Web: "clip", not "hidden". A hidden-overflow box can still be scrolled, and the browser scrolls it
    // to bring a focused marker button into view, which shifts the whole map and dock.
    <View style={{ position: "absolute", left: geo.mapLeft, top: 0, width: geo.mapW, height: geo.H, overflow: (Platform.OS === "web" ? "clip" : "hidden") as "hidden", backgroundColor: C.bg1 }}>
      <View
        ref={gestureRef}
        collapsable={false}
        onLayout={measure}
        {...responder.panHandlers}
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, cursor: "grab", touchAction: "none" } as object}
      >
        <MapViewProvider value={mapView}>
          <Reanimated.View style={[{ position: "absolute", left: 0, top: 0, width: GRID.W, height: GRID.H, transformOrigin: [0, 0, 0] }, worldStyle]}>
            <TileLayer />
            <StrataLayer />
            <HeatLayer />
            <DustDevilLayer />
          </Reanimated.View>
          {/* Markers and labels: drawn 1:1 above the zoomed world, so they stay sharp (see Pin). */}
          {/* collapsable={false}: keep this a real layer, so the pins' zIndex can't lift them over the dock. */}
          <View collapsable={false} pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 1 }}>
            <GridLayer />
            <HazardLayer />
            <RouteLayer />
            <HazardLabels />
            <LandmarkLayer />
            <RoverMarker />
          </View>
        </MapViewProvider>
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,172,122,0.2)", "rgba(255,172,122,0)"]}
        locations={[0, 0.32]}
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      />
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.bg0, opacity: scrim }} />
      <MapOverlays scale={vp.s} />
      <Dock />
    </View>
  );
}
