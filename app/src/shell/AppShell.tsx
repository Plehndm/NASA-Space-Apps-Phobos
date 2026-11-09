import { useEffect } from "react";
import { BackHandler, View } from "react-native";
import { useApp } from "../state/store";
import { C } from "../theme";
import { Header } from "./Header";
import { MapArea } from "./MapArea";
import { Sheet } from "./Sheet";
import { EtaCard } from "../cards/Expedition";
import { Toast } from "./Toast";
import { SettingsDialog } from "./SettingsDialog";
import { StreetLevel } from "../street/StreetLevel";

/** Android back button: close settings, Street Level, then popovers, then return to the home sheet. */
function useBackButton() {
  const { state, patch, goHome } = useApp();
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (state.settingsOpen) { patch({ settingsOpen: false }); return true; }
      if (state.street) { patch({ street: null }); return true; }
      if (state.elevOpen || state.heatOpen) { patch({ elevOpen: false, heatOpen: false }); return true; }
      if (state.viaPending) { patch({ viaPending: false }); return true; }
      const home = state.nav ? "nav" : state.stops.length ? "route" : "home";
      if (state.mode !== home) { goHome(); return true; }
      return false; // let the app close
    });
    return () => sub.remove();
  }, [state.settingsOpen, state.street, state.elevOpen, state.heatOpen, state.viaPending, state.mode, state.nav, state.stops.length, patch, goHome]);
}

/** The whole app frame. Phone and desktop share every component; only geometry differs. */
export function AppShell() {
  const { geo, state } = useApp();
  useBackButton();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg0 }}>
      <View style={{ width: geo.W, height: geo.H, overflow: "hidden", backgroundColor: C.bg1 }}>
        <MapArea />
        <Header />
        <Sheet pinned={state.nav ? <EtaCard /> : undefined} />
        <StreetLevel />
        <Toast />
        <SettingsDialog />
      </View>
    </View>
  );
}
