// The live map view, shared with every map layer (the zoomed world container and the 1:1 overlay).
//
// The store's `view` is the committed view (buttons, selections, gesture ends). While a finger, the
// wheel or a glide is moving the map, MapArea writes `view` directly so the app doesn't re-render on
// every frame; `vp` follows at a throttled rate so layers can pick what to draw.
//
// `view` is ONE Reanimated shared value holding scale and translation together. Three separate
// animated values could reach the screen in different frames on iOS, drawing the map for one frame
// at the new zoom but the old position: a visible jump.
import { createContext, useContext, type ReactNode } from "react";
import { View } from "react-native";
import Reanimated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

export interface V3 { s: number; tx: number; ty: number }
export interface Viewport extends V3 { w: number; h: number }

export interface MapView {
  /** World px → screen px is translate(tx, ty) scale(s). */
  view: SharedValue<V3>;
  /** Throttled copy of the view plus the map area's size, for culling. */
  vp: Viewport;
}

const Ctx = createContext<MapView | null>(null);
export const MapViewProvider = Ctx.Provider;

export function useMapView(): MapView {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMapView must be used inside MapArea");
  return v;
}

/** Visible world rectangle, padded by `pad` screen px. */
export function visibleWorld(vp: Viewport, pad = 0) {
  return {
    x0: (-pad - vp.tx) / vp.s,
    y0: (-pad - vp.ty) / vp.s,
    x1: (vp.w + pad - vp.tx) / vp.s,
    y1: (vp.h + pad - vp.ty) / vp.s,
  };
}

/**
 * Anchors children at world point (x, y) at a constant screen size.
 *
 * Pins live in the overlay above the world container, not inside it: iOS draws a view at its own
 * size and then stretches it with its parent's zoom, so text and lines inside the zoomed world go
 * blurry. Here the pin is moved to x·s + tx, y·s + ty and drawn 1:1. Children are laid out around
 * the anchor (0, 0), so give them negative offsets to centre. `scaleFrom` additionally scales the
 * pin by s / scaleFrom (used by shapes drawn for one zoom that must follow the live one).
 */
export function Pin({ x, y, children, zIndex, scaleFrom }: { x: number; y: number; children: ReactNode; zIndex?: number; scaleFrom?: number }) {
  const { view } = useMapView();
  const moved = useAnimatedStyle(() => {
    const v = view.value;
    const t = [{ translateX: v.s * x + v.tx }, { translateY: v.s * y + v.ty }];
    return { transform: scaleFrom ? [...t, { scale: v.s / scaleFrom }] : t };
  });
  return (
    <Reanimated.View pointerEvents="box-none" style={[{ position: "absolute", left: 0, top: 0, width: 0, height: 0, zIndex }, moved]}>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>{children}</View>
    </Reanimated.View>
  );
}

/**
 * Opacity style for labels laid out for zoom `s0` (the last viewport update). Zooming out packs the
 * map tighter than that layout allowed for, so labels hide until the next update re-runs the
 * collision check; zooming in only spreads them apart, so they stay.
 */
export function useLabelFade(s0: number) {
  const { view } = useMapView();
  return useAnimatedStyle(() => ({ opacity: view.value.s < s0 * 0.92 ? 0 : 1 }));
}
