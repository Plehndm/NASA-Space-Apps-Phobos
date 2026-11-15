// Landmark markers: a 14 px dot (warm for landing points) with an uppercase label pill on a 16 px stem.
// Labels follow the design's rank rule (rank 1 always, 2 from zoom 1.7, 3 from zoom 2.4, the selected
// one always), and, since real sites can sit a few hundred metres apart, a label that would overlap a
// higher-priority one waits until the map is zoomed in far enough to separate them.
import { memo } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../../state/store";
import { alpha, C } from "../../theme";
import { T } from "../../ui/Text";
import { LABEL_ZOOM, LANDMARKS, type Landmark } from "../landmarks";
import type { Pt } from "../geo";
import Reanimated from "react-native-reanimated";
import { Pin, useLabelFade, useMapView } from "../view";
import { isPin, useRoutes } from "../../route/RouteProvider";
import { isFiltering, matches } from "../../home/search";

const STEM = 16, DOT = 14, PILL_H = 25;
const labelWidth = (name: string) => name.length * 7.6 + 24; // 10.5 px bold caps, 0.7 tracking

export type Box = { x0: number; x1: number; y0: number; y1: number };
export const boxesHit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Landmarks drawn for the current state (landing points can be switched off). */
export const shownLandmarks = (lz: boolean, sel: string | null, extra: Landmark[] = []) =>
  [...LANDMARKS, ...extra].filter(l => lz || l.cat !== "Landing" || l.id === sel);

/** Screen boxes (relative to the map origin, at zoom s) of the landmark labels that show. */
export function landmarkLabelBoxes(list: Landmark[], s: number, sel: string | null, rover: Pt, seq: string[] = [], hits: string[] = []): Box[] {
  const ids = visibleLabels(list, s, sel, rover, seq, hits);
  return list.filter(l => ids.has(l.id)).map(l => labelBox(l, s));
}

function labelBox(l: Landmark, s: number, num = false): Box {
  const w = labelWidth(l.name) + (num ? 22 : 0), cx = l.x * s, by = l.y * s - DOT / 2 - STEM;
  return { x0: cx - w / 2 - 4, x1: cx + w / 2 + 4, y0: by - PILL_H - 2, y1: by + 2 };
}

/**
 * Ids whose labels show at zoom s: by priority, skipping any that would collide on screen. The selected
 * landmark and the sequence's stops always get theirs (the design's rule), placed first.
 */
function visibleLabels(list: Landmark[], s: number, sel: string | null, rover: Pt, seq: string[] = [], hits: string[] = []): Set<string> {
  const forced = (l: Landmark) => l.id === sel || seq.includes(l.id);
  // Search matches skip the zoom rule and go first, but still give way to labels they would cover.
  const isHit = (l: Landmark) => hits.includes(l.id);
  const want = list
    .filter(l => forced(l) || isHit(l) || (!hits.length && s >= LABEL_ZOOM[l.rank]))
    .sort((a, b) => Number(forced(b)) - Number(forced(a)) || Number(isHit(b)) - Number(isHit(a)) || a.rank - b.rank);
  const hit = boxesHit;
  // Dots (with their ring) are obstacles for the labels of lower-priority markers only; a label may
  // cover a dot of the same or lower priority (labelled markers draw on top). Ties go to list order.
  const r = DOT / 2 + 3;
  const dots = list.map(l => ({ id: l.id, rank: l.rank, x0: l.x * s - r, x1: l.x * s + r, y0: l.y * s - r, y1: l.y * s + r }));
  // The rover (its 40 px ring) is never covered by a label.
  const placed: Box[] = [{ x0: rover.x * s - 20, x1: rover.x * s + 20, y0: rover.y * s - 20, y1: rover.y * s + 20 }];
  const out = new Set<string>();
  for (const l of want) {
    const box = labelBox(l, s, seq.includes(l.id));
    if (!forced(l) && placed.some(p => hit(p, box))) continue;
    if (!forced(l) && dots.some(d => d.id !== l.id && d.rank < l.rank && hit(d, box))) continue;
    placed.push(box);
    out.add(l.id);
  }
  return out;
}

