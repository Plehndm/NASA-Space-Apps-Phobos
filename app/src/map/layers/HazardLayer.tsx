// Hazard zones: an ellipse per zone (13 % fill, dotted 2.2 px outline in its type's colour) with an
// uppercase label pill above it. Shown when the dock's hazard button is on, filtered by the type chips.
import Svg, { Ellipse, G } from "react-native-svg";
import { View } from "react-native";
import { useApp } from "../../state/store";
import { alpha, C, SHADOW } from "../../theme";
import { T } from "../../ui/Text";
import { HAZARD_ZONES, type HazardZone } from "../hazards";
import Reanimated from "react-native-reanimated";
import { Pin, useLabelFade, useMapView } from "../view";
import { boxesHit, landmarkLabelBoxes, shownLandmarks } from "./LandmarkLayer";

/**
 * One zone's outline, drawn in the 1:1 overlay at screen resolution (inside the zoomed world, iOS
 * draws an SVG at its base size and stretches it, so the dots go blurry).
 *
 * The ellipse is drawn for the zoom `s0` of the last viewport update (every ~100 ms during a
 * gesture); between updates the pin scales it by s / s0 to keep it the right size, and the next
 * update redraws it sharp. Outline as in the design: 2.2 px round dots every 8 px.
 */
function ZoneShape({ z, s0 }: { z: HazardZone; s0: number }) {
  const r = Math.max(z.rx, z.ry) * s0 + 4;
  return (
    <Pin x={z.x} y={z.y} scaleFrom={s0}>
      <Svg width={2 * r} height={2 * r} style={{ position: "absolute", left: -r, top: -r }} pointerEvents="none">
        <G transform={`rotate(${z.rot} ${r} ${r})`}>
          <Ellipse
            cx={r} cy={r} rx={z.rx * s0} ry={z.ry * s0}
            fill={z.color} fillOpacity={0.13}
            stroke={z.color} strokeWidth={2.2} strokeDasharray="1 7" strokeLinecap="round"
          />
        </G>
      </Svg>
    </Pin>
  );
}

function ZoneLabel({ z, s0 }: { z: HazardZone; s0: number }) {
  const fade = useLabelFade(s0);
  return (
    <Pin x={z.x} y={z.y - z.ry}>
      <Reanimated.View
        pointerEvents="none"
        style={[{ position: "absolute", bottom: 6, left: -120, width: 240, alignItems: "center" }, fade]}
      >
        <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: alpha("bg1", 0.9), borderWidth: 1, borderColor: z.color, boxShadow: SHADOW.s1 }}>
          <T w={700} size={9} ls={0.6} color={C.fg} numberOfLines={1}>{z.label}</T>
        </View>
      </Reanimated.View>
    </Pin>
  );
}

/** Outlines, in the 1:1 overlay under the labels and markers. */
export function HazardLayer() {
  const { state: S } = useApp();
  const { vp } = useMapView();
  if (!S.hazOn) return null;
  return <>{HAZARD_ZONES.filter(z => S.hazTypes[z.type]).map(z => <ZoneShape key={z.id} z={z} s0={vp.s} />)}</>;
}

/**
 * Label pills, in the 1:1 overlay. A label only once its zone is at least 36 px across on screen,
 * so zoomed-out maps stay readable.
 */
export function HazardLabels() {
  const { state: S } = useApp();
  const { vp } = useMapView();
  if (!S.hazOn) return null;
  // Landmark labels win: a hazard label that would cover one waits for a closer zoom.
  const taken = landmarkLabelBoxes(shownLandmarks(S.lz, S.sel, S.extraLm), vp.s, S.sel, S.rover, S.nav ? S.nav.stops : S.stops);
  const zones = HAZARD_ZONES.filter(z => {
    if (!S.hazTypes[z.type] || 2 * Math.max(z.rx, z.ry) * vp.s < 36) return false;
    const w = z.label.length * 6.4 + 22, cx = z.x * vp.s, by = (z.y - z.ry) * vp.s - 6;
    const box = { x0: cx - w / 2, x1: cx + w / 2, y0: by - 22, y1: by };
    return !taken.some(t => boxesHit(t, box));
  });
  return <>{zones.map(z => <ZoneLabel key={z.id} z={z} s0={vp.s} />)}</>;
}
