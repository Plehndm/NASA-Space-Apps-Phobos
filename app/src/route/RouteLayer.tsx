// Routes on the map: dark casing under a 3.5 px route line, segments over 12° drawn again in warm, the
// driven part dimmed, the alternative route as dots, and midpoint pills ("time · distance" on the active
// route; tap the alternative's pill to switch). Drawn 1:1 in the map overlay, like the hazard outlines.
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useApp } from "../state/store";
import { alpha, C } from "../theme";
import { T } from "../ui/Text";
import type { Pt } from "../map/geo";
import { Pin, useMapView } from "../map/view";
import { useRoutes } from "./RouteProvider";
import { fmtKm, fmtMin } from "./format";
import { midOf, type Route } from "./router";

const PAD = 240; // screen px drawn beyond each edge, so panning between redraws shows no gaps

interface Drawn {
  main: Pt[] | null;
  steep: [Pt, Pt][];
  done: Pt[] | null;
  alt: Pt[] | null;
  pill: { p: Pt; text: string } | null;
  altPill: { p: Pt; text: string; onPress: () => void } | null;
}

/** What the current card wants drawn. */
function useDrawn(): Drawn {
  const { state: S } = useApp();
  const r = useRoutes();
  const none: Drawn = { main: null, steep: [], done: null, alt: null, pill: null, altPill: null };
  if (!r.ready) return none;

  if (S.mode === "nav" && S.nav) {
    // Driving: the remaining route from the rover, the driven part dimmed, "x min left" on the pill.
    const n = S.nav;
    const done: Pt[] = [];
    for (let i = 0; i < n.pts.length && n.cum[i] <= n.prog; i++) done.push(n.pts[i]);
    done.push(S.rover);
    const todo = [S.rover as Pt, ...n.pts.filter((_, i) => n.cum[i] > n.prog)];
    const tp = r.profileOf(todo);
    return {
      main: todo, steep: tp?.steep ?? [], done, alt: null, altPill: null,
      pill: tp && todo.length > 1 ? { p: midOf(todo), text: `${fmtMin(tp.min)} left` } : null,
    };
  }

  // Planning: the selected target (after any stops) or the sequence.
  const ids = S.mode === "waypoint" && S.sel ? [...S.stops.filter(id => id !== S.sel), S.sel] : S.mode === "route" || S.mode === "layers" ? S.stops : [];
  if (!ids.length) return none;
  const o = r.routeOpts(ids);
  if (!o) return none;
  const sel = S.mode === "waypoint" ? r.lm(S.sel) : null;
  const blocked = sel ? r.blockedBy(sel) : null, overridden = !!sel && S.override === sel.id;
  const gradeFail = !o.direct.ok && !o.safe.ok;
  if (sel && ((!!blocked && !overridden) || (gradeFail && !(overridden && o.direct.ok)))) return none; // "No safe route"
  const useSafe = S.routeOpt === 2 && o.safe.ok;
  const act: Route = useSafe ? o.safe : o.direct;
  const alt: Route | null = useSafe ? o.direct : o.safe.ok ? o.safe : null;
  const showAlt = !!alt && Math.abs(alt.px - act.px) > 0.5;
  return {
    main: act.pts, steep: act.steep, done: null, alt: showAlt && alt ? alt.pts : null,
    pill: { p: midOf(act.pts), text: `${fmtMin(act.min)} · ${fmtKm(act.px)}` },
    altPill: showAlt && alt ? { p: midOf(alt.pts), text: `${fmtMin(alt.min)} · ${useSafe ? "direct" : "safe"}`, onPress: () => r.pickRoute(useSafe ? 1 : 2) } : null,
  };
}

const d = (pts: Pt[], f: (p: Pt) => Pt) => pts.map((p, i) => { const q = f(p); return `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join("");

export function RouteLayer() {
  const { vp } = useMapView();
  const drawn = useDrawn();
  const steep = drawn.steep, pillText = drawn.pill?.text ?? "";
  if (!drawn.main && !drawn.alt) return null;
  const s0 = vp.s, ax = (-PAD - vp.tx) / s0, ay = (-PAD - vp.ty) / s0;
  const local = (p: Pt) => ({ x: (p.x - ax) * s0, y: (p.y - ay) * s0 });
  return (
    <>
      <Pin x={ax} y={ay} scaleFrom={s0}>
        <Svg width={vp.w + 2 * PAD} height={vp.h + 2 * PAD} pointerEvents="none">
          {drawn.alt && <Path d={d(drawn.alt, local)} fill="none" stroke={C.fg3} strokeOpacity={0.8} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 7" />}
          {drawn.done && drawn.done.length > 1 && <Path d={d(drawn.done, local)} fill="none" stroke={C.bg1} strokeOpacity={0.4} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />}
          {drawn.main && <Path d={d(drawn.main, local)} fill="none" stroke={C.bg1} strokeOpacity={0.6} strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round" />}
          {drawn.done && drawn.done.length > 1 && <Path d={d(drawn.done, local)} fill="none" stroke={C.route2} strokeOpacity={0.28} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
          {drawn.main && <Path d={d(drawn.main, local)} fill="none" stroke={C.route} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />}
          {steep.length > 0 && <Path d={steep.map(([a, b]) => d([a, b], local)).join("")} fill="none" stroke={C.warm} strokeWidth={3.5} strokeLinecap="round" />}
        </Svg>
      </Pin>
      {drawn.altPill && (
        <Pin x={drawn.altPill.p.x} y={drawn.altPill.p.y} zIndex={6}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${drawn.altPill.text}`}
            onPress={drawn.altPill.onPress}
            style={{ position: "absolute", left: -90, width: 180, bottom: 4, alignItems: "center" }}
          >
            <View style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: alpha("bg1", 0.92), boxShadow: "0px 4px 12px rgba(10,4,2,0.4)" }}>
              <T w={700} size={10} ls={0.3} color={C.fg2} numberOfLines={1}>{drawn.altPill.text}</T>
            </View>
          </Pressable>
        </Pin>
      )}
      {drawn.pill && pillText !== "" && (
        // Route pills draw above landmark labels: the active route's time matters more than a name.
        <Pin x={drawn.pill.p.x} y={drawn.pill.p.y} zIndex={7}>
          <View pointerEvents="none" style={{ position: "absolute", left: -90, width: 180, bottom: 4, alignItems: "center" }}>
            <View style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: C.route, boxShadow: "0px 6px 16px rgba(10,4,2,0.45)" }}>
              <T w={700} size={10.5} ls={0.3} color={C.routeInk} numberOfLines={1}>{pillText}</T>
            </View>
          </View>
        </Pin>
      )}
    </>
  );
}

