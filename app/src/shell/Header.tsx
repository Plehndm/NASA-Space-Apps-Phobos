import { useApp } from "../state/store";
import { useMtcClock } from "../state/clock";
import { GearIcon } from "../ui/icons";

/** Top bar: location + MTC clock on the left, status pill and settings gear on the right. */
export function Header() {
  const { geo, state, settings, patch } = useApp();
  const clock = useMtcClock();
  const desk = geo.device === "desktop";

  return (
    <>
      <header
        style={{
          position: "absolute", left: 0, top: 0, width: geo.panelW, height: geo.headerH, zIndex: 5,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
          background: desk ? "var(--bg2)" : "linear-gradient(180deg,rgba(27,16,13,.94),rgba(27,16,13,.62))",
          backdropFilter: desk ? undefined : "blur(18px)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: "700 15px var(--font-ui)", letterSpacing: "-.2px", color: "var(--fg)" }}>Gale Crater</span>
          <span style={{ font: "500 11px var(--font-ui)", letterSpacing: ".3px", color: "var(--fg2)" }}>Sol 742 · {clock} MTC</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              font: "700 9.5px var(--font-ui)", letterSpacing: ".6px", padding: "6px 11px", borderRadius: 999,
              background: "rgba(var(--raised-rgb),.75)", whiteSpace: "nowrap", flex: "none",
              color: state.navActive ? "var(--warm)" : "var(--fg2)",
            }}
          >
            {state.navActive ? `DEMO ×${settings.demoSpeed}` : "OFFLINE MAPS ✓"}
          </span>
          <button
            title="Settings"
            aria-label="Settings"
            onClick={() => patch({ settingsOpen: true, elevOpen: false, heatOpen: false })}
            style={{
              width: 36, height: 36, borderRadius: "50%", background: "rgba(var(--raised-rgb),.75)", border: 0,
              color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <GearIcon />
          </button>
        </div>
      </header>
      {!desk && (
        <div
          style={{
            position: "absolute", left: 0, top: geo.headerH, width: geo.W, height: 36, zIndex: 5, pointerEvents: "none",
            background: "linear-gradient(180deg,rgba(27,16,13,.5),rgba(27,16,13,0))",
          }}
        />
      )}
    </>
  );
}
