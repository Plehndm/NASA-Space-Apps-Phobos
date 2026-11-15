import { useEffect, useRef } from "react";
import { Animated, Pressable } from "react-native";
import { C } from "../theme";

/** 44×24 toggle. `tone="cta"` is used by the hazard toggle; everything else uses the accent. */
export function Switch({ on, onChange, tone = "accent", label }: {
  on: boolean;
  onChange: (on: boolean) => void;
  tone?: "accent" | "cta";
  label?: string;
}) {
  const x = useRef(new Animated.Value(on ? 22 : 2)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: on ? 22 : 2, duration: 200, useNativeDriver: false }).start();
  }, [on, x]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: on ? C[tone] : C.line }}
    >
      <Animated.View
        style={{
          position: "absolute", top: 2, left: x, width: 20, height: 20, borderRadius: 10,
          backgroundColor: on ? C.bg1 : C.fg3, boxShadow: "0px 2px 6px rgba(0,0,0,0.3)",
        }}
      />
    </Pressable>
  );
}
