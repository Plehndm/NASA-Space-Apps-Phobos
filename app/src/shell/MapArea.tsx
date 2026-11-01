import { useEffect, useRef } from "react";
import { Animated, Easing, Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../state/store";
import { MAP, WORLD } from "../assets";
import { C, EASE } from "../theme";
import { Dock } from "./Dock";

/**
 * The map area: transformed world container, haze, sheet scrim and the dock.
 * STUB for the map: only the base image and the view transform are here. Pan / pinch / wheel,
 * the coordinate pill, scale bar and recenter button belong to checklist item "Map engine";
 * each layer adds itself inside the world container, positioned in world px.
 */
export function MapArea() {
  const { state: S, geo, sheetTop } = useApp();

  // Animated copies of the view so zoom changes can glide (450 ms) or jump.
  const tx = useRef(new Animated.Value(S.view.tx)).current;
  const ty = useRef(new Animated.Value(S.view.ty)).current;
  const s = useRef(new Animated.Value(S.view.s)).current;
  useEffect(() => {
    const v = S.view;
    if (!v.anim) {
      tx.setValue(v.tx); ty.setValue(v.ty); s.setValue(v.s);
      return;
    }
    const cfg = { duration: 450, easing: Easing.bezier(...EASE), useNativeDriver: false };
    Animated.parallel([
      Animated.timing(tx, { toValue: v.tx, ...cfg }),
      Animated.timing(ty, { toValue: v.ty, ...cfg }),
      Animated.timing(s, { toValue: v.s, ...cfg }),
    ]).start();
  }, [S.view, tx, ty, s]);

  // The map dims as the phone sheet rises: 0 at peek, 0.5 at full.
  const p = geo.snap;
  const scrim = geo.device === "phone"
    ? sheetTop.interpolate({ inputRange: [p.full, p.peek], outputRange: [0.5, 0], extrapolate: "clamp" })
    : 0;

  return (
    <View style={{ position: "absolute", left: geo.mapLeft, top: 0, width: geo.mapW, height: geo.H, overflow: "hidden", backgroundColor: C.bg1 }}>
      <Animated.View
        style={{
          position: "absolute", left: 0, top: 0, width: WORLD.w, height: WORLD.h, transformOrigin: [0, 0, 0],
          transform: [{ translateX: tx }, { translateY: ty }, { scale: s }],
        }}
      >
        <Image source={MAP.world} style={{ position: "absolute", left: 0, top: 0, width: WORLD.w, height: WORLD.h }} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,172,122,0.2)", "rgba(255,172,122,0)"]}
        locations={[0, 0.32]}
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      />
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.bg0, opacity: scrim }} />
      <Dock />
    </View>
  );
}
