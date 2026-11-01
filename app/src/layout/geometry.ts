import { useEffect, useState } from "react";

export type Device = "phone" | "desktop";

/** Frame and panel geometry shared by every component that positions itself over the map. */
export interface Geometry {
  device: Device;
  W: number; // frame width
  H: number; // frame height
  panelW: number; // desktop side panel width (phone: full width)
  headerH: number;
  mapLeft: number; // map area starts here (desktop: right of the panel)
  mapW: number;
  /** Phone sheet snap points, as the sheet's top edge in px. */
  snap: { full: number; half: number; peek: number };
  /** Phone sheet can be dragged between these top values. */
  sheetMin: number;
  sheetMax: number;
}

// The prototype is drawn at 393×852 (phone) and 1440×900 (desktop).
const PHONE = { W: 393, H: 852 };
const DESKTOP_MIN_W = 900;

/** `?device=phone|desktop` forces a layout; otherwise it follows the window width. */
function pickDevice(width: number): Device {
  const forced = new URLSearchParams(location.search).get("device");
  if (forced === "phone" || forced === "desktop") return forced;
  return width >= DESKTOP_MIN_W ? "desktop" : "phone";
}

export function computeGeometry(winW: number, winH: number): Geometry {
  const device = pickDevice(winW);
  if (device === "desktop") {
    const panelW = 420;
    return {
      device, W: winW, H: winH, panelW, headerH: 72, mapLeft: panelW, mapW: winW - panelW,
      snap: { full: 0, half: 0, peek: 0 }, sheetMin: 0, sheetMax: 0,
    };
  }
  // On a real phone the frame is the whole window. When the phone layout is forced on a wide
  // screen, show the prototype's 393×852 frame so the design can be compared 1:1.
  const W = winW <= 600 ? winW : PHONE.W;
  const H = winW <= 600 ? winH : Math.min(PHONE.H, winH);
  // Snap points scale with height; at 852 px they are the prototype's 76 / 250 / 400.
  const k = H / PHONE.H;
  return {
    device, W, H, panelW: W, headerH: 64, mapLeft: 0, mapW: W,
    snap: { full: 76, half: Math.round(250 * k), peek: Math.round(400 * k) },
    sheetMin: 60,
    sheetMax: Math.round(560 * k),
  };
}

/** Size of the page's layout viewport (more reliable than innerWidth on mobile and in headless browsers). */
function viewport(): [number, number] {
  const el = document.documentElement;
  return [el.clientWidth, el.clientHeight];
}

export function useGeometry(): Geometry {
  const [g, setG] = useState(() => computeGeometry(...viewport()));
  useEffect(() => {
    const update = () => setG(computeGeometry(...viewport()));
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);
  return g;
}
