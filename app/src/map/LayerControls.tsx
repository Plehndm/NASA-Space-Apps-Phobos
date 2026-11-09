// Layer controls, shared by the dock popovers (Settings → Layer controls = DOCK) and the Layers card
// (= PANEL): elevation strata, temperature, warning zones (with the dust-devil index) and landing points.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Slider from "@react-native-community/slider";
import Svg, { Path, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../state/store";
import { C, GRADIENT } from "../theme";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import { T } from "../ui/Text";
import { useMapData, type Manifest } from "./data";
import { HAZ_TYPES } from "./hazards";
import { bandLabel } from "./layers/StrataLayer";
import { fmtFrame } from "./layers/HeatLayer";

const STRATA_COLOR = { 1: C.strataL1, 2: C.strataL2, 3: C.strataL3 } as const;
const km = (m: number) => `${m < 0 ? "−" : "+"}${Math.abs(m / 1000).toFixed(1)} km`;

/** Mars season names are for the northern hemisphere; Gale (5° S) sits near the equator. */
function seasonName(ls: number): string {
  return ["northern spring", "northern summer", "northern autumn", "northern winter"][Math.floor((((ls % 360) + 360) % 360) / 90)];
}

function Chip({ on, onPress, children, flex, label }: { on: boolean; onPress: () => void; children: ReactNode; flex?: boolean; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flex: flex ? 1 : undefined, minWidth: flex ? 0 : 46, height: 30, paddingHorizontal: 8, borderRadius: 999, flexDirection: "row", gap: 3,
        alignItems: "center", justifyContent: "center", backgroundColor: C.raised, borderWidth: 1.5, borderColor: on ? C.accent2 : "transparent",
      }}
    >
      {children}
    </Pressable>
  );
}

// --- elevation strata ---

export function StrataChips({ withOff }: { withOff?: boolean }) {
  const { state: S, patch } = useApp();
  const st = useMapData().manifest?.strata;
  const levels = [1, 2, 3] as const;
  return (
    <View style={{ flexDirection: withOff ? "row" : "column", gap: 6 }}>
      {withOff && (
        <Chip flex on={S.elev === 0} onPress={() => patch({ elev: 0 })} label="Elevation strata off">
          <T w={700} size={10} ls={0.5} color={C.fg2}>OFF</T>
        </Chip>
      )}
      {levels.map(n => {
        const lv = st?.levels.find(l => l.level === n);
        return (
          <Chip key={n} flex={withOff} on={S.elev === n} onPress={() => patch({ elev: S.elev === n && !withOff ? 0 : n })}
            label={`Elevation level ${n}${lv ? `, ${bandLabel(lv.min_m, lv.max_m)}` : ""}`}>
            <T w={700} size={10} ls={0.5}>L</T>
            <T w={700} size={10} ls={0.5} color={STRATA_COLOR[n]}>{n}</T>
          </Chip>
        );
      })}
    </View>
  );
}

/** Vertical summit → floor bar with the DEM's real extremes. */
export function StrataBar({ vertical }: { vertical?: boolean }) {
  const st = useMapData().manifest?.strata;
  const [lo, hi] = st?.elev_range_m ?? [-4715, 1116];
  if (vertical) {
    return (
      <View style={{ width: 46, paddingVertical: 10, borderRadius: 21, backgroundColor: "rgba(27,16,13,0.9)", alignItems: "center", gap: 6, boxShadow: "0px 8px 20px rgba(10,4,2,0.4)" }}>
        <T w={700} size={9} ls={0.4} color={C.warm}>{km(hi).replace(" km", "k")}</T>
        <LinearGradient colors={GRADIENT.strata} style={{ width: 6, flex: 1, minHeight: 52, borderRadius: 3 }} />
        <T w={600} size={9} ls={0.4} color="#c5c6ff">{km(lo).replace(" km", "k")}</T>
      </View>
    );
  }
  return (
    <View style={{ gap: 5 }}>
      <LinearGradient colors={[...GRADIENT.strata].reverse() as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6, borderRadius: 3 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T w={500} size={9.5} color={C.fg2}>{km(lo)} floor</T>
        <T w={500} size={9.5} color={C.fg2}>{km(hi)} summit</T>
      </View>
    </View>
  );
}

export function StrataHint() {
  const { state: S } = useApp();
  const st = useMapData().manifest?.strata;
  const lv = st?.levels.find(l => l.level === S.elev);
  return (
    <T w={500} size={10} lh={1.45} color={C.fg3}>
      {lv ? `L${lv.level}: ground ${bandLabel(lv.min_m, lv.max_m)}, ${Math.round(lv.share * 100)}% of the map. From the 20 m CTX DTMs.` : "1 highest · 3 lowest. From the 20 m CTX DTMs."}
    </T>
  );
}

// --- temperature ---

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12" fill={C.fg}>
      {playing ? (<><Rect x={2} y={2} width={3} height={8} rx={1} /><Rect x={7} y={2} width={3} height={8} rx={1} /></>) : <Path d="M3 2l7 4-7 4z" />}
    </Svg>
  );
}

