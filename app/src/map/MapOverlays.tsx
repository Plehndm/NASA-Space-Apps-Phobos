// Fixed overlays on the map area (not in world space): coordinate pill, scale bar, heat legend,
// recenter button and a notice when the map data server can't be reached.
import { Animated, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../state/store";
import { alpha, C, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { CrosshairIcon } from "../ui/icons";
import { DATA_URL, useMapData } from "./data";
import { fmtLatLon, M_PER_PX } from "./geo";
import { fmtFrame } from "./layers/HeatLayer";
import { HEAT_CHECKED } from "./heatLimits";
import { BlinkDot } from "../ui/BlinkDot";
import { useDustAdvisory, useNearestHazard } from "../home/advisory";

const BAR_KM = [0.5, 1, 2, 5, 10, 20, 50];

/** Phone: rides on the sheet (top = sheet top − offset). Desktop: fixed from the bottom. */
function useAnchoredTop(phoneOffset: number, deskFromBottom: number) {
  const { geo, sheetTop } = useApp();
  return geo.device === "phone" ? Animated.subtract(sheetTop, phoneOffset) : geo.H - deskFromBottom;
}

function ScaleBar({ scale }: { scale: number }) {
  const { geo } = useApp();
  const top = useAnchoredTop(34, 44);
  const pxPerKm = (1000 / M_PER_PX) * scale;
  const km = BAR_KM.find(k => k * pxPerKm >= 70) ?? BAR_KM[BAR_KM.length - 1];
  const w = Math.round(km * pxPerKm);
  const mid = km / 2 >= 1 ? String(km / 2) : String(km / 2).replace(/^0/, "0");
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: geo.device === "desktop" ? 72 : 68, top, gap: 4 }}>
      <View style={{ height: 12, width: w }}>
        <T w={600} size={9} color={C.fg2} style={{ position: "absolute", left: 0 }}>0</T>
        <T w={600} size={9} color={C.fg2} style={{ position: "absolute", left: w / 2 - 8, width: 16, textAlign: "center" }}>{mid}</T>
        <T w={700} size={9} color={C.accent2} numberOfLines={1} style={{ position: "absolute", left: w - 6, width: 60 }}>{km} km</T>
      </View>
      <View style={{ flexDirection: "row", width: w, height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: alpha("raised", 0.8) }}>
        <View style={{ width: Math.round(w / 2), backgroundColor: C.accent2 }} />
        <View style={{ flex: 1, backgroundColor: C.card }} />
      </View>
    </Animated.View>
  );
}

function RecenterButton() {
  const { geo, state, centerOn, showCoord } = useApp();
  const top = useAnchoredTop(58, 60);
  const locate = () => {
    centerOn(state.rover);
    showCoord(`ROVER · ${fmtLatLon(state.rover)}`, 2200);
  };
  return (
    <Animated.View style={{ position: "absolute", left: geo.device === "desktop" ? 16 : 12, top, zIndex: 3 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center on rover"
        onPress={locate}
        style={({ pressed }) => ({
          width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
          backgroundColor: pressed ? C.raised : alpha("bg1", 0.9), borderWidth: 1, borderColor: C.hair, boxShadow: SHADOW.s1,
        })}
      >
        <CrosshairIcon />
      </Pressable>
    </Animated.View>
  );
}

function CoordPill() {
  const { geo, state } = useApp();
  if (!state.coord) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: geo.overlayTop, alignItems: "center", zIndex: 4 }}>
      <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: alpha("bg1", 0.92), boxShadow: SHADOW.s1 }}>
        <T w={600} size={10} ls={0.4} color={C.accent2} numberOfLines={1}>{state.coord}</T>
      </View>
    </View>
  );
}

/**
 * Kelvin legend for the temperature layer; hidden while the heat popover (which has its own) is open.
 * Its last line says where the model is checked and opens the limits on the About screen.
 */
function HeatLegend() {
  const { geo, state: S, patch } = useApp();
  const heat = useMapData().manifest?.heat;
  const top = useAnchoredTop(34 + 66 + 22, 116 + 22);
  if (S.heat !== "on" || !heat || S.heatOpen || S.mode === "layers") return null;
  const [lo, hi] = heat.range_k;
  const season = heat.seasons.find(s => s.tag === S.heatSeason);
  const frame = heat.frames[S.heatT % heat.frames.length];
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ position: "absolute", left: geo.device === "desktop" ? 72 : 68, top, gap: 4, zIndex: 3, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: alpha("bg1", 0.9), boxShadow: SHADOW.s1 }}
    >
      <T w={700} size={9} ls={0.8} color={C.fg2}>
        {S.heatKind === "air" ? "AIR" : "GROUND"} · {fmtFrame(frame)} LTST · LS {season?.ls ?? "?"}°
      </T>
      <LinearGradient colors={heat.legend_stops as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 132, height: 6, borderRadius: 3 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: 132 }}>
        <T w={500} size={9} color={C.fg2}>{lo} K</T>
        <T w={500} size={9} color={C.fg2}>{(lo + hi) / 2}</T>
        <T w={500} size={9} color={C.fg2}>{hi} K</T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${HEAT_CHECKED}. Show the temperature model's limits`}
        onPress={() => patch({ about: { from: "map", at: "limits" } })}
        hitSlop={8}
        style={{ marginTop: 2, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.hair }}
      >
        <T w={600} size={9} color={C.warm2} numberOfLines={1}>{HEAT_CHECKED} · <T w={700} size={9} color={C.accent2}>limits ›</T></T>
      </Pressable>
    </Animated.View>
  );
}

function DataNotice() {
  const { geo } = useApp();
  const { status } = useMapData();
  if (status !== "offline") return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 64, top: geo.overlayTop + 40, alignItems: "flex-start" }}>
      <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: alpha("bg1", 0.92), borderWidth: 1, borderColor: C.dangerBd }}>
        <T w={700} size={10} ls={0.4} color={C.danger}>MAP DATA OFFLINE</T>
        <T w={500} size={10} lh={1.4} color={C.fg2}>Build app/data/ (see app/README.md), or set EXPO_PUBLIC_DATA_URL. Tried {DATA_URL}</T>
      </View>
    </View>
  );
}

/** Settings → Hazard alerts = TOP BANNER: the nearest hazard as a pill at the top left of the map. */
function HazardBanner() {
  const { geo, state: S, settings } = useApp();
  const adv = useDustAdvisory();
  const nh = useNearestHazard(adv);
  if (settings.hazardStyle !== "banner" || !S.hazOn || !nh || S.coord) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute", left: 12, top: geo.overlayTop, maxWidth: Math.min(270, geo.mapW - 80), zIndex: 3,
        flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, paddingLeft: 11, paddingRight: 14, borderRadius: 999,
        backgroundColor: alpha("bg1", 0.92), borderWidth: 1, borderColor: nh.color, boxShadow: SHADOW.s2,
      }}
    >
      <BlinkDot color={nh.color} period={1400} />
      <T w={700} size={10} ls={0.4} lh={1.4} style={{ flexShrink: 1 }}>{`${nh.name.toUpperCase()} · ${nh.km.toFixed(1)} KM · ${nh.detail.toUpperCase()}`}</T>
    </View>
  );
}

export function MapOverlays({ scale }: { scale: number }) {
  return (
    <>
      <ScaleBar scale={scale} />
      <HeatLegend />
      <RecenterButton />
      <HazardBanner />
      <CoordPill />
      <DataNotice />
    </>
  );
}
