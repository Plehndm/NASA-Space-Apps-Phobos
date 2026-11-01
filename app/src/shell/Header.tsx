import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "../state/store";
import { useMtcClock } from "../state/clock";
import { alpha, C } from "../theme";
import { T } from "../ui/Text";
import { GearIcon } from "../ui/icons";

/** Top bar: location + MTC clock on the left, status pill and settings gear on the right. */
export function Header() {
  const { geo, state, settings, patch } = useApp();
  const clock = useMtcClock();
  const desk = geo.device === "desktop";

  const content = (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: geo.insetTop }}>
      <View style={{ gap: 3 }}>
        <T w={700} size={15} ls={-0.2}>Gale Crater</T>
        <T w={500} size={11} ls={0.3} color={C.fg2}>Sol 742 · {clock} MTC</T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: alpha("raised", 0.75) }}>
          <T w={700} size={9.5} ls={0.6} color={state.navActive ? C.warm : C.fg2} numberOfLines={1}>
            {state.navActive ? `DEMO ×${settings.demoSpeed}` : "OFFLINE MAPS ✓"}
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => patch({ settingsOpen: true, elevOpen: false, heatOpen: false })}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
            backgroundColor: pressed ? C.raised : alpha("raised", 0.75),
          })}
        >
          <GearIcon />
        </Pressable>
      </View>
    </View>
  );

  if (desk) {
    return (
      <View style={{ position: "absolute", left: 0, top: 0, width: geo.panelW, height: geo.headerH, backgroundColor: C.bg2, zIndex: 5 }}>
        {content}
      </View>
    );
  }
  return (
    <>
      <LinearGradient
        colors={[alpha("bg1", 0.94), alpha("bg1", 0.62)]}
        style={{ position: "absolute", left: 0, top: 0, width: geo.W, height: geo.headerH, zIndex: 5 }}
      >
        {content}
      </LinearGradient>
      <LinearGradient
        pointerEvents="none"
        colors={[alpha("bg1", 0.5), alpha("bg1", 0)]}
        style={{ position: "absolute", left: 0, top: geo.headerH, width: geo.W, height: 36, zIndex: 5 }}
      />
    </>
  );
}