type Heat = NonNullable<Manifest["heat"]>;

export function HeatSwitchRow() {
  const { state: S, patch } = useApp();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <T w={700} size={10} ls={1} color={C.fg2}>{S.heatKind === "air" ? "AIR TEMP" : "GROUND TEMP"}</T>
      <Switch label="Temperature layer" on={S.heat === "on"} onChange={on => patch({ heat: on ? "on" : "off", heatPlay: on && S.heatPlay })} />
    </View>
  );
}

export function HeatTime({ heat }: { heat: Heat }) {
  const { state: S, patch } = useApp();
  const n = heat.frames.length;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={S.heatPlay ? "Pause timelapse" : "Play timelapse"}
          onPress={() => patch({ heatPlay: !S.heatPlay, heat: "on" })}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}
        >
          <PlayIcon playing={S.heatPlay} />
        </Pressable>
        <Slider
          accessibilityLabel="Local solar time"
          style={{ flex: 1, height: 24 }}
          minimumValue={0}
          maximumValue={n - 1}
          step={1}
          value={S.heatT % n}
          onSlidingStart={() => patch({ heatPlay: false })}
          onValueChange={v => { if (Math.round(v) !== S.heatT % n) patch({ heatT: Math.round(v), heat: "on" }); }}
          minimumTrackTintColor={C.accent}
          maximumTrackTintColor={C.line}
          thumbTintColor={C.accent}
        />
        <T w={700} size={10.5} color={C.accent2} style={{ minWidth: 38, textAlign: "right" }}>{fmtFrame(heat.frames[S.heatT % n])}</T>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 38, paddingRight: 46 }}>
        <T w={500} size={9} color={C.fg3}>{fmtFrame(heat.frames[0])}</T>
        <T w={500} size={9} color={C.fg3}>LTST</T>
        <T w={500} size={9} color={C.fg3}>{fmtFrame(heat.frames[n - 1])}</T>
      </View>
    </View>
  );
}

export function HeatKindAndSeason({ heat }: { heat: Heat }) {
  const { state: S, patch } = useApp();
  return (
    <View style={{ gap: 8 }}>
      <Segmented value={S.heatKind} options={[["ground", "GROUND"], ["air", "AIR"]]} onChange={k => patch({ heatKind: k, heat: "on" })} />
      <View style={{ flexDirection: "row", gap: 4 }}>
        {heat.seasons.map(s => (
          <Chip key={s.tag} flex on={S.heatSeason === s.tag} onPress={() => patch({ heatSeason: s.tag, heat: "on" })} label={`Season Ls ${s.ls}°, ${seasonName(s.ls)}`}>
            <T w={700} size={9.5} color={S.heatSeason === s.tag ? C.fg : C.fg2}>{s.ls}°</T>
          </Chip>
        ))}
      </View>
    </View>
  );
}