const Marker = memo(function Marker({ l, label, selected, num, dim, s0, onPress }: { l: Landmark; label: boolean; selected: boolean; num: number; dim: boolean; s0: number; onPress: (l: Landmark) => void }) {
  const fade = useLabelFade(s0);
  const landing = l.cat === "Landing";
  const pin = isPin(l.id); // a dropped pin: orange, like the map's call-to-action colour
  // Selected: route fill. In the sequence: faint route tint with a number badge.
  const bg = selected ? C.route : num ? "rgba(127,212,193,0.22)" : landing ? alpha("bg1", 0.9) : alpha("raised", 0.9);
  const fg = selected ? C.routeInk : landing ? C.warm : C.route2;
  const w = label ? Math.max(labelWidth(l.name) + (num ? 22 : 0), DOT) : DOT + 16;
  const h = (label ? PILL_H + STEM : 8) + DOT;
  return (
    // Selected, then sequence stops, then labelled markers draw above the rest, so a neighbour's dot never covers a label.
    <Pin x={l.x} y={l.y} zIndex={selected ? 6 : num ? 5 : label ? 4 : 3}>
      <View style={{ opacity: dim ? 0.28 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={l.name}
        onPress={() => onPress(l)}
        style={{ position: "absolute", left: -w / 2, top: DOT / 2 - h, width: w, height: h, alignItems: "center", justifyContent: "flex-end" }}
      >
        {label && (
          <Reanimated.View style={[{ alignItems: "center" }, fade]}>
            <View style={{ height: PILL_H, paddingHorizontal: 11, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: bg, boxShadow: "0px 6px 16px rgba(10,4,2,0.45)" }}>
              {num > 0 && (
                <View style={{ minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", justifyContent: "center" }}>
                  <T w={700} size={9} color={fg}>{num}</T>
                </View>
              )}
              <T w={700} size={10.5} ls={0.7} color={fg} numberOfLines={1}>{l.name.toUpperCase()}</T>
            </View>
            <View style={{ width: 2, height: STEM, borderRadius: 1, backgroundColor: C.route, opacity: 0.8 }} />
          </Reanimated.View>
        )}
        <View
          style={{
            width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: "center", justifyContent: "center",
            backgroundColor: selected ? C.route : pin ? C.cta : landing ? C.warm : C.route2,
            boxShadow: `0px 0px 0px 3px ${alpha("bg1", 0.55)}`,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.bg1 }} />
        </View>
      </Pressable>
      </View>
    </Pin>
  );
});

export function LandmarkLayer() {
  const { state: S } = useApp();
  const { vp } = useMapView();
  const routes = useRoutes();
  const list = shownLandmarks(S.lz, S.sel, S.extraLm);
  const seq = S.nav ? S.nav.stops : S.stops;
  // Searching with a query or category: matches keep their labels, the rest dim (the design's rule).
  const filtering = S.mode === "search" && isFiltering(S.q, S.cat);
  const hit = (l: Landmark) => !filtering || matches(l, S.q, S.cat);
  const hits = filtering ? list.filter(hit).map(l => l.id) : [];
  const labels = visibleLabels(list, vp.s, S.sel, S.rover, seq, hits);
  const dimOthers = S.mode === "waypoint" && !!S.sel;
  const select = (l: Landmark) => routes.select(l.id, S.mode === "search" ? "search" : "map");
  // Selected marker last, so it draws on top.
  const ordered = [...list].sort((a, b) => Number(a.id === S.sel) - Number(b.id === S.sel));
  return <>{ordered.map(l => <Marker key={l.id} l={l} label={labels.has(l.id)} selected={l.id === S.sel} num={seq.indexOf(l.id) + 1}
    dim={!hit(l) || (dimOthers && l.id !== S.sel && !seq.includes(l.id))} s0={vp.s} onPress={select} />)}</>;
}
