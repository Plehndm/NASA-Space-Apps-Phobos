import { useApp } from "../state/store";

/** Transient message at the top of the map. Trigger it with `useApp().toast("...")`. */
export function Toast() {
  const { state, geo } = useApp();
  if (!state.toast) return null;
  return (
    <div
      role="status"
      style={{
        position: "absolute", left: geo.mapLeft + 16, right: 16, top: geo.device === "desktop" ? 16 : 76, maxWidth: 380,
        zIndex: 6, display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderRadius: 20,
        background: "rgba(var(--bg1-rgb),.95)", boxShadow: "var(--shadow2)", pointerEvents: "none",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flex: "none", animation: "mn-blink 1.2s infinite" }} />
      <span style={{ font: "600 11px var(--font-ui)", letterSpacing: ".2px", color: "var(--fg)", lineHeight: 1.45 }}>{state.toast}</span>
    </div>
  );
}
