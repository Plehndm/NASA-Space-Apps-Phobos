// A panorama viewer for the tile pyramids from build_panos.py: drag to turn, pinch (or the mouse
// wheel on web) to zoom, arrows on the ground to walk to linked panoramas.
//
// The view fills the screen with real imagery and turns without end. Its position is a point on the
// strip of imagery (see panos.ts): a full circle simply goes round, a partial panorama repeats end to
// end, with a faint seam where its two edges meet. Zoom and tilt stop at the edge of the imagery, so
// the empty sphere around it never shows. The compass, heading and walking arrows always use the true
// bearing of what is on screen.
//
// Only the tiles inside the window are drawn, at the zoom level whose texels best match the screen,
// over the whole sphere at zoom 0 so there is never a hole while tiles load. (Flat, like a map of the
// sphere: straight lines bend a little near the top and bottom of a wide view.)
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Image, PanResponder, PixelRatio, Platform, Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { alpha, C } from "../theme";
import { T } from "../ui/Text";
import { azToStrip, compassName, diff180, imageryBand, nearestCopy, stripSpan, stripToAz, tileUri, type Pano, type Panos } from "./panos";

/** h: position on the imagery strip (degrees, any value); p: elevation at the centre; f: degrees across. */
export interface ViewState { h: number; p: number; f: number }
export const F_MIN = 8, F_MAX = 110;
const CARDINAL = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Fill the screen with imagery: zoom out no further than the imagery's height (or a partial strip's width), tilt no further than its edges. */
export function clampView(v: ViewState, w: number, h: number, pano: Pano): ViewState {
  const band = imageryBand(pano), span = stripSpan(pano);
  const fFit = ((band.top - band.bottom) * w) / Math.max(1, h);
  const fMax = Math.min(F_MAX, fFit, span);
  const f = clamp(v.f, Math.min(F_MIN, fMax), fMax);
  const half = (h * f) / w / 2;
  return { h: v.h, p: clamp(v.p, band.bottom + half, band.top - half), f };
}

const Tile = memo(function Tile({ uri, x, y, w, h }: { uri: string; x: number; y: number; w: number; h: number }) {
  // Half a point of overlap hides hairline seams between neighbours.
  return <Image source={{ uri }} style={{ position: "absolute", left: x, top: y, width: w + 0.5, height: h + 0.5 }} resizeMode="stretch" fadeDuration={0} />;
});

