// Expedition (sheet mode "nav"), the ETA card pinned above the search bar while driving, and the
// Arrived screen. The simulation itself runs in src/route/RouteProvider.tsx.
import { Pressable, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useApp } from "../state/store";
import { C, R } from "../theme";
import { T } from "../ui/Text";
import { ElevationProfile } from "../route/ElevationProfile";
import { arrivalMtc, crossingAhead, useRoutes } from "../route/RouteProvider";
import { deg, fmtElev, fmtKm, fmtMin } from "../route/format";
import { NoteBubble, WarnIcon } from "./Waypoint";
import type { Pt } from "../map/geo";

/** Everything the expedition cards show, from the running nav. */
function useNavView() {
  const { state: S } = useApp();
  const r = useRoutes();
  const n = S.nav;
  if (!n) return null;
  const total = n.cum[n.cum.length - 1], pct = total ? n.prog / total : 0;
  const tgt = r.lm(n.stops[n.legIdx]);
  const legEnd = n.cum[n.legEnds[n.legIdx + 1]];
  const remPx = Math.max(0, legEnd - n.prog);
  const legs = n.stops.map((_, i) => {
    const a = n.cum[n.legEnds[i]], b = n.cum[n.legEnds[i + 1]];
    return { flex: Math.max(1, Math.round((b - a) / 10)), fill: Math.max(0, Math.min(1, (n.prog - a) / (b - a || 1))) };
  });
  const ahead = n.pts.filter((_, i) => n.cum[i] > n.prog);
  const todo: Pt[] = [S.rover, ...ahead];
  const legPts: Pt[] = [S.rover, ...n.pts.filter((_, i) => n.cum[i] > n.prog && i <= n.legEnds[n.legIdx + 1])];
  const legProf = r.profileOf(legPts), todoProf = r.profileOf(todo), whole = r.profileOf(n.pts);
  const last = r.lm(n.stops[n.stops.length - 1]);
  const nh = r.nearestHazard(S.rover);

  let warn = "", fix = false;
  const cross = crossingAhead(ahead, S.rover, r.zones, last);
  if (cross) { warn = `ROUTE AHEAD CROSSES ${cross.name.toUpperCase()} · ${cross.detail}`; fix = true; }
  else if (nh && nh.km < 2.5) {
    // Port = the rover's left: the zone's bearing relative to the heading, in (-180°, 180°].
    const bearing = (Math.atan2(nh.z.x - S.rover.x, -(nh.z.y - S.rover.y)) * 180) / Math.PI;
    const rel = ((bearing - S.rover.h + 540) % 360) - 180;
    warn = `WARNING · ${nh.z.name.toUpperCase()} ${nh.km.toFixed(1)} KM OFF THE ${rel < 0 ? "PORT" : "STARBOARD"} SIDE`;
  }
  else if (n.grade > 15) warn = `STEEP SECTION · ${Math.round(n.grade)}° GRADE · ROVER AUTO-LIMITED TO ${n.spd} KM/H`;

  return {
    n, total, pct, tgt, legs, warn, fix, last, todoProf, whole,
    legTitle: `Leg ${n.legIdx + 1} of ${n.stops.length}: ${tgt?.name ?? "—"}`,
    legShort: `Leg ${n.legIdx + 1}/${n.stops.length}`,
    remain: `${fmtKm(remPx)} (${fmtMin(legProf?.min ?? 0)}) · max ${deg(legProf?.maxGrade ?? 0)}`,
    hazName: nh ? nh.z.name : "Clear",
    hazDist: nh ? `${nh.km.toFixed(1)} km clear` : "no hazards tracked",
    hazFg: nh && nh.km < 2.5 ? C.danger : C.warm2,
    posLabel: `YOU · ${fmtKm(n.prog)} of ${fmtKm(total)} · ${fmtElev(r.elevOf(S.rover))}`,
    endLabel: last ? `${fmtElev(r.elevOf(last))} · ${last.name}` : "",
  };
}

function Btn({ label, onPress, flex = 1, bg = C.raised, fg = C.fg, border, h = 42, w }: { label: string; onPress: () => void; flex?: number; bg?: string; fg?: string; border?: string; h?: number; w?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flex: w ? undefined : flex, width: w, height: h, borderRadius: 999, backgroundColor: bg, borderWidth: 1.5, borderColor: border ?? "transparent", alignItems: "center", justifyContent: "center" }}
    >
      <T w={label === "END" ? 800 : 700} size={10.5} ls={0.6} color={fg}>{label}</T>
    </Pressable>
  );
}

