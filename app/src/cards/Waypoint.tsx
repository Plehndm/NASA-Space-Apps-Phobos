// Waypoint card (sheet mode "waypoint"): target hero card, the two route options, the elevation
// profile and Add stop / Street Level / NAVIGATE; or the "No safe route found" block with its two ways
// out. Routes come from src/route/ on the real terrain.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useApp } from "../state/store";
import { C, R, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { fmtLatLon } from "../map/geo";
import { ElevationProfile } from "../route/ElevationProfile";
import { useRoutes } from "../route/RouteProvider";
import { deg, fmtElev, fmtKm, fmtMin } from "../route/format";
import { bearing, diff180, panoNear, STREET_RADIUS_KM, usePanos } from "../street/panos";
import type { Landmark } from "../map/landmarks";

export function NoteBubble({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 6, backgroundColor: "rgba(127,212,193,0.09)" }}>
      <T size={12} lh={1.5} color={C.accent}>✦</T>
      <T w={500} size={12} lh={1.5} color={C.accent2} style={{ flex: 1 }}>{children}</T>
    </View>
  );
}

export function WarnIcon({ color = C.danger }: { color?: string }) {
  return (
    <Svg pointerEvents="none" viewBox="0 0 16 16" width={16} height={16} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M8 2.5 14 13H2Z" />
      <Path d="M8 6.5v3M8 11.2v.3" />
    </Svg>
  );
}

function RoutePick({ title, sub, subColor, on, onPress, leftCorner }: { title: string; sub: string; subColor: string; on: boolean; onPress: () => void; leftCorner: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{
        flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5,
        borderColor: on ? C.accent : "transparent", backgroundColor: on ? "rgba(127,212,193,0.1)" : C.row,
        borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: leftCorner ? 8 : 20, borderBottomRightRadius: leftCorner ? 20 : 8,
      }}
    >
      <T w={700} size={10.5} ls={0.6}>{title}</T>
      <T w={500} size={10.5} lh={1.35} color={subColor} style={{ marginTop: 4 }}>{sub}</T>
    </Pressable>
  );
}

