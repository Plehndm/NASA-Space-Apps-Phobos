// Popovers that open beside the dock buttons when Settings → Layer controls = DOCK.
// STUBS: the shell opens and closes them; the layer features fill them in.
//   ElevationPopover → checklist "Elevation strata layer"
//   HeatPopover      → checklist "Temperature heat layer"
import type { ReactNode } from "react";

function Stub({ title, owner, width }: { title: string; owner: string; width: number }) {
  return (
    <div
      style={{
        position: "absolute", right: 54, top: 0, width, padding: 12, borderRadius: "22px 22px 8px 22px",
        background: "rgba(var(--bg1-rgb),.95)", boxShadow: "var(--shadow2)", display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      <span style={{ font: "700 10px var(--font-ui)", letterSpacing: 1, color: "var(--fg2)" }}>{title}</span>
      <span style={{ font: "500 10px var(--font-ui)", color: "var(--fg3)", lineHeight: 1.45 }}>{owner}</span>
    </div>
  );
}

export function ElevationPopover(): ReactNode {
  return <Stub title="ELEVATION STRATA" owner="Not built yet: see checklist item “Elevation strata layer” (src/layers/DockPopovers.tsx)." width={176} />;
}

export function HeatPopover(): ReactNode {
  return <Stub title="GROUND TEMP" owner="Not built yet: see checklist item “Temperature heat layer” (src/layers/DockPopovers.tsx)." width={216} />;
}
