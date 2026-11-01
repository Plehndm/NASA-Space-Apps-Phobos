import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type Device = "phone" | "desktop";

/** Frame and panel geometry shared by every component that positions itself over the map. */
export interface Geometry {
  device: Device;
  W: number; // frame width
  H: number; // frame height
  panelW: number; // desktop side panel width (phone: full width)
  headerH: number; // includes the phone's top safe area (notch / status bar)
  insetTop: number;
  insetBottom: number;
  mapLeft: number; // map area starts here (desktop: right of the panel)
  mapW: number;
  dockTop: number; // top of the right-hand dock, in map-area px
  overlayTop: number; // top of toasts, banners and the coordinate pill
  /** Phone sheet snap points, as the sheet's top edge in px. */
  snap: { full: number; half: number; peek: number };
  /** Phone sheet can be dragged between these top values. */
  sheetMin: number;
  sheetMax: number;
}

// The prototype is drawn at 393×852 (phone) and 1440×900 (desktop).
const PHONE = { W: 393, H: 852 };
const DESKTOP_MIN_W = 900;

/** On web, `?device=phone|desktop` forces a layout. Otherwise it follows the window width. */
function forcedDevice(): Device | null {
  if (Platform.OS !== "web" || typeof location === "undefined") return null;
  const d = new URLSearchParams(location.search).get("device");
  return d === "phone" || d === "desktop" ? d : null;
}

export function computeGeometry(winW: number, winH: number, insetTop: number, insetBottom: number): Geometry {
  const device = forcedDevice() ?? (winW >= DESKTOP_MIN_W ? "desktop" : "phone");
  if (device === "desktop") {
    const panelW = 420;
    return {
      device, W: winW, H: winH, panelW, headerH: 72, insetTop: 0, insetBottom: 0, mapLeft: panelW, mapW: winW - panelW,
      dockTop: 16, overlayTop: 16, snap: { full: 0, half: 0, peek: 0 }, sheetMin: 0, sheetMax: 0,
    };
  }
  // A phone layout forced on a wide web window shows the prototype's 393×852 frame, for 1:1 comparison.
  const framed = winW > 600;
  const W = framed ? PHONE.W : winW;
  const H = framed ? Math.min(PHONE.H, winH) : winH;
  const headerH = 64 + insetTop;
  // Snap points scale with height; on an 852 px screen with no notch they are the prototype's 76 / 250 / 400.
  const k = H / PHONE.H;
  return {
    device, W, H, panelW: W, headerH, insetTop, insetBottom, mapLeft: 0, mapW: W,
    dockTop: headerH + 16, overlayTop: headerH + 12,
    snap: { full: headerH + 12, half: Math.round(250 * k) + insetTop, peek: Math.round(400 * k) + insetTop },
    sheetMin: headerH - 4,
    sheetMax: Math.round(560 * k) + insetTop,
  };
}

export function useGeometry(): Geometry {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(() => computeGeometry(width, height, insets.top, insets.bottom), [width, height, insets.top, insets.bottom]);
}
