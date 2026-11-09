// Popovers that open beside the dock buttons when Settings → Layer controls = DOCK.
// The controls themselves are shared with the Layers card (src/map/LayerControls.tsx).
import { View } from "react-native";
import { alpha, C, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { useMapData } from "../map/data";
import { HeatHint, HeatKindAndSeason, HeatLegendBar, HeatSwitchRow, HeatTime, StrataBar, StrataChips } from "../map/LayerControls";

/** Elevation: vertical summit → floor legend beside a column of L1 / L2 / L3 pills (tap again for off). */
export function ElevationPopover() {
  return (
    <View style={{ position: "absolute", right: 54, top: 0, zIndex: 1, flexDirection: "row", gap: 8, alignItems: "stretch" }}>
      <StrataBar vertical />
      <StrataChips />
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