export function WaypointCard() {
  const { state: S, settings, toast } = useApp();
  const r = useRoutes();
  const sel = r.lm(S.sel);
  if (!sel) return null;
  const ids = [...S.stops.filter(id => id !== sel.id), sel.id];
  const o = r.routeOpts(ids);
  const elev = r.elevOf(sel);
  const meta = `${sel.cat.toUpperCase()} · ${fmtLatLon(sel)} · ${fmtElev(elev, true)}`;

  const hero = (body: ReactNode, eta: string, km: string) => (
    <View style={[{ position: "relative", overflow: "hidden", backgroundColor: C.card, padding: 16 }, R.pebble]}>
      <View pointerEvents="none" style={{ position: "absolute", right: -40, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(236,122,86,0.14)" }} />
      <View pointerEvents="none" style={{ position: "absolute", right: 30, top: 40, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,195,148,0.06)" }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flexShrink: 1 }}>
          <T w={700} size={10.5} ls={1.2} color={C.warm}>TARGET</T>
          <T w={700} size={22} ls={-0.5} lh={1.15} style={{ marginTop: 3 }}>{sel.name}</T>
          <T w={500} size={10.5} ls={0.2} color={C.fg2} style={{ marginTop: 6 }}>{meta}</T>
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <T w={600} size={9.5} ls={0.6} color={C.fg2}>ESTIMATED TRANSIT</T>
          <T w={700} size={15} ls={-0.2} color={C.accent2} style={{ marginTop: 3 }}>{eta}</T>
          <T w={500} size={9.5} color={C.fg2} style={{ marginTop: 2 }}>{km}</T>
        </View>
      </View>
      <T w={500} size={13} lh={1.5} color={C.fg2} style={{ marginTop: 10 }}>{sel.desc}</T>
      {settings.inlineNotes && <NoteBubble>{sel.note}</NoteBubble>}
      {body}
    </View>
  );

  if (!o) return hero(<T w={500} size={12} color={C.fg3} style={{ marginTop: 12 }}>{r.ready ? "Planning routes…" : "Loading terrain…"}</T>, "…", "planning");

  const blocked = r.blockedBy(sel), overridden = S.override === sel.id;
  const gradeFail = !o.direct.ok && !o.safe.ok;
  const noRoute = (!!blocked && !overridden) || (gradeFail && !(overridden && o.direct.ok));
  const useSafe = S.routeOpt === 2 && o.safe.ok;
  const act = useSafe ? o.safe : o.direct;
  const via = S.stops.filter(id => id !== sel.id).length;

  if (noRoute) {
    let why = "";
    if (blocked && !overridden) why = `${sel.name} sits inside the ${blocked.name.toLowerCase()} zone (${blocked.detail}). Every approach crosses it.`;
    else {
      const need = r.neededGrade(ids);
      why = `No path keeps the rover under the ${r.capDirect}° grade limit.` + (need ? ` The gentlest approach needs ${/^(8|11|18)$/.test(String(need)) ? "an" : "a"} ${deg(need)} limit to reach ${fmtElev(elev, true)}.` : " Even a 60° limit can't reach it.");
    }
    return hero(
      <View style={{ marginTop: 12, padding: 14, borderRadius: 20, backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBd }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <WarnIcon />
          <T w={700} size={12} ls={0.8} color={C.danger}>NO SAFE ROUTE FOUND</T>
        </View>
        <T w={500} size={12.5} lh={1.5} style={{ marginTop: 6 }}>{why}</T>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable onPress={r.goSafeApproach} accessibilityRole="button" style={{ flex: 1, height: 42, borderRadius: 999, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}>
            <T w={600} size={13}>{gradeFail ? "Nearest reachable point" : "Nearest safe approach"}</T>
          </Pressable>
          <Pressable onPress={r.overrideRisk} accessibilityRole="button" style={{ flex: 1, height: 42, borderRadius: 999, borderWidth: 1.5, borderColor: C.danger, alignItems: "center", justifyContent: "center" }}>
            <T w={600} size={13} color={C.danger}>{gradeFail ? "Override grade limit" : "Override at risk"}</T>
          </Pressable>
        </View>
      </View>,
      "NO ROUTE",
      blocked && !overridden ? "inside hazard zone" : `exceeds ${r.capDirect}° limit`,
    );
  }

  const crosses = o.direct.cross.map(id => r.zones.find(z => z.id === id)?.name.toLowerCase()).filter(Boolean).join(", ");
  const r1Sub = !o.direct.ok ? `no path ≤ ${r.capDirect}°` : crosses ? `${fmtMin(o.direct.min)} · max ${deg(o.direct.maxGrade)} · crosses ${crosses}` : `${fmtMin(o.direct.min)} · max ${deg(o.direct.maxGrade)} · clear`;
  const r2Sub = o.safe.ok ? `${fmtMin(o.safe.min)} · max ${deg(o.safe.maxGrade)} · ${o.safe.cross.length ? "residual risk" : "hazard-free"}` : `no path ≤ ${r.capSafe}° · try Route #1`;
  const start = r.elevOf(S.rover);

  return hero(
    <>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <RoutePick title="ROUTE #1 · DIRECT" sub={r1Sub} subColor={crosses ? C.danger : C.accent2} on={!useSafe} onPress={() => r.pickRoute(1)} leftCorner />
        <RoutePick title="ROUTE #2 · SAFE" sub={r2Sub} subColor={C.accent2} on={useSafe} onPress={() => r.pickRoute(2)} leftCorner={false} />
      </View>
      <View style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.row }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <T w={600} size={9.5} ls={0.5} color={C.fg2} numberOfLines={1} style={{ flexShrink: 1 }}>ELEVATION PROFILE</T>
          <T w={600} size={9.5} ls={0.5} color={C.warm}>{`MAX ${deg(act.maxGrade)} · ↑${Math.round(act.asc)} m ↓${Math.round(act.desc)} m`}</T>
        </View>
        <ElevationProfile samples={act.samples} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
          <T w={500} size={9.5} color={C.fg3}>{`${fmtElev(start)} · rover`}</T>
          <T w={500} size={9.5} color={C.fg3} numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>{`${fmtElev(elev)} · ${sel.name}`}</T>
        </View>
        <T w={500} size={9.5} ls={0.3} color={C.fg3} style={{ marginTop: 4 }}>{`ROVER LIMIT ${r.capSafe}° · DIRECT ${r.capDirect}° · PEACH = GRADE OVER 12°`}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Pressable onPress={r.addStopSel} accessibilityRole="button" style={{ height: 50, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.raised, justifyContent: "center" }}>
          <T w={600} size={14}>Add stop</T>
        </Pressable>
        <StreetButton l={sel} />
        <Pressable
          onPress={r.startNav}
          accessibilityRole="button"
          style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 999, backgroundColor: pressed ? C.ctaHover : C.cta, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: SHADOW.glow })}
        >
          <T w={800} size={17} ls={-0.2} color={C.ctaInk}>NAVIGATE</T>
          <Svg pointerEvents="none" viewBox="0 0 16 16" width={16} height={16} fill="none" stroke={C.ctaInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 8h10M9 4l4 4-4 4" />
          </Svg>
        </Pressable>
      </View>
    </>,
    fmtMin(act.min),
    `${fmtKm(act.px)} · max ${deg(act.maxGrade)}${via ? ` · via ${via} stop${via > 1 ? "s" : ""}` : ""}`,
  );
}

/** Eye button: opens Street Level at the nearest rover panorama, facing the waypoint. Dimmed when none is close. */
function StreetButton({ l }: { l: Landmark }) {
  const { patch, toast } = useApp();
  const panos = usePanos();
  const near = panoNear(panos, l);
  const open = () => {
    if (!near) {
      toast(panos === undefined ? "Loading rover panoramas…" : `No rover panorama within ${STREET_RADIUS_KM} km of ${l.name}`);
      return;
    }
    // Face the waypoint when it's off in the distance and inside the imagery; otherwise (standing on
    // it, its own panorama, or no imagery that way) face the centre of the image.
    const b = bearing(near.pano, l), p = near.pano;
    const visible = Math.abs(diff180(b, p.heading)) <= p.hfov / 2 - 15;
    const heading = near.km >= 0.15 && p.waypoint !== l.id && visible ? b : p.heading;
    patch({ street: { pano: near.pano.id, heading, from: l.id } });
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={near ? `Street level: ${near.pano.title}` : "Street level (no panorama nearby)"}
      style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", opacity: near ? 1 : 0.45 }}
    >
      <Svg pointerEvents="none" viewBox="0 0 20 20" width={20} height={20} fill="none" stroke={C.accent2} strokeWidth={1.6}>
        <Path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
        <Circle cx="10" cy="10" r="2.5" />
      </Svg>
    </Pressable>
  );
}
