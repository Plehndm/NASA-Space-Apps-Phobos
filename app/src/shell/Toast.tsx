import { View } from "react-native";
import { useApp } from "../state/store";
import { alpha, C, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { BlinkDot } from "../ui/BlinkDot";

/** Transient message at the top of the map. Trigger it with `useApp().toast("...")`. */
export function Toast() {
  const { state, geo } = useApp();
  if (!state.toast) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute", left: geo.mapLeft + 16, right: 16, top: geo.overlayTop, maxWidth: 380, zIndex: 6,
        flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 20,
        backgroundColor: alpha("bg1", 0.95), boxShadow: SHADOW.s2,
      }}
    >
      <BlinkDot color={C.accent} />
      <T w={600} size={11} ls={0.2} lh={1.45} style={{ flex: 1 }}>{state.toast}</T>
    </View>
  );
}
