// Sequence card (sheet mode "route"): the multi-stop plan. Rover position first, then each stop with
// its leg length and time, ↑ ↓ × to reorder or remove, a warning when Route #1 crosses a hazard zone,
// and NAVIGATE with the whole trip's time, length and steepest grade. Add Stop opens Search; the
// result picked there is appended to the sequence.
import { Pressable, View } from "react-native";
import { useApp } from "../state/store";
import { C, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { fmtLatLon } from "../map/geo";
import { useRoutes } from "../route/RouteProvider";
import { cumul, timeAt } from "../route/router";
import { deg, fmtKm, fmtMin } from "../route/format";

function RoundBtn({ label, glyph, color = C.fg, onPress, disabled }: { label: string; glyph: string; color?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.raised, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}
    >
      <T w={600} size={glyph === "×" ? 15 : 12} color={color} style={{ lineHeight: 16 }}>{glyph}</T>
    </Pressable>
  );
}

function Row({ num, name, tag, sub, children }: { num: string; name: string; tag?: string; sub: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 999, backgroundColor: C.row }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(127,212,193,0.15)", alignItems: "center", justifyContent: "center" }}>
        <T w={700} size={11} color={C.accent2}>{num}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T w={700} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</T>
          {!!tag && (
            <View style={{ paddingVertical: 3, paddingHorizontal: 7, borderRadius: 999, backgroundColor: C.raised }}>
              <T w={700} size={8.5} ls={0.5} color={C.accent2}>{tag}</T>
            </View>
          )}
        </View>
        <T w={500} size={10.5} color={C.fg2} numberOfLines={1} style={{ marginTop: 3 }}>{sub}</T>
      </View>
      {children}
    </View>
  );
}

export function SequenceCard() {
  const { state: S } = useApp();
  const r = useRoutes();
  const o = S.stops.length ? r.routeOpts(S.stops) : null;
  const act = r.activeRoute(S.stops);
  const cum = act ? cumul(act.pts) : [];
  const crosses = S.routeOpt === 1 && o?.direct.cross.length
    ? `ROUTE #1 CROSSES ${o.direct.cross.map(id => r.zones.find(z => z.id === id)?.name.toUpperCase()).filter(Boolean).join(" + ")}`
    : "";

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 4 }}>
        <T w={700} size={22} ls={-0.5}>Sequence</T>
        <View style={{ paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, backgroundColor: C.raised }}>
          <T w={700} size={10.5} ls={0.5} color={C.fg2}>{`${S.stops.length} STOP${S.stops.length === 1 ? "" : "S"}`}</T>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={r.addStopSearch}
          style={{ marginLeft: "auto", height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.cta, justifyContent: "center" }}
        >
          <T w={700} size={13} color={C.ctaInk}>Add Stop</T>
        </Pressable>
      </View>

      <Row num="01" name="Rover position" tag="START" sub={fmtLatLon(S.rover)} />
      {S.stops.map((id, i) => {
        const l = r.lm(id);
        const legPx = act ? cum[act.legEnds[i + 1]] - cum[act.legEnds[i]] : 0;
        const legMin = act ? timeAt(act.samples, cum[act.legEnds[i + 1]]) - timeAt(act.samples, cum[act.legEnds[i]]) : 0;
        return (
          <Row
            key={`${id}-${i}`}
            num={String(i + 2).padStart(2, "0")}
            name={l?.name ?? id}
            tag={i === S.stops.length - 1 ? "DESTINATION" : ""}
            sub={act && l ? `+${fmtKm(legPx)} (${fmtMin(legMin)}) • ${fmtLatLon(l)}` : l ? fmtLatLon(l) : ""}
          >
            <View style={{ flexDirection: "row", gap: 4 }}>
              <RoundBtn label={`Move ${l?.name} up`} glyph="↑" disabled={i === 0} onPress={() => r.moveStop(i, -1)} />
              <RoundBtn label={`Move ${l?.name} down`} glyph="↓" disabled={i === S.stops.length - 1} onPress={() => r.moveStop(i, 1)} />
              <RoundBtn label={`Remove ${l?.name}`} glyph="×" color={C.warm} onPress={() => r.removeStop(i)} />
            </View>
          </Row>
        );
      })}

      {!!crosses && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingLeft: 16, paddingRight: 12, borderRadius: 20, backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBd }}>
          <T w={700} size={10} ls={0.4} lh={1.45} color={C.danger} style={{ flex: 1 }}>{crosses}</T>
          <Pressable onPress={() => r.pickRoute(2)} accessibilityRole="button" style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.raised, justifyContent: "center" }}>
            <T w={700} size={10} ls={0.3}>USE ROUTE #2</T>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={r.navAll}
        accessibilityRole="button"
        disabled={!act || !act.ok}
        style={({ pressed }) => ({
          height: 54, borderRadius: 999, marginTop: 2, alignItems: "center", justifyContent: "center", boxShadow: SHADOW.glow,
          backgroundColor: pressed ? C.ctaHover : C.cta, opacity: act && act.ok ? 1 : 0.5,
        })}
      >
        <T w={800} size={16} ls={-0.2} color={C.ctaInk} numberOfLines={1}>
          {!act ? (r.ready ? "PLANNING…" : "LOADING TERRAIN…") : !act.ok ? "NO ROUTE · CHECK EACH STOP" : `NAVIGATE (${fmtMin(act.min).toUpperCase()} · ${fmtKm(act.px)} · MAX ${deg(act.maxGrade)})`}
        </T>
      </Pressable>
      <Pressable onPress={r.clearRoute} accessibilityRole="button" style={{ height: 32, alignItems: "center", justifyContent: "center" }}>
        <T w={600} size={11} ls={0.6} color={C.fg3}>CLEAR SEQUENCE</T>
      </Pressable>
    </>
  );
}