export function ExpeditionCard() {
  const { state: S, settings } = useApp();
  const r = useRoutes();
  const v = useNavView();
  if (!v) return null;
  const reroute = { label: "REROUTE", onPress: r.toggleReroute, bg: S.viaPending ? "rgba(127,212,193,0.12)" : C.raised, border: S.viaPending ? C.accent : "transparent" };

  return (
    <>
      {!!v.warn && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingLeft: 14, paddingRight: 12, borderRadius: 20, backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBd }}>
          <WarnIcon />
          <T w={700} size={10} ls={0.4} lh={1.45} color={C.danger} style={{ flex: 1 }}>{v.warn}</T>
          {v.fix && <Btn label="REROUTE" onPress={r.autoReroute} h={32} w={86} />}
        </View>
      )}
      {S.viaPending && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingLeft: 16, paddingRight: 12, borderRadius: 20, backgroundColor: "rgba(127,212,193,0.1)", borderWidth: 1, borderColor: "rgba(127,212,193,0.35)" }}>
          <T w={600} size={11} lh={1.45} color={C.accent2} style={{ flex: 1 }}>MANUAL REROUTE · tap the map to place a via-point</T>
          <Btn label="CANCEL" onPress={r.toggleReroute} h={32} w={80} />
        </View>
      )}

      {settings.progressCard === "compact" ? (
        <>
          <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, paddingVertical: 12, paddingHorizontal: 14 }, R.pebble]}>
            <View style={{ width: 46, height: 46 }}>
              <Svg pointerEvents="none" viewBox="0 0 44 44" width={46} height={46} style={{ transform: [{ rotate: "-90deg" }] }}>
                <Circle cx={22} cy={22} r={18} fill="none" stroke={C.raised} strokeWidth={4} />
                <Circle cx={22} cy={22} r={18} fill="none" stroke={C.accent} strokeWidth={4} strokeLinecap="round" strokeDasharray="113" strokeDashoffset={113 * (1 - v.pct)} />
              </Svg>
              <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                <T w={700} size={9.5} color={C.accent2}>{`${Math.round(v.pct * 100)}%`}</T>
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w={700} size={14} numberOfLines={1}>{v.tgt?.name ?? "—"}</T>
              <T w={500} size={10.5} color={C.fg2} style={{ marginTop: 2 }} numberOfLines={1}>{`${v.legShort} · ${v.remain}`}</T>
              <T w={700} size={9.5} ls={0.3} color={v.hazFg} style={{ marginTop: 3 }} numberOfLines={1}>{`${v.hazName} · ${v.hazDist}`}</T>
            </View>
            <Btn label="END" onPress={r.endNav} bg={C.dangerDeep} fg="#fff" h={38} w={52} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="ADD STOP" onPress={r.addStopSearch} h={36} />
            <Btn {...reroute} h={36} />
          </View>
        </>
      ) : (
        <View style={[{ backgroundColor: C.card, paddingVertical: 14, paddingHorizontal: 16, overflow: "hidden" }, R.pebble]}>
          <View pointerEvents="none" style={{ position: "absolute", right: -50, top: -60, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(127,212,193,0.07)" }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T w={700} size={10} ls={1} color={C.warm}>EXPEDITION PROGRESS</T>
            <T w={700} size={11} color={C.fg2}>{`${Math.round(v.pct * 100)}%`}</T>
          </View>
          <T w={700} size={20} ls={-0.5} lh={1.2} style={{ marginTop: 4 }}>{v.legTitle}</T>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }}>
            {v.legs.map((lg, i) => (
              <View key={i} style={{ flex: lg.flex, height: 8, borderRadius: 4, backgroundColor: C.raised, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${lg.fill * 100}%`, backgroundColor: C.accent, borderRadius: 4 }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, minWidth: 0, backgroundColor: C.row, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 }}>
              <T w={600} size={9} ls={0.6} color={C.fg2}>TARGET WAYPOINT</T>
              <T w={700} size={14} numberOfLines={1} style={{ marginTop: 3 }}>{v.tgt?.name ?? "—"}</T>
              <T w={500} size={11} color={C.accent2} style={{ marginTop: 2 }} numberOfLines={2}>{v.remain}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0, backgroundColor: C.row, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 }}>
              <T w={600} size={9} ls={0.6} color={C.fg2}>HAZARD RADAR SCAN</T>
              <T w={700} size={14} color={C.warm3} numberOfLines={1} style={{ marginTop: 3 }}>{v.hazName}</T>
              <T w={700} size={11} color={v.hazFg} style={{ marginTop: 2 }}>{v.hazDist}</T>
            </View>
          </View>
          <View style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.row }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <T w={600} size={9.5} ls={0.5} color={C.fg2} numberOfLines={1} style={{ flexShrink: 1 }}>{`GRADE ${deg(v.n.grade)} · ${v.n.spd} km/h`}</T>
              <T w={600} size={9.5} ls={0.5} color={C.warm}>{`↑${Math.round(v.todoProf?.asc ?? 0)} m ↓${Math.round(v.todoProf?.desc ?? 0)} m · ${fmtMin(v.todoProf?.min ?? 0)} LEFT`}</T>
            </View>
            {v.whole && <ElevationProfile samples={v.whole.samples} height={40} at={v.n.prog} />}
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
              <T w={600} size={9.5} color={C.warm3} numberOfLines={1} style={{ flexShrink: 1 }}>{v.posLabel}</T>
              <T w={600} size={9.5} color={C.fg3} numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>{v.endLabel}</T>
            </View>
          </View>
          {settings.inlineNotes && !!v.tgt?.note && <NoteBubble>{v.tgt.note}</NoteBubble>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Btn label="ADD STOP" onPress={r.addStopSearch} />
            <Btn {...reroute} />
            <Btn label="END" onPress={r.endNav} bg={C.dangerDeep} fg="#fff" w={68} />
          </View>
        </View>
      )}
    </>
  );
}

/** Pinned above the search bar while driving: arrival time (MTC), time left, distance left. */
export function EtaCard() {
  const { state: S } = useApp();
  const r = useRoutes();
  const n = S.nav;
  if (!n) return null;
  const total = n.cum[n.cum.length - 1];
  const todo = [S.rover as Pt, ...n.pts.filter((_, i) => n.cum[i] > n.prog)];
  const left = r.profileOf(todo)?.min ?? 0;
  const col = (label: string, value: string, big: boolean, color: string = C.fg) => (
    <View style={{ flexGrow: 1, flexBasis: big ? 96 : 68, minWidth: 0 }}>
      <T w={600} size={9} ls={0.7} color={C.fg2}>{label}</T>
      <T w={700} size={big ? 26 : 16} ls={big ? -0.8 : -0.2} color={color} numberOfLines={1} style={{ marginTop: big ? 3 : 4 }}>{value}</T>
    </View>
  );
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 10, paddingTop: 12, paddingBottom: 13, paddingHorizontal: 18, borderRadius: 24, backgroundColor: C.card, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: 18, rowGap: 8 }}>
      {col("ARRIVAL · MTC", arrivalMtc(left), true)}
      {col("TIME LEFT", fmtMin(left), false, C.accent2)}
      {col("DISTANCE", fmtKm(Math.max(0, total - n.prog)), false)}
    </View>
  );
}

export function ArrivedCard() {
  const { state: S } = useApp();
  const r = useRoutes();
  const a = S.arrived;
  if (!a) return null;
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, padding: 14, borderWidth: 1, borderColor: "rgba(127,212,193,0.25)" }, R.pebble2]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(127,212,193,0.15)", alignItems: "center", justifyContent: "center" }}>
        <Svg pointerEvents="none" viewBox="0 0 16 16" width={16} height={16} fill="none" stroke={C.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 8.5 6.5 12 13 4.5" />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w={700} size={10.5} ls={0.9} color={C.accent2} numberOfLines={1}>{a.name.toUpperCase()}</T>
        <T w={700} size={15} ls={-0.2} style={{ marginTop: 2 }}>Arrived at Destination</T>
        <T w={500} size={10.5} color={C.fg2} style={{ marginTop: 2 }}>{`${a.km.toFixed(1)} km · ${fmtMin(a.min)} · ${a.stops} stop${a.stops === 1 ? "" : "s"}`}</T>
      </View>
      <Pressable accessibilityRole="button" onPress={r.dismissArrived} style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.raised, justifyContent: "center" }}>
        <T w={700} size={10.5} ls={0.5}>DONE</T>
      </Pressable>
    </View>
  );
}
