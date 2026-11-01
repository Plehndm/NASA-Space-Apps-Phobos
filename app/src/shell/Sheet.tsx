import { useRef, type PointerEvent, type ReactNode } from "react";
import { useApp, type SnapName } from "../state/store";
import { SearchBar } from "./SearchBar";
import { CardStack } from "../cards/CardStack";

const EASE = "var(--ease-sheet)";

/** Drag handle for the phone sheet. A tap steps peek → half → full → peek; a drag snaps to the nearest point. */
function Handle() {
  const { state, geo, patch, snapTo } = useApp();
  const drag = useRef<{ y: number; start: number; moved: number } | null>(null);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, start: state.sheetY, moved: 0 };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dy));
    patch({ sheetY: Math.max(geo.sheetMin, Math.min(geo.sheetMax, d.start + dy)), sheetDragging: true });
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const y = state.sheetY, p = geo.snap;
    let next: SnapName;
    if (d.moved < 6) next = y >= p.peek ? "half" : y >= p.half ? "full" : "peek";
    else next = (Object.entries(p) as [SnapName, number][]).sort((a, b) => Math.abs(a[1] - y) - Math.abs(b[1] - y))[0][0];
    snapTo(next);
  };

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="slider"
      aria-label="Resize panel"
      aria-valuenow={state.sheetY}
      style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none", flex: "none" }}
    >
      <div style={{ width: 44, height: 5, borderRadius: 3, background: "var(--line)" }} />
    </div>
  );
}

/**
 * Phone: bottom sheet with three snap points. Desktop: fixed 420 px left panel under the header.
 * Both hold the same content: pinned slot (ETA card while navigating), search bar, scrolling card stack.
 */
export function Sheet({ pinned }: { pinned?: ReactNode }) {
  const { state: S, geo } = useApp();
  const desk = geo.device === "desktop";

  const style = desk
    ? {
        position: "absolute" as const, left: 0, top: geo.headerH, width: geo.panelW, height: geo.H - geo.headerH,
        background: "var(--bg2)", boxShadow: "12px 0 40px rgba(10,4,2,.45)",
      }
    : {
        position: "absolute" as const, left: 0, top: S.sheetY, width: geo.W, height: geo.H - S.sheetY,
        background: "var(--sheet)", backdropFilter: "blur(var(--blur))", borderRadius: "var(--r-sheet) var(--r-sheet) 0 0",
        boxShadow: "var(--shadow-sheet)", transition: S.sheetDragging ? "none" : `top .35s ${EASE}, height .35s ${EASE}`,
      };

  return (
    <section aria-label="Panel" style={{ ...style, display: "flex", flexDirection: "column", zIndex: 4 }}>
      {desk ? <div style={{ height: 14, flex: "none" }} /> : <Handle />}
      {pinned}
      <SearchBar />
      <div
        className="mn-scroll mn-stack"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 28px", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <CardStack />
      </div>
    </section>
  );
}
