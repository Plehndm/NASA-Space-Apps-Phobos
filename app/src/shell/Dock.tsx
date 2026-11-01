import type { CSSProperties, ReactNode } from "react";
import { useApp } from "../state/store";
import { HazardIcon, LayersIcon } from "../ui/icons";
import { ElevationPopover, HeatPopover } from "../layers/DockPopovers";

function dockStyle(active: boolean, activeFg = "var(--cta-ink)", idleFg = "var(--fg)"): CSSProperties {
  return {
    width: 44, height: 44, borderRadius: "50%", flex: "none", cursor: "pointer", transition: "background .2s",
    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow1)", backdropFilter: "blur(var(--blur))",
    background: active ? "var(--cta)" : "rgba(var(--bg1-rgb),.86)",
    border: `1px solid ${active ? "var(--cta)" : "var(--hair)"}`,
    color: active ? activeFg : idleFg,
  };
}

function DockButton({ active, title, onClick, children, style }: {
  active: boolean; title: string; onClick: () => void; children: ReactNode; style?: CSSProperties;
}) {
  return (
    <button title={title} aria-label={title} aria-pressed={active} onClick={onClick} style={{ ...dockStyle(active), ...style }}>
      {children}
    </button>
  );
}

const zoomBtn: CSSProperties = {
  width: 44, height: 40, border: 0, background: "none", color: "var(--fg)", font: "400 22px var(--font-ui)", cursor: "pointer", lineHeight: 1,
};

/** Right-hand column of map controls: Layers, Hazards, Heatmap, Assistant, zoom. */
export function Dock() {
  const { state: S, geo, settings, patch, setMode, toast, zoomBy } = useApp();
  const panel = settings.layerPicker === "panel";
  const homeMode = S.navActive ? "nav" : "home";

  const toggleLayers = () => {
    if (panel) {
      const open = S.mode === "layers";
      setMode(open ? homeMode : "layers", open ? "peek" : "half");
      patch({ heatOpen: false });
    } else {
      patch(s => ({ elevOpen: !s.elevOpen, heatOpen: false, ...(s.elevOpen || geo.device !== "phone" ? {} : { sheetY: geo.snap.peek }) }));
    }
  };
  const toggleHeat = () => {
    if (panel) {
      const open = S.mode === "layers";
      setMode(open ? homeMode : "layers", open ? "peek" : "half");
    } else patch(s => ({ heatOpen: !s.heatOpen, elevOpen: false }));
  };
  const toggleHaz = () => {
    const on = !S.hazOn;
    patch({ hazOn: on, heatOpen: false });
    if (on) toast("Warning zones on · 5 hazard types tracked");
  };
  const openAssistant = () => {
    setMode("assistant", "full");
    patch({ heatOpen: false, elevOpen: false });
  };

  const layersActive = S.elevOpen || S.mode === "layers" || S.elev > 0;
  const heatActive = S.heat !== "off" || S.heatOpen;
  const aiActive = S.mode === "assistant";

  return (
    <div
      data-nopan="1"
      style={{
        position: "absolute", right: 12, top: geo.device === "desktop" ? 16 : 80, zIndex: 3,
        display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end",
      }}
    >
      <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "flex-start" }}>
        {S.elevOpen && <ElevationPopover />}
        <DockButton active={layersActive} title="Layers" onClick={toggleLayers}><LayersIcon /></DockButton>
      </div>

      {/* The elevation popover is tall, so the rest of the dock hides while it is open. */}
      {!S.elevOpen && (
        <>
          <div style={{ position: "relative" }}>
            <DockButton active={S.hazOn} title="Hazard zones" onClick={toggleHaz}><HazardIcon /></DockButton>
            <span
              style={{
                position: "absolute", right: 0, top: 0, width: 10, height: 10, borderRadius: "50%", border: "2px solid var(--bg1)",
                background: S.hazOn ? "var(--accent)" : "var(--warm)",
              }}
            />
          </div>
          <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "flex-start" }}>
            {S.heatOpen && <HeatPopover />}
            <DockButton active={heatActive} title="Heatmap" onClick={toggleHeat} style={{ font: "800 11px var(--font-ui)", letterSpacing: ".6px" }}>
              HM
            </DockButton>
          </div>
          <button
            title="Route assistant"
            aria-label="Route assistant"
            aria-pressed={aiActive}
            onClick={openAssistant}
            style={{ ...dockStyle(aiActive, "var(--cta-ink)", "var(--accent2)"), fontSize: 17, lineHeight: 1 }}
          >
            ✦
          </button>
        </>
      )}

      <div
        style={{
          display: "flex", flexDirection: "column", borderRadius: 22, background: "rgba(var(--bg1-rgb),.9)",
          backdropFilter: "blur(var(--blur))", boxShadow: "var(--shadow1)", overflow: "hidden", marginTop: 4,
        }}
      >
        <button aria-label="Zoom in" onClick={() => zoomBy(1.5)} style={zoomBtn}>+</button>
        <div style={{ height: 1, margin: "0 12px", background: "var(--hair)" }} />
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} style={zoomBtn}>−</button>
      </div>
    </div>
  );
}