export function HeatLegendBar({ heat }: { heat: Heat }) {
  const [lo, hi] = heat.range_k;
  const ticks = [0, 1, 2, 3, 4].map(i => Math.round(lo + ((hi - lo) * i) / 4));
  return (
    <View style={{ gap: 4 }}>
      <LinearGradient colors={heat.legend_stops as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 8, borderRadius: 4 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {ticks.map(t => <T key={t} w={500} size={9} color={C.fg2}>{t}</T>)}
      </View>
      <T w={500} size={9.5} color={C.fg3}>Kelvin · one scale for every season, hour, ground and air</T>
    </View>
  );
}

export function HeatHint({ heat }: { heat: Heat }) {
  const { state: S } = useApp();
  const season = heat.seasons.find(s => s.tag === S.heatSeason);
  const range = heat.kinds[S.heatKind]?.range_by_season_k[S.heatSeason];
  return (
    <T w={500} size={10} lh={1.45} color={C.fg3}>
      {season ? `Ls ${season.ls}° (${seasonName(season.ls)}), dust τ ${season.tau}. ` : ""}
      {range ? `${S.heatKind === "air" ? "Air" : "Ground"} ${Math.round(range[0])}–${Math.round(range[1])} K this season. ` : ""}
      {S.heatKind === "air" ? "Night air is nearly uniform across the crater: a model limit, not physics." : "Modelled; checked against Curiosity's REMS at the rover only."}
    </T>
  );
}

// --- warning zones ---

export function HazardChips() {
  const { state: S, patch } = useApp();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {HAZ_TYPES.map(h => {
        const on = S.hazTypes[h.type];
        return (
          <Pressable
            key={h.type}
            accessibilityRole="button"
            accessibilityLabel={h.name}
            accessibilityState={{ selected: on }}
            onPress={() => patch(s => ({ hazTypes: { ...s.hazTypes, [h.type]: !s.hazTypes[h.type] }, hazOn: true }))}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 999,
              backgroundColor: on ? C.raised : "transparent", borderWidth: 1.5, borderColor: on ? h.color : C.line,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: h.color, opacity: on ? 1 : 0.35 }} />
            <T w={600} size={11} color={on ? C.fg : C.fg3}>{h.name}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The design's filter row at the top of the sheet while warning zones are on (Home, Waypoint, Sequence,
 * Expedition), so hazards can be filtered without opening the Layers card.
 */
export function HazardFilterRow() {
  const { state: S } = useApp();
  const on = HAZ_TYPES.filter(h => S.hazTypes[h.type]).length;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <T w={700} size={10.5} ls={1} color={C.fg3} numberOfLines={1} style={{ flexShrink: 1 }}>WARNING ZONES · FILTER BY HAZARD</T>
        <T w={600} size={10} color={C.fg2}>{`${on}/${HAZ_TYPES.length} ON`}</T>
      </View>
      <HazardChips />
    </View>
  );
}

/** Which sol's heating index to show, its three levels and what they mean. */
export function DustDevilControls() {
  const { state: S, patch } = useApp();
  const dd = useMapData().manifest?.dustDevil;
  if (!dd) return null;
  const sol = dd.sols.find(s => s.sol === S.dustSol) ?? dd.sols[0];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.hazDust }} />
        <T w={700} size={10} ls={1} color={C.fg2}>DUST DEVIL HEATING INDEX</T>
      </View>
      <Segmented
        value={String(sol.sol)}
        options={dd.sols.map(s => [String(s.sol), `SOL ${s.sol} · τ ${s.tau}`] as [string, string])}
        onChange={v => patch({ dustSol: Number(v), hazOn: true, hazTypes: { ...S.hazTypes, weather: true } })}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        {dd.levels.map((name, i) => (
          <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: dd.colours[i] }} />
            <T w={600} size={10} color={C.fg2}>{name} {Math.round(sol.share_low_mod_high[i] * 100)}%</T>
          </View>
        ))}
      </View>
      <T w={500} size={10} lh={1.45} color={C.fg3}>
        Where the ground heats fastest from 9:00 to 16:00, the main ingredient of dust devils. High = top 10% of sol {dd.ref_sol}. A heuristic, not a probability.
      </T>
    </View>
  );
}
