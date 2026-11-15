// Search card (sheet mode "search"): category chips with counts or codes, then the matching landmarks
// (nearest first) or, with no query, the recent searches. Selecting opens the Waypoint card, or adds
// the landmark to the sequence when one is planned.
import { Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state/store";
import { C } from "../theme";
import { T } from "../ui/Text";
import { LANDMARKS, landmarkById } from "../map/landmarks";
import { useRoutes } from "../route/RouteProvider";
import { CAT_CODE, CATS, isFiltering, parseCoords, results } from "../home/search";
import { fmtLatLon } from "../map/geo";
import { LandmarkRow } from "./LandmarkRow";
import { saveRecent } from "../state/settings";

export function SearchCard() {
  const { state: S, settings, patch } = useApp();
  const r = useRoutes();
  const filtering = isFiltering(S.q, S.cat);
  const list = filtering ? results(S.q, S.cat, S.rover) : S.recent.map(landmarkById).filter((l): l is NonNullable<typeof l> => !!l);
  const coords = parseCoords(S.q);
  const counts = LANDMARKS.reduce<Record<string, number>>((m, l) => ({ ...m, [l.cat]: (m[l.cat] ?? 0) + 1 }), {});
  const icons = settings.chipStyle === "icons";

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4 }}>
        {CATS.map(c => {
          const on = S.cat === c;
          const badge = icons ? (c === "All" ? "✦" : CAT_CODE[c]) : String(c === "All" ? LANDMARKS.length : counts[c] ?? 0);
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${c}${icons ? "" : `, ${badge} landmarks`}`}
              onPress={() => patch({ cat: on ? "All" : c })}
              style={{ flexDirection: "row", alignItems: "center", gap: 7, height: 32, paddingLeft: 14, paddingRight: 6, borderRadius: 999, backgroundColor: on ? C.fg : C.raised }}
            >
              <T w={600} size={11} color={on ? C.bg1 : C.fg}>{c}</T>
              <View style={{ minWidth: 22, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 999, alignItems: "center", backgroundColor: icons ? (on ? "rgba(0,0,0,0.08)" : "rgba(127,212,193,0.12)") : on ? C.raised : C.hair }}>
                <T w={700} size={10} color={icons ? (on ? C.raised : C.accent2) : on ? C.fg : C.fg2}>{badge}</T>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <T w={700} size={10.5} ls={1} color={C.fg3}>{filtering ? "RESULTS" : "RECENT SEARCHES"}</T>
        {!filtering && S.recent.length > 0 && !S.stops.length ? (
          <Pressable accessibilityRole="button" onPress={() => { patch({ recent: [] }); saveRecent([]); }} hitSlop={8}>
            <T w={600} size={11} color={C.warm2}>Clear History</T>
          </Pressable>
        ) : (filtering || S.stops.length > 0) ? (
          <T w={600} size={10} ls={0.3} color={C.fg2}>{S.stops.length ? "TAP TO ADD STOP" : `${list.length} SHOWN`}</T>
        ) : null}
      </View>

      {coords && (
        <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, backgroundColor: "rgba(127,212,193,0.09)" }}>
          <T w={600} size={12} color={C.accent2}>{`Coordinate ${fmtLatLon(coords)} · press Enter to go there`}</T>
        </View>
      )}

      {list.length === 0 && !coords && (
        <View style={{ paddingVertical: 20, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.row, borderWidth: 1, borderStyle: "dashed", borderColor: C.line }}>
          <T w={500} size={12} lh={1.5} color={C.fg3} style={{ textAlign: "center" }}>
            {filtering
              ? `No landmarks match “${S.q.trim() || S.cat}”. Try a name, a category, or a coordinate like “4.6S 137.4E”.`
              : "No recent searches. Type a name or pick a category above; tap any marker on the map to open it."}
          </T>
        </View>
      )}

      {list.map(l => <LandmarkRow key={l.id} l={l} from={S.rover} onPress={() => r.select(l.id, "search")} />)}
    </>
  );
}
