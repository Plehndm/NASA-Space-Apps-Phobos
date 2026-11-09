// One landmark row (Search results, recent searches, Home's nearby list): code circle, name,
// "x km away · y min", and NAV READY or HAZARD.
import { Pressable, View } from "react-native";
import { C } from "../theme";
import { T } from "../ui/Text";
import { distanceM } from "../map/geo";
import type { Landmark } from "../map/landmarks";
import { CAT_CODE } from "../home/search";
import { fmtMin } from "../route/format";
import { useRoutes } from "../route/RouteProvider";

export function LandmarkRow({ l, from, icon, onPress }: { l: Landmark; from: { x: number; y: number }; icon?: string; onPress: () => void }) {
  const r = useRoutes();
  const km = distanceM(from, l) / 1000;
  const blocked = !!r.blockedBy(l);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${l.name}, ${km.toFixed(1)} kilometres away${blocked ? ", inside a hazard zone" : ""}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 12,
        borderRadius: 999, backgroundColor: pressed ? C.card : C.row,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}>
        <T w={800} size={10} ls={0.3} color={C.accent2}>{icon ?? CAT_CODE[l.cat] ?? "LM"}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w={600} size={14} numberOfLines={1}>{l.name}</T>
        {/* Straight-line distance; the time is at the rover's flat-ground 8 km/h, as in the design. */}
        <T w={500} size={11} ls={0.2} color={C.fg2} style={{ marginTop: 1 }}>{`${km.toFixed(1)} km away · ${fmtMin((km / 8) * 60)}`}</T>
      </View>
      <T w={700} size={9.5} ls={0.6} color={blocked ? C.danger : C.warm} style={{ paddingRight: 4 }}>{blocked ? "HAZARD" : "NAV READY"}</T>
    </Pressable>
  );
}
