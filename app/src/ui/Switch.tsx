/** 44×24 toggle. `tone="cta"` is used by the hazard toggle; everything else uses the accent. */
export function Switch({ on, onChange, tone = "accent", label }: {
  on: boolean;
  onChange: (on: boolean) => void;
  tone?: "accent" | "cta";
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 0, position: "relative", cursor: "pointer", flex: "none",
        background: on ? `var(--${tone})` : "var(--line)", transition: "background .2s",
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 10,
          background: on ? "var(--bg1)" : "var(--fg3)", transition: "left .2s", boxShadow: "0 2px 6px rgba(0,0,0,.3)",
        }}
      />
    </button>
  );
}
