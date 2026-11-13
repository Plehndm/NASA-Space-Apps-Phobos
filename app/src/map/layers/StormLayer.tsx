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
//     area's own background carries on seamlessly;
//   - at each edge, a smooth band of dust: fully opaque on the edge itself, so the imagery's straight
//     border never shows, easing to clear EDGE px into the grid (no landmark is that close to the edge:
//     the nearest, North Rim Crater, is about 117 px in) and OUT px out over the storm, so the solid
//     edge blends into the storm's texture instead of meeting it at a line;
//   - wisps of lighter dust straddle the edges and drift slowly back and forth.
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme";
import { GRID } from "../geo";

const FOG = 1600; // world px of storm around the grid (160 km), more than half a screen at the lowest zoom
const EDGE = 100; // world px the dust reaches into the grid (10 km)
const OUT = 70; // world px the solid edge fades out over the storm outside
const DRIFT_MS = 26_000; // one sweep of the wisps

const STORM = require("../../../assets/storm.png");
const WISP = require("../../../assets/wisp.png");
const DUST_RGB = "97,61,43"; // storm.png's average colour

/**
 * The edge band's colour stops, outside → edge → inside: clear OUT px outside, fully opaque on the
 * edge, then easing (a smoothstep, so no visible start or end) to clear EDGE px inside.
 */
type Stops = { colors: readonly [string, string, ...string[]]; locations: readonly [number, number, ...number[]] };
const EDGE_STOPS: Stops = (() => {
  const total = OUT + EDGE, at = (px: number) => px / total;
  const outside: [number, number][] = [[0, 0], [0.5, 0.55], [1, 1]].map(([f, a]) => [at(f * OUT), a]);
  const inside: [number, number][] = [0.2, 0.4, 0.6, 0.8, 1].map(f => [at(OUT + f * EDGE), 1 - f * f * (3 - 2 * f)]);
  const stops = [...outside, ...inside];
  return { colors: stops.map(([, a]) => `rgba(${DUST_RGB},${a.toFixed(3)})`), locations: stops.map(([l]) => l) } as unknown as Stops;
})();
/** The same band for the bottom and right edges, where the inside comes first. */
const reversed = { colors: [...EDGE_STOPS.colors].reverse(), locations: EDGE_STOPS.locations.map(l => 1 - l).reverse() } as unknown as Stops;

type Box = { left: number; top: number; width: number; height: number };
const abs = (b: Box) => ({ position: "absolute" as const, ...b });

/** Wisps along each edge, centred on it: centre (world px), width, and how far and which way each drifts. */
const WISPS = (() => {
  const out: { x: number; y: number; w: number; dx: number; dy: number }[] = [];
  const along = (n: number, len: number) => Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * len);
  along(6, GRID.W).forEach((x, i) => {
    out.push({ x, y: 10, w: 820, dx: i % 2 ? 110 : -110, dy: 25 });
    out.push({ x: x + 90, y: GRID.H - 10, w: 820, dx: i % 2 ? -110 : 110, dy: -25 });
  });
  along(5, GRID.H).forEach((y, i) => {
    out.push({ x: 10, y, w: 760, dx: 30, dy: i % 2 ? 100 : -100 });
    out.push({ x: GRID.W - 10, y: y + 80, w: 760, dx: -30, dy: i % 2 ? -100 : 100 });
  });
  // The corners, where two edges meet.
  for (const [x, y] of [[0, 0], [GRID.W, 0], [0, GRID.H], [GRID.W, GRID.H]]) out.push({ x, y, w: 900, dx: 60, dy: 40 });
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

  const W = GRID.W, H = GRID.H;
  // Clear at the grid's edge (a non-zero start would leave a step there), darkening to solid ground outside.
  const dark = { colors: [alpha("bg1", 1), alpha("bg1", 0.3), alpha("bg1", 0)] as const, locations: [0, 0.55, 1] as const };
  const darkRev = { colors: [alpha("bg1", 0), alpha("bg1", 0.3), alpha("bg1", 1)] as const, locations: [0, 0.45, 1] as const };
  return (
    <View pointerEvents="none" style={abs({ left: 0, top: 0, width: W, height: H })}>
      {BANDS.map(b => <Band key={`${b.left},${b.top}`} b={b} />)}

      {/* Thicker and darker toward the outer edge, ending in the map area's own ground colour. */}
      <LinearGradient {...dark} style={abs({ left: -FOG, top: -FOG, width: W + 2 * FOG, height: FOG })} />
      <LinearGradient {...darkRev} style={abs({ left: -FOG, top: H, width: W + 2 * FOG, height: FOG })} />
      <LinearGradient {...dark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: -FOG, top: -FOG, width: FOG, height: H + 2 * FOG })} />
      <LinearGradient {...darkRev} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: W, top: -FOG, width: FOG, height: H + 2 * FOG })} />

      {/* Solid dust on the edge of the data, fading smoothly both ways. */}
      <LinearGradient {...EDGE_STOPS} style={abs({ left: -OUT, top: -OUT, width: W + 2 * OUT, height: OUT + EDGE })} />
      <LinearGradient {...reversed} style={abs({ left: -OUT, top: H - EDGE, width: W + 2 * OUT, height: OUT + EDGE })} />
      <LinearGradient {...EDGE_STOPS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: -OUT, top: -OUT, width: OUT + EDGE, height: H + 2 * OUT })} />
      <LinearGradient {...reversed} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={abs({ left: W - EDGE, top: -OUT, width: OUT + EDGE, height: H + 2 * OUT })} />

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
