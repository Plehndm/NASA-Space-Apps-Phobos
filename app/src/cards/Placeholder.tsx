import { useApp } from "../state/store";
import { Card } from "../ui/Card";
import { CloseIcon } from "../ui/icons";

/** Stand-in for a card stack that has not been built yet. Names the checklist item that owns it. */
export function Placeholder({ title, item, note, closable }: { title: string; item: string; note: string; closable?: boolean }) {
  const { state, setMode } = useApp();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
        <span style={{ font: "700 22px var(--font-ui)", letterSpacing: "-.5px", color: "var(--fg)" }}>{title}</span>
        {(closable || state.mode !== "home") && (
          <button
            aria-label="Back"
            onClick={() => setMode(state.navActive ? "nav" : "home", "peek")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--raised)", border: 0, color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <Card pebble={1} style={{ border: "1.5px dashed var(--line)", background: "rgba(var(--row-rgb),.6)" }}>
        <div style={{ font: "700 9px var(--font-ui)", letterSpacing: "1px", color: "var(--warm)" }}>NOT BUILT YET</div>
        <div style={{ font: "600 14px var(--font-ui)", color: "var(--fg)", marginTop: 6 }}>{item}</div>
        <div style={{ font: "500 12px var(--font-ui)", color: "var(--fg2)", marginTop: 4, lineHeight: 1.5 }}>{note}</div>
        <div style={{ font: "500 10.5px var(--font-ui)", color: "var(--fg3)", marginTop: 8 }}>
          Claim it in issue #3, then replace this placeholder in <code>src/cards/CardStack.tsx</code>.
        </div>
      </Card>
    </>
  );
}
