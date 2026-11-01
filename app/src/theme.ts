// Design tokens, ported from "Mars Navigator App Design/README.md".
// Use these everywhere instead of raw colours or numbers.
import type { TextStyle } from "react-native";

const rgb = {
  bg1: "27,16,13",
  bg2: "35,21,18",
  row: "46,30,25",
  raised: "71,50,42",
  accent: "127,212,193",
  cta: "236,122,86",
  warm: "255,195,148",
} as const;

/** `alpha("bg1", .9)` → "rgba(27,16,13,0.9)", the equivalent of CSS `rgba(var(--bg1-rgb),.9)`. */
export const alpha = (name: keyof typeof rgb, a: number) => `rgba(${rgb[name]},${a})`;

export const C = {
  bg0: "#140b09",
  bg1: "#1b100d",
  bg2: "#231512",
  sheet: "rgba(35,21,18,0.94)",
  row: "#2e1e19",
  card: "#36251f",
  raised: "#47322a",
  line: "#5e4537",
  hair: "rgba(255,216,190,0.08)",

  fg: "#f8ece4",
  fg2: "#dcb9a6",
  fg3: "#ab8878",

  accent: "#7fd4c1",
  accent2: "#cdf3ea",
  accentInk: "#0d2a24",
  route: "#7fd4c1",
  route2: "#cdf3ea",
  routeInk: "#0d2a24",

  cta: "#ec7a56",
  ctaHover: "#f78d6b",
  ctaInk: "#2b0d04",

  warm: "#ffc394",
  warm2: "#f2b98f",
  warm3: "#ffe3cc",

  danger: "#ff6b5e",
  dangerBg: "rgba(255,107,94,0.12)",
  dangerBd: "rgba(255,107,94,0.35)",
  dangerDeep: "#9b2418",

  // Fixed hazard colours
  hazDust: "#d946ef",
  hazSteep: "#ef4444",
  hazRough: "#f4baa0",
  hazRadiation: "#c5c6ff",
  hazSand: "#ffb4a5",

  // Elevation strata chips
  strataL1: "#e0bfb8",
  strataL2: "#2eb21e",
  strataL3: "#4c4eff",
} as const;

/** Gradient stops for expo-linear-gradient. */
export const GRADIENT = {
  strata: ["#4a3401", "#2db11c", "#0e0cca"] as const, // top (summit) → bottom (floor)
  plasma: ["#0d0887", "#46039f", "#7201a8", "#9c179e", "#bd3786", "#d8576b", "#ed7953", "#fb9f3a", "#f0f921"] as const,
};

/**
 * Corner radii. The design's "pebble" radii are elliptical in CSS; React Native only has
 * circular corners, so each corner uses the average of its two CSS radii.
 */
export const R = {
  sheet: 34,
  card: 22,
  row: 18,
  btn: 999,
  xs: 12,
  pebble: { borderTopLeftRadius: 29, borderTopRightRadius: 23, borderBottomRightRadius: 29, borderBottomLeftRadius: 19 },
  pebble2: { borderTopLeftRadius: 19, borderTopRightRadius: 29, borderBottomRightRadius: 23, borderBottomLeftRadius: 29 },
} as const;

/** `boxShadow` strings (supported by React Native's New Architecture and on web). */
export const SHADOW = {
  s1: "0px 8px 20px rgba(10,4,2,0.4)",
  s2: "0px 14px 36px rgba(10,4,2,0.5)",
  sheet: "0px -18px 50px rgba(10,4,2,0.5)",
  glow: "0px 10px 26px rgba(236,122,86,0.35)",
  side: "12px 0px 40px rgba(10,4,2,0.45)",
} as const;

/** Sheet / panel easing: cubic-bezier(.2,.8,.2,1). */
export const EASE = [0.2, 0.8, 0.2, 1] as const;

// Plus Jakarta Sans, loaded in App.tsx. Each weight is a separate font family on native.
const FAMILY = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
} as const;
export type Weight = keyof typeof FAMILY;

/** Text style for a weight and size, like CSS `font: 700 15px`. `lh` is a line-height multiplier. */
export function font(weight: Weight, size: number, ls?: number, lh?: number): TextStyle {
  return {
    fontFamily: FAMILY[weight],
    fontSize: size,
    ...(ls !== undefined ? { letterSpacing: ls } : null),
    ...(lh !== undefined ? { lineHeight: Math.round(size * lh) } : null),
    fontVariant: ["tabular-nums"],
  };
}
