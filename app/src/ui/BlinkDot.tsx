import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/** 8 px dot that fades 1 → .15 → 1 on a loop (the prototype's `mn-blink`). */
export function BlinkDot({ color, period = 1200, size = 8 }: { color: string; period?: number; size?: number }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const half = period / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.15, duration: half, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: half, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o, period]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: o }} />;
}
