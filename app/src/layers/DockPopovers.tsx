// Popovers that open beside the dock buttons when Settings → Layer controls = DOCK (the default).
// The controls themselves are shared with the Layers card (src/map/LayerControls.tsx).
import { Pressable, View } from "react-native";
import { useApp } from "../state/store";
import { alpha, C, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { useMapData } from "../map/data";
import { HeatHint, HeatKindAndSeason, HeatLegendBar, HeatSwitchRow, HeatTime, StrataBar, StrataChips } from "../map/LayerControls";

/**
 * Elevation: vertical summit → floor legend beside a column of L1 / L2 / L3 pills (tap again for off),
 * and ALL LAYERS for the Layers card (landing points, hazard filters, dust-devil sol), which the dock
 * layout has no other way to open.
 */
export function ElevationPopover() {
  const { patch, setMode } = useApp();
  const openLayers = () => {
    patch({ elevOpen: false, heatOpen: false });
    setMode("layers", "half");
  };
  return (
    <View style={{ position: "absolute", right: 54, top: 0, zIndex: 1, alignItems: "flex-end", gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
        <StrataBar vertical />
        <StrataChips />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="All layers"
        onPress={openLayers}
        style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: alpha("bg1", 0.92), boxShadow: SHADOW.s1 }}
      >
        <T w={700} size={10} ls={0.8} color={C.accent2}>ALL LAYERS</T>
      </Pressable>
    </View>
  );
}

/** Temperature: switch, ground / air, season, time slider with play, legend. */
export function HeatPopover() {
  const heat = useMapData().manifest?.heat;
  return (
    <View
      style={{
        // Aligned with the top of the dock so it clears the phone sheet at peek.
        position: "absolute", right: 54, top: 0, zIndex: 1, width: 248, padding: 12, gap: 9,
        borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 8, borderBottomLeftRadius: 22,
        backgroundColor: alpha("bg1", 0.95), boxShadow: SHADOW.s2,
      }}
    >
      <HeatSwitchRow />
      {heat ? (
        <>
          <HeatKindAndSeason heat={heat} />
          <HeatTime heat={heat} />
          <HeatLegendBar heat={heat} />
          <HeatHint heat={heat} />
        </>
      ) : (
        <T w={500} size={10} lh={1.45} color={C.fg3}>Temperature maps load with the map data (app/data/, see app/README.md).</T>
      )}
    </View>
  );
}
