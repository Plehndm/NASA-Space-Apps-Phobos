import { useApp } from "../state/store";
import { Header } from "./Header";
import { MapArea } from "./MapArea";
import { Sheet } from "./Sheet";
import { Toast } from "./Toast";
import { SettingsDialog } from "./SettingsDialog";

/** The whole app frame. Phone and desktop share every component; only geometry differs. */
export function AppShell() {
  const { geo } = useApp();
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg0)" }}>
      <div
        style={{
          position: "relative", width: geo.W, height: geo.H, overflow: "hidden", background: "var(--bg1)",
          userSelect: "none", WebkitUserSelect: "none", flex: "none",
        }}
      >
        <MapArea />
        <Header />
        <Sheet />
        <Toast />
        <SettingsDialog />
      </div>
    </div>
  );
}
