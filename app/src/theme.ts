// Design tokens, ported from "Mars Navigator App Design/README.md".
// Use these everywhere instead of raw colours or numbers.
//
// Two palettes: DARK (the design, and the default) and LIGHT (the same warm palette on a pale dust
// ground, matching the project page's light mode). Screens read the active one with `useTheme()` from
// `state/theme.tsx`. The static `C`, `alpha` and `SHADOW` below are the dark palette; they stay for
// things drawn over the map imagery and in Street Level, which keep the dark look in both modes.
import type { TextStyle } from "react-native";

export type ThemeName = "dark" | "light";

const RGB_DARK = {
  bg1: "27,16,13",
  bg2: "35,21,18",
  row: "46,30,25",
  raised: "71,50,42",
  accent: "127,212,193",
  cta: "236,122,86",
  warm: "255,195,148",
  warm3: "255,227,204", // #ffe3cc (map grid)
};
export type RgbName = keyof typeof RGB_DARK;

const RGB_LIGHT: Record<RgbName, string> = {
  bg1: "248,239,231",
  bg2: "255,249,244",
  row: "241,227,214",
  raised: "229,209,193",
  accent: "29,122,103",
  cta: "185,71,31",
  warm: "168,83,35",
  warm3: "255,227,204", // map grid: drawn on the imagery, same in both modes
};

const DARK = {
  bg0: "#140b09",
  bg1: "#1b100d",
  bg2: "#231512",
  sheet: "rgba(35,21,18,0.94)",
  row: "#2e1e19",
  card: "#36251f",
  raised: "#47322a",
  line: "#5e4537",
  hair: "rgba(255,216,190,0.08)",
  scrim: "rgba(20,11,9,0.55)", // backdrop behind dialogs

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
};
export type Palette = { readonly [K in keyof typeof DARK]: string };

const LIGHT: Palette = {
  ...DARK,
  bg0: "#eadbcd",
  bg1: "#f8efe7",
  bg2: "#fff9f4",
  sheet: "rgba(255,249,244,0.95)",
  row: "#f1e3d6",
  card: "#f5e7da",
  raised: "#e5d1c1",
  line: "#cfb6a3",
  hair: "rgba(80,40,20,0.12)",
  scrim: "rgba(60,35,20,0.35)",

  fg: "#2b1810",
  fg2: "#5c4033",
  fg3: "#87675a",

  accent: "#1d7a67",
  accent2: "#155e4f",
  accentInk: "#f2fffb",
  // route, route2, routeInk: the route is drawn on the imagery, so it keeps the dark-mode colours.

  cta: "#b9471f",
  ctaHover: "#c95428",
  ctaInk: "#fff8f3",

  warm: "#a85323",
  warm2: "#c27a4b",
  // warm3 is the map grid, on the imagery.

  danger: "#c4382b",
  dangerBg: "rgba(196,56,43,0.10)",
  dangerBd: "rgba(196,56,43,0.35)",
  // Hazard and strata colours are the map's; they stay the same.
};

const SHADOW_DARK = {
  s1: "0px 8px 20px rgba(10,4,2,0.4)",
  s2: "0px 14px 36px rgba(10,4,2,0.5)",
  sheet: "0px -18px 50px rgba(10,4,2,0.5)",
  sheetEdge: "inset 0px 1px 0px rgba(255,216,190,0.08)", // top highlight on the phone sheet
  glow: "0px 10px 26px rgba(236,122,86,0.35)",
  side: "12px 0px 40px rgba(10,4,2,0.45)",
};
export type Shadows = { readonly [K in keyof typeof SHADOW_DARK]: string };

const SHADOW_LIGHT: Shadows = {
  s1: "0px 8px 20px rgba(90,50,30,0.14)",
  s2: "0px 14px 36px rgba(90,50,30,0.2)",
  sheet: "0px -18px 50px rgba(90,50,30,0.12)",
  sheetEdge: "inset 0px 1px 0px rgba(255,255,255,0.6)",
  glow: "0px 10px 26px rgba(185,71,31,0.25)",
  side: "12px 0px 40px rgba(90,50,30,0.14)",
};

/** Everything that changes between dark and light. */
export interface Theme {
  name: ThemeName;
  C: Palette;
  SHADOW: Shadows;
  /** `alpha("bg1", .9)` → "rgba(27,16,13,0.9)", the equivalent of CSS `rgba(var(--bg1-rgb),.9)`. */
  alpha: (name: RgbName, a: number) => string;
}

const makeAlpha = (rgb: Record<RgbName, string>) => (name: RgbName, a: number) => `rgba(${rgb[name]},${a})`;

export const THEMES: Record<ThemeName, Theme> = {
  dark: { name: "dark", C: DARK, SHADOW: SHADOW_DARK, alpha: makeAlpha(RGB_DARK) },
  light: { name: "light", C: LIGHT, SHADOW: SHADOW_LIGHT, alpha: makeAlpha(RGB_LIGHT) },
};

/** The dark palette, for map overlays and Street Level (same in both modes). Screens use `useTheme()`. */
export const C: Palette = DARK;
/** Dark-palette `alpha`, for map overlays and Street Level. Screens use `useTheme().alpha`. */
export const alpha = THEMES.dark.alpha;

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

/** Dark-mode `boxShadow` strings, for map overlays and Street Level. Screens use `useTheme().SHADOW`. */
export const SHADOW: Shadows = SHADOW_DARK;

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
