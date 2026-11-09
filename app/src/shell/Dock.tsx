import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { useApp } from "../state/store";
import { alpha, C, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { HazardIcon, LayersIcon } from "../ui/icons";
import { ElevationPopover, HeatPopover } from "../layers/DockPopovers";

const circle = (active: boolean): ViewStyle => ({
  width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", boxShadow: SHADOW.s1,
  backgroundColor: active ? C.cta : alpha("bg1", 0.86), borderWidth: 1, borderColor: active ? C.cta : C.hair,
});

/** Dock button. `children` receives the glyph colour for the current state. */
function DockButton({ active, label, onPress, idleFg = C.fg, children }: {
  active: boolean; label: string; onPress: () => void; idleFg?: string; children: (fg: string) => ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={circle(active)}>
      {children(active ? C.ctaInk : idleFg)}
    </Pressable>
  );
}

function ZoomButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? C.card : "transparent" })}
    >
      <T w={400} size={22} style={{ lineHeight: 24 }}>{glyph}</T>
    </Pressable>
  );
}

/** Right-hand column of map controls: Layers, Hazards, Heatmap, Assistant, zoom. */
export function Dock() {
  const { state: S, geo, settings, patch, setMode, toast, zoomBy } = useApp();
  const panel = settings.layerPicker === "panel";
  const homeMode = S.navActive ? "nav" : "home";

  const toggleLayersPanel = () => {
    const open = S.mode === "layers";
    setMode(open ? homeMode : "layers", open ? "peek" : "half");
    patch({ heatOpen: false, elevOpen: false });
  };
  const toggleLayers = () => {
    if (panel) return toggleLayersPanel();
    const opening = !S.elevOpen;
    patch({ elevOpen: opening, heatOpen: false });
    if (opening && geo.device === "phone") setMode(S.mode, "peek");
  };
  const toggleHeat = () => (panel ? toggleLayersPanel() : patch(s => ({ heatOpen: !s.heatOpen, elevOpen: false })));
  const toggleHaz = () => {
    const on = !S.hazOn;
    patch({ hazOn: on, heatOpen: false });
    if (on) toast("Warning zones on · 5 hazard types tracked");
  };
  const openAssistant = () => {
    setMode("assistant", "full");
    patch({ heatOpen: false, elevOpen: false });
  };

  return (
    // The dock spans the map's width (touches pass through, box-none) so the popovers, which open to
    // the left of the buttons, sit inside it: iOS and Android only deliver touches inside a parent's bounds.
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 12, top: geo.dockTop, zIndex: 3, gap: 10, alignItems: "flex-end" }}>
      {S.elevOpen && <ElevationPopover />}
      {S.heatOpen && !S.elevOpen && <HeatPopover />}
      <View>
        <DockButton active={S.elevOpen || S.mode === "layers" || S.elev > 0} label="Layers" onPress={toggleLayers}>
          {fg => <LayersIcon color={fg} />}
        </DockButton>
      </View>

      {/* The elevation popover is tall, so the rest of the dock hides while it is open. */}
      {!S.elevOpen && (
        <>
          <View>
            <DockButton active={S.hazOn} label="Hazard zones" onPress={toggleHaz}>{fg => <HazardIcon color={fg} />}</DockButton>
            <View
              pointerEvents="none"
              style={{
                position: "absolute", right: 0, top: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.bg1,
                backgroundColor: S.hazOn ? C.accent : C.warm,
              }}
            />
          </View>
          <DockButton active={S.heat !== "off" || S.heatOpen} label="Heatmap" onPress={toggleHeat}>
            {fg => <T w={800} size={11} ls={0.6} color={fg}>HM</T>}
          </DockButton>
          <DockButton active={S.mode === "assistant"} label="Route assistant" onPress={openAssistant} idleFg={C.accent2}>
            {fg => <T w={500} size={17} color={fg} style={{ lineHeight: 20 }}>✦</T>}
          </DockButton>
        </>
      )}

      <View style={{ borderRadius: 22, backgroundColor: alpha("bg1", 0.9), boxShadow: SHADOW.s1, overflow: "hidden", marginTop: 4 }}>
        <ZoomButton label="Zoom in" glyph="+" onPress={() => zoomBy(1.5)} />
        <View style={{ height: 1, marginHorizontal: 12, backgroundColor: C.hair }} />
        <ZoomButton label="Zoom out" glyph="−" onPress={() => zoomBy(1 / 1.5)} />
      </View>
    </View>
  );
}
