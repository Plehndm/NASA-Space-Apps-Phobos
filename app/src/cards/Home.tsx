// Home card: the sector card (Gale Crater, rover coordinates, recenter) with live telemetry tiles,
// the dust-devil advisory (Settings → Hazard alerts = ADVISORY CARD) and the nearest landmarks.
// The sector card and advisory also show above the Waypoint and Arrived cards, as in the design.
import { Pressable, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useApp } from "../state/store";
import { C, R } from "../theme";
import { T } from "../ui/Text";
import { distanceM, fmtLatLon } from "../map/geo";
import { LANDMARKS } from "../map/landmarks";
import { useRoutes } from "../route/RouteProvider";
import { tauLevel, useTelemetry } from "../home/telemetry";
import { useDustAdvisory, WATCH_KM } from "../home/advisory";
import { LandmarkRow } from "./LandmarkRow";

function Tile({ label, value, sub, color, subColor = C.fg2 }: { label: string; value: string; sub: string; color: string; subColor?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: C.card, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 11 }}>
      <T w={600} size={9} ls={0.6} color={C.fg2} numberOfLines={1}>{label}</T>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 4, marginTop: 4 }}>
        <T w={700} size={14} ls={-0.2} color={color}>{value}</T>
        <T w={500} size={9} color={subColor}>{sub}</T>
      </View>
    </View>
  );
}

export function SectorCard() {
  const { state: S, centerOn, showCoord } = useApp();
  const t = useTelemetry();
  const slope = t.slope;
  return (
    <View style={[{ backgroundColor: "rgba(46,30,25,0.92)", paddingVertical: 14, paddingHorizontal: 16, overflow: "hidden" }, R.pebble]}>
      <View pointerEvents="none" style={{ position: "absolute", left: -40, bottom: -60, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,195,148,0.06)" }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center on rover"
        onPress={() => { centerOn(S.rover); showCoord(`ROVER · ${fmtLatLon(S.rover)}`, 2200); }}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <T w={700} size={22} ls={-0.5}>Gale Crater</T>
        <T w={500} size={10} color={C.fg2} style={{ marginLeft: "auto" }}>{fmtLatLon(S.rover)}</T>
        <Svg pointerEvents="none" viewBox="0 0 16 16" width={15} height={15} fill="none" stroke={C.accent2} strokeWidth={1.6}>
          <Circle cx="8" cy="8" r="4" />
          <Path d="M8 1v3M8 12v3M1 8h3M12 8h3" strokeLinecap="round" />
        </Svg>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Tile
          label="SURFACE TEMP"
          value={t.tempK == null ? "—" : `${Math.round(t.tempK - 273.15)}°C`}
          sub={t.tempK == null ? "loading" : `${Math.round(t.tempK)} K`}
          color={C.warm3}
        />
        <Tile
          label="DUST OPACITY"
          value={t.tau ? `τ ${t.tau.tau.toFixed(2)}` : "τ —"}
          sub={t.tau ? tauLevel(t.tau.tau) : ""}
          color={C.accent2}
          subColor={C.accent2}
        />
        <Tile
          label="GROUND SLOPE"
          value={slope == null ? "—" : `${slope.toFixed(1)}°`}
          sub={slope == null ? "" : slope > 15 ? "STEEP" : slope > 8 ? "MODERATE" : "NOMINAL"}
          color={C.warm2}
        />
      </View>
      <T w={500} size={9} lh={1.4} color={C.fg3} style={{ marginTop: 8 }}>
        {`Modelled ground temperature (${t.tempSub || "…"} LTST) · ${t.tau?.source ?? "Mastcam τ"} · slope from the 20 m DTM`}
      </T>
    </View>
  );
}

export function AdvisoryCard() {
  const { state: S, patch, centerOn, toast } = useApp();
  const adv = useDustAdvisory();
  if (!adv) return null;
  const watch = adv.here >= 3 || (!!adv.high && adv.high.km < WATCH_KM);
  const sub = adv.here >= 3
    ? `Rover is on strongly heated ground · sol ${adv.sol} (τ ${adv.tau})`
    : adv.high
      ? `Strong heating ${adv.high.km.toFixed(1)} km ${adv.high.dir} · sol ${adv.sol} (τ ${adv.tau})`
      : `No strong heating within 30 km · sol ${adv.sol} (τ ${adv.tau})`;
  const view = () => {
    patch({ hazOn: true, hazTypes: { ...S.hazTypes, weather: true } });
    if (adv.high) centerOn(adv.high.p, Math.max(S.view.s, 1.3));
    toast("Dust devil heating index shown on the map · red = strongest heating");
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dust devil advisory: ${sub}. Show on map`}
      onPress={view}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 999,
        backgroundColor: pressed ? C.row : "rgba(27,16,13,0.92)", borderWidth: 1, borderColor: watch ? "rgba(255,195,148,0.4)" : C.hair,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
        <Svg pointerEvents="none" viewBox="0 0 16 16" width={17} height={17} fill="none" stroke={C.hazDust} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M8 2.5 14 13H2Z" />
          <Path d="M8 6.5v3M8 11.2v.3" />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w={700} size={12}>Dust Devil Advisory</T>
        <T w={500} size={10.5} lh={1.45} color={C.fg2} style={{ marginTop: 2 }}>{sub}</T>
      </View>
      <View style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: C.raised }}>
        <T w={700} size={9.5} ls={0.6} color={watch ? C.warm : C.accent2}>{watch ? "WATCH" : "SAFE"}</T>
      </View>
    </Pressable>
  );
}

/** Sector card and, unless alerts are set to the top banner, the advisory: shown on Home, Waypoint and Arrived. */
export function SectorHeader() {
  const { settings } = useApp();
  return (
    <>
      <SectorCard />
      {settings.hazardStyle === "advisory" && <AdvisoryCard />}
    </>
  );
}

export function HomeCard() {
  const { state: S } = useApp();
  const r = useRoutes();
  // The three nearest landmarks, leaving out any the rover is parked at.
  const nearby = LANDMARKS.map(l => ({ l, d: distanceM(S.rover, l) }))
    .filter(x => x.d > 500)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  return (
    <>
      <SectorHeader />
      <T w={700} size={10.5} ls={1} color={C.fg3} style={{ marginTop: 6, paddingLeft: 4 }}>NEARBY LANDMARKS</T>
      {nearby.map(({ l }) => <LandmarkRow key={l.id} l={l} from={S.rover} onPress={() => r.select(l.id)} />)}
    </>
  );
}
