import { useEffect } from "react";
import { BackHandler, View } from "react-native";
import { useApp } from "../state/store";
import { C } from "../theme";
import { Header } from "./Header";
import { MapArea } from "./MapArea";
import { Sheet } from "./Sheet";
import { Toast } from "./Toast";
import { SettingsDialog } from "./SettingsDialog";

/** Android back button: close settings, then popovers, then return to the home sheet. */
function useBackButton() {
  const { state, patch, setMode } = useApp();
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (state.settingsOpen) { patch({ settingsOpen: false }); return true; }
      if (state.elevOpen || state.heatOpen) { patch({ elevOpen: false, heatOpen: false }); return true; }
      const home = state.navActive ? "nav" : "home";
      if (state.mode !== home) { setMode(home, "peek"); return true; }
      return false; // let the app close
    });
    return () => sub.remove();
  }, [state.settingsOpen, state.elevOpen, state.heatOpen, state.mode, state.navActive, patch, setMode]);
}

/** The whole app frame. Phone and desktop share every component; only geometry differs. */
export function AppShell() {
  const { geo } = useApp();
  useBackButton();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg0 }}>
      <View style={{ width: geo.W, height: geo.H, overflow: "hidden", backgroundColor: C.bg1 }}>
        <MapArea />
        <Header />
        <Sheet />
        <Toast />
        <SettingsDialog />
      </View>
    </View>
  );
}
