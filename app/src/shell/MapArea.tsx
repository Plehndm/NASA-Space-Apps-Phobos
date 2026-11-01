import { useApp } from "../state/store";
import { Dock } from "./Dock";

/** World space is 512×683 px; one world px = 100 m. Every layer is drawn in world px. */
export const WORLD = { w: 512, h: 683 };

/**
 * The map area: transformed world container, haze, sheet scrim and the dock.
 * STUB for the map: only the base image and the view transform are here. Pan / pinch / wheel,
 * the coordinate pill, scale bar and recenter button belong to checklist item "Map engine";
 * each layer adds itself inside the world container.
 */
export function MapArea() {
  const { state: S, geo } = useApp();
  const { s, tx, ty, anim } = S.view;
  const p = geo.snap;
  const scrim = geo.device === "phone" ? Math.max(0, Math.min(0.5, ((p.peek - S.sheetY) / (p.peek - p.full)) * 0.5)) : 0;

  return (
    <div
      style={{
        position: "absolute", left: geo.mapLeft, top: 0, width: geo.mapW, height: geo.H, overflow: "hidden",
        background: "var(--bg1)", touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: WORLD.w, height: WORLD.h, transformOrigin: "0 0", willChange: "transform",
          transform: `translate(${tx}px,${ty}px) scale(${s})`,
          transition: anim ? "transform .45s var(--ease-sheet)" : "none",
        }}
      >
        <img
          src="assets/world.png"
          alt=""
          draggable={false}
          style={{ position: "absolute", left: 0, top: 0, width: WORLD.w, height: WORLD.h, filter: "var(--map-filter)" }}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg,rgba(255,172,122,.2) 0%,rgba(255,172,122,0) 32%)" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "var(--bg0)", opacity: scrim, transition: "opacity .25s" }} />
      <Dock />
    </div>
  );
}
