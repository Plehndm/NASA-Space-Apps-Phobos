// Map grid: the design's "lines every 64 world px, --warm3 at 7% opacity", 1 screen px wide.
//
// One world px here is 100 m, the same as the prototype's, so 64 px is still its 6.4 km spacing.
// Drawn in the 1:1 overlay (inside the zoomed world, iOS would stretch the lines to blurry bands),
// first, so it sits over the imagery, strata, heat and dust-devil rasters and under hazards, routes
// and markers, as in the design's SVG. About 45 plain Views, not an SVG: nothing to rasterise when
// the lines span the whole 148 km world.
import { useMemo } from "react";
import { View } from "react-native";
import { alpha } from "../../theme";
import { GRID } from "../geo";
import { Pin, useMapView } from "../view";

const STEP = 64; // world px (6.4 km)
const COLOR = alpha("warm3", 0.07);

/**
 * Laid out for the zoom `s0` of the last viewport update; between updates the pin scales it by
 * s / s0 (the lines thicken or thin a little mid-pinch), and the next update redraws them at 1 px.
 */
export function GridLayer() {
  const s0 = useMapView().vp.s;
  const lines = useMemo(() => {
    const w = GRID.W * s0, h = GRID.H * s0, out = [];
    for (let x = STEP; x < GRID.W; x += STEP) out.push(<View key={`x${x}`} style={{ position: "absolute", left: x * s0, top: 0, width: 1, height: h, backgroundColor: COLOR }} />);
    for (let y = STEP; y < GRID.H; y += STEP) out.push(<View key={`y${y}`} style={{ position: "absolute", left: 0, top: y * s0, width: w, height: 1, backgroundColor: COLOR }} />);
    return out;
  }, [s0]);
  return (
    <Pin x={0} y={0} scaleFrom={s0}>
      <View pointerEvents="none">{lines}</View>
    </Pin>
  );
}
