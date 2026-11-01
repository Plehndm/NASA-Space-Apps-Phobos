// Popovers that open beside the dock buttons when Settings → Layer controls = DOCK.
// STUBS: the shell opens and closes them; the layer features fill them in.
//   ElevationPopover → checklist "Elevation strata layer"
//   HeatPopover      → checklist "Temperature heat layer"
import { View } from "react-native";
import { alpha, C, SHADOW } from "../theme";
import { T } from "../ui/Text";

function Stub({ title, owner, width }: { title: string; owner: string; width: number }) {
  return (
    <View
      style={{
        position: "absolute", right: 54, top: 0, width, padding: 12, gap: 6,
        borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 8, borderBottomLeftRadius: 22,
        backgroundColor: alpha("bg1", 0.95), boxShadow: SHADOW.s2,
      }}
    >
      <T w={700} size={10} ls={1} color={C.fg2}>{title}</T>
      <T w={500} size={10} lh={1.45} color={C.fg3}>{owner}</T>
    </View>
  );
}

export function ElevationPopover() {
  return <Stub title="ELEVATION STRATA" owner="Not built yet: see checklist item “Elevation strata layer” (src/layers/DockPopovers.tsx)." width={176} />;
}

export function HeatPopover() {
  return <Stub title="GROUND TEMP" owner="Not built yet: see checklist item “Temperature heat layer” (src/layers/DockPopovers.tsx)." width={216} />;
}