function Chevron({ size = 18, color = C.accentInk }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 10.5 8 6l4.5 4.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type TileSpec = { key: string; uri: string; x: number; y: number; w: number; h: number };

/**
 * Tiles (and the zoom-0 sphere underneath) for one stretch of the sphere drawn on screen. leftAz is the
 * bearing at screen x = 0 for this stretch (unwrapped), [az0, az1] the bearings to cover, ox the screen
 * x of the box they are drawn in.
 */
function plane(pano: Pano, z: number, k: number, top: number, H: number, leftAz: number, az0: number, az1: number, ox: number) {
  const n = 2 ** z, tw = 360 / n / k, th = 180 / n / k;
  const tiles: TileSpec[] = [];
  if (z > 0) {
    const r0 = Math.max(0, Math.floor((90 - top) / (180 / n))), r1 = Math.min(n - 1, Math.floor((90 - top + H * k) / (180 / n)));
    for (let c = Math.floor(az0 / (360 / n)); c <= Math.floor(az1 / (360 / n)); c++) {
      for (let r = r0; r <= r1; r++) {
        tiles.push({
          key: `${z}/${c}/${r}`, uri: tileUri(pano.id, z, ((c % n) + n) % n, r),
          x: ((c * 360) / n - leftAz) / k - ox, y: ((r * 180) / n - (90 - top)) / k, w: tw, h: th,
        });
      }
    }
  }
  const sphereW = 360 / k;
  const under: TileSpec[] = [];
  for (let m = Math.floor(az0 / 360); m <= Math.floor(az1 / 360); m++) {
    under.push({ key: `u${m}`, uri: tileUri(pano.id, 0, 0, 0), x: (m * 360 - leftAz) / k - ox, y: -(90 - top) / k, w: sphereW, h: sphereW / 2 });
  }
  return { tiles, under };
}

export function PanoView({ pano, panos, view, onView, onWalk }: {
  pano: Pano;
  panos: Panos;
  view: ViewState;
  onView: (v: ViewState) => void;
  onWalk: (id: string, heading: number) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const v = size.w ? clampView(view, size.w, size.h, pano) : view;
  // Keep the owner's state inside the limits too, so keys and the wheel never wind up past them.
  useEffect(() => {
    if (size.w && (v.f !== view.f || v.p !== view.p)) onView(v);
  }, [size.w, size.h, view.f, view.p, v.f, v.p]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gestures read the latest values through a ref (the responder is created once).
  const live = useRef({ v, size, onView, pano });
  live.current = { v, size, onView, pano };
  const start = useRef<{ v: ViewState; dist: number | null }>({ v, dist: null });
  const frame = useRef<number | null>(null);
  const pending = useRef<ViewState | null>(null);
  const push = useCallback((n: ViewState) => {
    pending.current = n;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const { size: s, onView: set, pano: p } = live.current;
      if (pending.current && s.w) set(clampView(pending.current, s.w, s.h, p));
    });
  }, []);
  // Momentum: a flick keeps turning and eases to a stop; touching again catches it.
  const spin = useRef<number | null>(null);
  const stopSpin = useCallback(() => { if (spin.current !== null) { cancelAnimationFrame(spin.current); spin.current = null; } }, []);
  const startSpin = useCallback((degPerMs: number) => {
    stopSpin();
    let vel = degPerMs, last = Date.now();
    const step = () => {
      const now = Date.now(), dt = Math.min(48, now - last);
      last = now;
      vel *= Math.pow(0.996, dt); // about 1.5 s to settle
      const { v: cur, size: s, onView: set, pano: p } = live.current;
      if (Math.abs(vel) < 0.002 || !s.w) { spin.current = null; return; }
      set(clampView({ ...cur, h: cur.h + vel * dt }, s.w, s.h, p));
      spin.current = requestAnimationFrame(step);
    };
    spin.current = requestAnimationFrame(step);
  }, [stopSpin]);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    stopSpin();
  }, [stopSpin]);
  useEffect(stopSpin, [pano.id, stopSpin]); // walking to another panorama stops the spin

  const pan = useMemo(() => {
    const touchDist = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      return t && t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : null;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => { stopSpin(); start.current = { v: live.current.v, dist: touchDist(e) }; },
      onPanResponderMove: (e, g) => {
        const { size: s } = live.current;
        if (!s.w) return;
        const d = touchDist(e);
        if (d !== null) {
          // Second finger down mid-drag: restart from here so the view doesn't jump.
          if (start.current.dist === null) { start.current = { v: live.current.v, dist: d }; return; }
          push({ ...start.current.v, f: (start.current.v.f * start.current.dist) / d });
          return;
        }
        if (start.current.dist !== null) { start.current = { v: live.current.v, dist: null }; return; }
        const k = start.current.v.f / s.w; // degrees per point
        push({ ...start.current.v, h: start.current.v.h - g.dx * k, p: start.current.v.p + g.dy * k });
      },
      onPanResponderRelease: (_, g) => {
        const { size: s, v: cur } = live.current;
        // A one-finger flick (points per ms) becomes a turning speed in degrees per ms.
        if (start.current.dist === null && s.w && Math.abs(g.vx) > 0.15) startSpin(-g.vx * (cur.f / s.w));
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [push, stopSpin, startSpin]);

  // Mouse wheel / trackpad pinch on web.
  const box = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = box.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = live.current.v;
      push({ ...cur, f: cur.f * Math.exp(e.deltaY * 0.0015) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [push]);

  const { w: W, h: H } = size;
  const k = W ? v.f / W : 1; // degrees per point
  const span = stripSpan(pano), full = span === 360;
  const uLeft = v.h - v.f / 2, top = v.p + (H * k) / 2; // strip position at the left edge, elevation at the top
  const azL = pano.heading - span / 2; // bearing at strip position 0
  const centerAz = stripToAz(pano, v.h);

  // Tile level: enough texels for the screen's pixels, capped at what was built.
  const texelsPerPt = (panos.tile * 2 ** pano.max_zoom) / (360 / k);
  let z = pano.max_zoom;
  while (z > 0 && texelsPerPt / 2 ** (pano.max_zoom - z + 1) >= PixelRatio.get() * 0.9) z--;

  // One continuous plane for a full circle; for a partial strip, one clipped copy per repeat.
  const copies: { key: string; x0: number; x1: number; leftAz: number; tiles: TileSpec[]; under: TileSpec[] }[] = [];
  const seams: number[] = [];
  if (W) {
    if (full) {
      const leftAz = azL + uLeft;
      copies.push({ key: "all", x0: 0, x1: W, leftAz, ...plane(pano, z, k, top, H, leftAz, leftAz, leftAz + v.f, 0) });
    } else {
      for (let m = Math.floor(uLeft / span); m <= Math.floor((uLeft + v.f) / span); m++) {
        const x0 = Math.max(0, (m * span - uLeft) / k), x1 = Math.min(W, ((m + 1) * span - uLeft) / k);
        if (x1 - x0 < 0.5) continue;
        const leftAz = azL + uLeft - m * span; // bearing at screen x = 0, for this copy
        copies.push({ key: `c${m}`, x0, x1, leftAz, ...plane(pano, z, k, top, H, leftAz, leftAz + x0 * k, leftAz + x1 * k, x0) });
        if (x0 > 0.5) seams.push(x0);
      }
    }
  }

  // Compass strip at true bearings: names every 45° (the one faced in accent); ticks closer together
  // as you zoom in, numbered between the names so a narrow view always has a bearing on it.
  const marks: { x: number; label: string | null; on: boolean }[] = [];
  const step = v.f > 60 ? 15 : v.f > 25 ? 5 : v.f > 10 ? 2 : 1;
  if (W) {
    for (const c of copies) {
      for (let a = Math.ceil((c.leftAz + c.x0 * k) / step) * step; a <= c.leftAz + c.x1 * k; a += step) {
        const az = ((Math.round(a) % 360) + 360) % 360;
        const name = az % 45 === 0 ? CARDINAL[az / 45] : step < 15 && az % (step * (v.f > 25 ? 3 : 2)) === 0 ? String(az).padStart(3, "0") : null;
        const x = (a - c.leftAz) / k;
        if (name && (x < 16 || x > W - 16)) continue; // a name cut by the edge reads wrong ("NE" as "E")
        marks.push({ x, label: name, on: az % 45 === 0 && Math.abs(diff180(az, centerAz)) <= 22.5 });
      }
    }
  }

  // Walking arrows: on the ground at their bearing when it is in view. Otherwise a chip at the nearer
  // edge: it turns toward the link, or walks straight there when that bearing has no imagery.
  const links = pano.links.map(l => {
    const u0 = azToStrip(pano, l.heading);
    const u = u0 === null ? null : nearestCopy(pano, u0, v.h);
    const rel = u === null ? diff180(l.heading, centerAz) / k : (u - v.h) / k; // screen points from the centre
    return { ...l, u, rel, inView: u !== null && Math.abs(rel) < W / 2 - 24, name: panos.byId[l.pano]?.title ?? l.description };
  });

  return (
    // Web: "clip", not "hidden": the browser scrolls a hidden-overflow box to show a focused arrow,
    // which shifts every overlay off its place (the map had the same problem).
    <View ref={box} onLayout={onLayout} {...pan.panHandlers} style={{ flex: 1, overflow: Platform.OS === "web" ? "clip" : "hidden", backgroundColor: C.bg0, cursor: "grab" } as object}>
      {copies.map(c => (
        <View key={c.key} pointerEvents="none" style={{ position: "absolute", left: c.x0, width: c.x1 - c.x0, top: 0, bottom: 0, overflow: Platform.OS === "web" ? "clip" : "hidden" } as object}>
          {c.under.map(t => (
            <Image key={t.key} source={{ uri: t.uri }} resizeMode="stretch" fadeDuration={0}
              style={{ position: "absolute", left: t.x, top: t.y, width: t.w + 0.5, height: t.h }} />
          ))}
          {c.tiles.map(t => <Tile key={t.key} uri={t.uri} x={t.x} y={t.y} w={t.w} h={t.h} />)}
        </View>
      ))}
      {seams.map(x => (
        <View key={`s${x}`} pointerEvents="none" style={{ position: "absolute", left: x - 0.5, top: 36, bottom: 0, width: 1, backgroundColor: "rgba(20,11,9,0.55)", zIndex: 1 }} />
      ))}

      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 36, zIndex: 2 }}>
        <LinearGradient colors={["rgba(20,11,9,0.8)", "rgba(20,11,9,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        {marks.map((m, i) => (
          <View key={i} style={{ position: "absolute", left: m.x - 20, width: 40, top: 0, height: 36, alignItems: "center", justifyContent: "center" }}>
            {m.label
              ? <T w={600} size={10} ls={1} color={m.on ? C.accent : C.fg2}>{m.label}</T>
              : <View style={{ width: 1, height: 5, backgroundColor: "rgba(248,236,228,0.35)" }} />}
          </View>
        ))}
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: W / 2 - 0.5, top: 36, bottom: 0, width: 1, backgroundColor: "rgba(127,212,193,0.35)", zIndex: 2 }} />

      {links.filter(l => l.inView).map(l => (
        <Pressable
          key={l.pano}
          accessibilityRole="button"
          accessibilityLabel={`Walk to ${l.name}, ${Math.round(l.distance_m)} metres ${compassName(l.heading)}`}
          onPress={() => onWalk(l.pano, l.heading)}
          style={{ position: "absolute", left: W / 2 + l.rel - 100, width: 200, bottom: 78, alignItems: "center", gap: 6, zIndex: 3 }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", boxShadow: "0px 8px 20px rgba(10,4,2,0.45)" }}>
            <Chevron />
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: alpha("bg1", 0.85), maxWidth: 200, alignItems: "center" }}>
            <T w={700} size={9.5} ls={0.4} color={C.accent2} numberOfLines={1}>{l.name.toUpperCase()}</T>
            <T w={600} size={9} ls={0.3} color={C.fg2}>{`${Math.round(l.distance_m)} m ${compassName(l.heading)}`}</T>
          </View>
        </Pressable>
      ))}
      {(["left", "right"] as const).map(side => {
        const out = links.filter(l => !l.inView && (side === "left" ? l.rel < 0 : l.rel >= 0));
        if (!out.length) return null;
        return (
          <View key={side} style={{ position: "absolute", top: 52, [side]: 10, gap: 6, alignItems: side === "left" ? "flex-start" : "flex-end", zIndex: 3 }}>
            {out.map(l => {
              const turn = l.u !== null; // the link's bearing has imagery: turn to face it; else walk straight there
              return (
                <Pressable
                  key={l.pano}
                  accessibilityRole="button"
                  accessibilityLabel={turn ? `Turn toward ${l.name}` : `Walk to ${l.name}, ${Math.round(l.distance_m)} metres ${compassName(l.heading)}`}
                  onPress={() => (turn ? onView({ ...v, h: l.u as number }) : onWalk(l.pano, l.heading))}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: alpha(turn ? "bg1" : "accent", turn ? 0.85 : 0.9) }}
                >
                  {side === "left" && <T w={700} size={11} color={turn ? C.accent : C.accentInk}>‹</T>}
                  <T w={700} size={9.5} ls={0.4} color={turn ? C.fg2 : C.accentInk} numberOfLines={1}>
                    {`${turn ? "" : "WALK TO "}${l.name.toUpperCase()} ${Math.round(l.distance_m)} m`}
                  </T>
                  {side === "right" && <T w={700} size={11} color={turn ? C.accent : C.accentInk}>›</T>}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
