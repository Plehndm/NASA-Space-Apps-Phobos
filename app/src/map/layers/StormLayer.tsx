// Dust storm around the mapped area: past the grid there is no data, so instead of empty space the map
// fades into a Martian dust storm ("we don't know what's out there").
//
// Drawn in the zoomed world (it is soft, so scaling only blurs it further), last, so its inner edge
// feathers over the imagery and rasters, and under the grid lines, routes and markers. Images and
// gradients rather than one big SVG: on iOS an SVG this size (1477 + 2 × 1600 world px) would be
// rasterised at full size.
//   - storm.png (scripts/make_storm_textures.py), repeated by the platform itself (no seams between
//     tiles), fills a band FOG world px wide around the grid: four clipped boxes (top, bottom, left,
//     right) each showing their part of one repeat anchored at world (-FOG, -FOG), so the texture runs
//     on unbroken from box to box but never covers the grid;
//   - gradients darken the band to the app's ground colour toward its outer edge, so past it the map
//     area's own background carries on seamlessly, and feather the storm EDGE px into the grid;
//   - wisps of lighter dust straddle the edges and drift slowly back and forth.
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme";
import { GRID } from "../geo";

const FOG = 1600; // world px of storm around the grid (160 km), more than half a screen at the lowest zoom
const EDGE = 70; // world px the storm feathers into the grid (7 km)
const DRIFT_MS = 26_000; // one sweep of the wisps

const STORM = require("../../../assets/storm.png");
const WISP = require("../../../assets/wisp.png");
const DUST = "rgba(104,66,46,0.92)"; // the storm texture's average colour
const CLEAR = "rgba(104,66,46,0)";

type Box = { left: number; top: number; width: number; height: number };
const abs = (b: Box) => ({ position: "absolute" as const, ...b });

/** Wisps along each edge: centre (world px), size, and how far and which way each one drifts. */
const WISPS = (() => {
  const out: { x: number; y: number; w: number; dx: number; dy: number }[] = [];
  const along = (n: number, len: number) => Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * len);
  along(4, GRID.W).forEach((x, i) => {
    out.push({ x, y: -60, w: 760, dx: i % 2 ? 90 : -90, dy: 20 });
    out.push({ x: x + 120, y: GRID.H + 60, w: 760, dx: i % 2 ? -90 : 90, dy: -20 });
  });
  along(3, GRID.H).forEach((y, i) => {
    out.push({ x: -80, y, w: 680, dx: 30, dy: i % 2 ? 80 : -80 });
    out.push({ x: GRID.W + 80, y: y + 100, w: 680, dx: -30, dy: i % 2 ? -80 : 80 });
  });
  return out;
})();

/**
 * The storm band around the grid, as four boxes that never overlap the grid. The side boxes reach J px
 * into the top and bottom ones (the same texture, so the overlap can't show) to close hairline gaps at
 * the joins, and the texture stops J px short of the outer edge, which the gradients fill in solid.
 */
const J = 12;
const BANDS: Box[] = [
  { left: -FOG + J, top: -FOG + J, width: GRID.W + 2 * (FOG - J), height: FOG - J },
  { left: -FOG + J, top: GRID.H, width: GRID.W + 2 * (FOG - J), height: FOG - J },
  { left: -FOG + J, top: -J, width: FOG - J, height: GRID.H + 2 * J },
  { left: GRID.W, top: -J, width: FOG - J, height: GRID.H + 2 * J },
];

/** One clipped box of storm: its window onto the repeat anchored at world (-FOG, -FOG). */
function Band({ b }: { b: Box }) {
  return (
    <View style={[abs(b), { overflow: "hidden" }]}>
      <Image
        source={STORM}
        resizeMode="repeat" // at the texture's own size, 512 world px (51 km) per repeat
        style={abs({ left: -FOG - b.left, top: -FOG - b.top, width: GRID.W + 2 * FOG, height: GRID.H + 2 * FOG })}
      />
    </View>
  );
}

export function StormLayer() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    const native = Platform.OS !== "web";
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: DRIFT_MS, easing: ease, useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration: DRIFT_MS, easing: ease, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const W = GRID.W, H = GRID.H, ground = alpha("bg1", 1), thin = alpha("bg1", 0.1);
  return (
    <View pointerEvents="none" style={abs({ left: 0, top: 0, width: W, height: H })}>
      {BANDS.map(b => <Band key={`${b.left},${b.top}`} b={b} />)}

      {/* Thicker and darker toward the outer edge, ending in the map area's own ground colour. */}
      <LinearGradient colors={[ground, thin]} style={abs({ left: -FOG, top: -FOG, width: W + 2 * FOG, height: FOG })} />
      <LinearGradient colors={[thin, ground]} style={abs({ left: -FOG, top: H, width: W + 2 * FOG, height: FOG })} />
      <LinearGradient colors={[ground, thin]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: -FOG, top: -FOG, width: FOG, height: H + 2 * FOG })} />
      <LinearGradient colors={[thin, ground]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: W, top: -FOG, width: FOG, height: H + 2 * FOG })} />

      {/* The storm creeps a little way over the edge of the data. */}
      <LinearGradient colors={[DUST, CLEAR]} style={abs({ left: 0, top: 0, width: W, height: EDGE })} />
      <LinearGradient colors={[CLEAR, DUST]} style={abs({ left: 0, top: H - EDGE, width: W, height: EDGE })} />
      <LinearGradient colors={[DUST, CLEAR]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: 0, top: 0, width: EDGE, height: H })} />
      <LinearGradient colors={[CLEAR, DUST]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: W - EDGE, top: 0, width: EDGE, height: H })} />

      {WISPS.map((w, i) => (
        <Animated.Image
          key={i}
          source={WISP}
          resizeMode="stretch"
          style={[
            abs({ left: w.x - w.w / 2, top: w.y - w.w / 4, width: w.w, height: w.w / 2 }),
            { transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-w.dx, w.dx] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-w.dy, w.dy] }) }] },
          ]}
        />
      ))}
    </View>
  );
}
