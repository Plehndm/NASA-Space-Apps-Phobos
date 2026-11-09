// Formatting shared by the route cards (the design's fmtMin / fmtKm).
import { pxToKm } from "./router";

/** "47 min", "1 h 05 min" */
export function fmtMin(m: number): string {
  const r = Math.round(m);
  return r >= 60 ? `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, "0")} min` : `${r} min`;
}

/** World px → "6.2 km" */
export const fmtKm = (px: number) => `${pxToKm(px).toFixed(1)} km`;

/** "−4,498 m" / "+733 m" */
export function fmtElev(m: number | null | undefined, signed = false): string {
  if (m == null || !(m === m)) return "— m";
  const s = String(Math.abs(Math.round(m))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${m < -0.5 ? "−" : signed && m > 0.5 ? "+" : ""}${s} m`;
}

export const deg = (g: number) => `${Math.round(g)}°`;
