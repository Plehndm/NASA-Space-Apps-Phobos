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

const STEM = 16, DOT = 14, PILL_H = 25;
const labelWidth = (name: string) => name.length * 7.6 + 24; // 10.5 px bold caps, 0.7 tracking

export type Box = { x0: number; x1: number; y0: number; y1: number };
export const boxesHit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Landmarks drawn for the current state (landing points can be switched off). */
export const shownLandmarks = (lz: boolean, sel: string | null) => LANDMARKS.filter(l => lz || l.cat !== "Landing" || l.id === sel);

/** Screen boxes (relative to the map origin, at zoom s) of the landmark labels that show. */
export function landmarkLabelBoxes(list: Landmark[], s: number, sel: string | null, rover: Pt): Box[] {
  const ids = visibleLabels(list, s, sel, rover);
  return list.filter(l => ids.has(l.id)).map(l => labelBox(l, s));
}

function labelBox(l: Landmark, s: number): Box {
  const w = labelWidth(l.name), cx = l.x * s, by = l.y * s - DOT / 2 - STEM;
  return { x0: cx - w / 2 - 4, x1: cx + w / 2 + 4, y0: by - PILL_H - 2, y1: by + 2 };
}

/** Ids whose labels show at zoom s: by priority, skipping any that would collide on screen. */
function visibleLabels(list: Landmark[], s: number, sel: string | null, rover: Pt): Set<string> {
  const want = list
    .filter(l => l.id === sel || s >= LABEL_ZOOM[l.rank])
    .sort((a, b) => (a.id === sel ? -1 : b.id === sel ? 1 : a.rank - b.rank));
  const hit = boxesHit;
  // Dots (with their ring) are obstacles for the labels of lower-priority markers only; a label may
  // cover a dot of the same or lower priority (labelled markers draw on top). Ties go to list order.
  const r = DOT / 2 + 3;
  const dots = list.map(l => ({ id: l.id, rank: l.rank, x0: l.x * s - r, x1: l.x * s + r, y0: l.y * s - r, y1: l.y * s + r }));
  // The rover (its 40 px ring) is never covered by a label.
  const placed: Box[] = [{ x0: rover.x * s - 20, x1: rover.x * s + 20, y0: rover.y * s - 20, y1: rover.y * s + 20 }];
  const out = new Set<string>();
  for (const l of want) {
    const box = labelBox(l, s);
    if (placed.some(p => hit(p, box))) continue;
    if (l.id !== sel && dots.some(d => d.id !== l.id && d.rank < l.rank && hit(d, box))) continue;
    placed.push(box);
    out.add(l.id);
  }
  return out;
}

const Marker = memo(function Marker({ l, label, selected, s0, onPress }: { l: Landmark; label: boolean; selected: boolean; s0: number; onPress: (l: Landmark) => void }) {
  const fade = useLabelFade(s0);
  const landing = l.cat === "Landing";
  const bg = selected ? C.route : landing ? alpha("bg1", 0.9) : alpha("raised", 0.9);
  const fg = selected ? C.routeInk : landing ? C.warm : C.route2;
  const w = label ? Math.max(labelWidth(l.name), DOT) : DOT + 16;
  const h = (label ? PILL_H + STEM : 8) + DOT;
  return (
    // Labelled markers draw above unlabelled ones, so a neighbour's dot never covers a label.
    <Pin x={l.x} y={l.y} zIndex={selected ? 5 : label ? 4 : 3}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={l.name}
        onPress={() => onPress(l)}
        style={{ position: "absolute", left: -w / 2, top: DOT / 2 - h, width: w, height: h, alignItems: "center", justifyContent: "flex-end" }}
      >
        {label && (
          <Reanimated.View style={[{ alignItems: "center" }, fade]}>
            <View style={{ height: PILL_H, paddingHorizontal: 11, borderRadius: 999, justifyContent: "center", backgroundColor: bg, boxShadow: "0px 6px 16px rgba(10,4,2,0.45)" }}>
              <T w={700} size={10.5} ls={0.7} color={fg} numberOfLines={1}>{l.name.toUpperCase()}</T>
            </View>
            <View style={{ width: 2, height: STEM, borderRadius: 1, backgroundColor: C.route, opacity: 0.8 }} />
          </Reanimated.View>
        )}
        <View
          style={{
            width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: "center", justifyContent: "center",
            backgroundColor: selected ? C.route : landing ? C.warm : C.route2,
            boxShadow: `0px 0px 0px 3px ${alpha("bg1", 0.55)}`,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.bg1 }} />
        </View>
      </Pressable>
    </Pin>
  );
});

export function LandmarkLayer() {
  const { state: S, patch, setMode, centerOn } = useApp();
  const { vp } = useMapView();
  const list = shownLandmarks(S.lz, S.sel);
  const labels = visibleLabels(list, vp.s, S.sel, S.rover);
  const select = (l: Landmark) => {
    patch({ sel: l.id, heatOpen: false, elevOpen: false });
    setMode("waypoint", "half");
    centerOn(l);
  };
  // Selected marker last, so it draws on top.
  const ordered = [...list].sort((a, b) => Number(a.id === S.sel) - Number(b.id === S.sel));
  return <>{ordered.map(l => <Marker key={l.id} l={l} label={labels.has(l.id)} selected={l.id === S.sel} s0={vp.s} onPress={select} />)}</>;
}
