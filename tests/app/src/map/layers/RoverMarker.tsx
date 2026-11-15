// The rover: warm arrow turned to its heading, a 40 px pulsing ring and an 88 px heading cone.
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { useApp } from "../../state/store";
import { C } from "../../theme";
import { Pin } from "../view";

export function RoverMarker() {
  const { state } = useApp();
  const r = state.rover;
  // mn-pulse: scale .5 → 2.4 while fading .9 → 0, every 2.4 s.
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });

  return (
    <Pin x={r.x} y={r.y} zIndex={5}>
      <View pointerEvents="none" style={{ position: "absolute", left: -44, top: -44, width: 88, height: 88, transform: [{ rotate: `${r.h}deg` }] }}>
        <Svg width={88} height={88} viewBox="-44 -44 88 88">
          <Defs>
            <RadialGradient id="mnCone" cx="0" cy="0" r="44" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={C.route} stopOpacity={0.45} />
              <Stop offset="1" stopColor={C.route} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d="M0 0 L-19 -40 A44 44 0 0 1 19 -40 Z" fill="url(#mnCone)" />
        </Svg>
      </View>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", left: -20, top: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(127,212,193,0.22)", opacity, transform: [{ scale }] }}
      />
      <View pointerEvents="none" style={{ position: "absolute", left: -20, top: -20, width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(127,212,193,0.45)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: -12, top: -12, width: 24, height: 24, transform: [{ rotate: `${r.h}deg` }] }}>
        <Svg width={24} height={24} viewBox="-12 -12 24 24">
          <Path d="M0 -10 L7 8 L0 4 L-7 8 Z" fill={C.warm} stroke={C.bg1} strokeWidth={1.2} strokeLinejoin="round" />
        </Svg>
      </View>
    </Pin>
  );
}
