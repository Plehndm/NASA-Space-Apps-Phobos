import AsyncStorage from "@react-native-async-storage/async-storage";

// User-adjustable settings. Defaults match the prototype's DEF table.
export interface Settings {
  layerPicker: "dock" | "panel";
  hazardStyle: "advisory" | "banner";
  progressCard: "stepped" | "compact";
  maxGrade: number; // degrees, Route #2 grade cap (8–30)
  demoSpeed: number; // simulation speed multiplier (10–240)
  chipStyle: "counts" | "icons";
  inlineNotes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  layerPicker: "dock",
  hazardStyle: "advisory",
  progressCard: "stepped",
  maxGrade: 18,
  demoSpeed: 60,
  chipStyle: "counts",
  inlineNotes: true,
};
// The prototype's legendMinK / legendMaxK (a provisional 180–280 K) are gone: the heat legend now uses
// the pipeline's fixed colour scale, 150–320 K, read from the map data manifest.

const STORAGE_KEY = "mn.settings";

/** Allowed values per setting. Stored data is untrusted (an old app version, a hand edit, web storage). */
const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  layerPicker: ["dock", "panel"],
  hazardStyle: ["advisory", "banner"],
  progressCard: ["stepped", "compact"],
  chipStyle: ["counts", "icons"],
};
const RANGES: Partial<Record<keyof Settings, [number, number]>> = { maxGrade: [8, 30], demoSpeed: [10, 240] };

/** Keep only known settings with valid values; numbers are clamped to the sliders' ranges. */
export function sanitizeOverrides(o: unknown): Partial<Settings> {
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = k as keyof Settings;
    if (!(key in DEFAULT_SETTINGS)) continue;
    const e = ENUMS[key], r = RANGES[key];
    if (e && typeof v === "string" && e.includes(v)) out[key] = v;
    else if (r && typeof v === "number" && Number.isFinite(v)) out[key] = Math.round(Math.min(r[1], Math.max(r[0], v)));
    else if (key === "inlineNotes" && typeof v === "boolean") out[key] = v;
  }
  return out as Partial<Settings>;
}

// Overrides are remembered on the device. Storage can fail; the app then just uses defaults.
export async function loadOverrides(): Promise<Partial<Settings>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeOverrides(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

const RECENT_KEY = "mn.recent";
export const RECENT_MAX = 4;

/** Recent searches (landmark ids), validated against the ids the app knows. */
export async function loadRecent(known: (id: string) => boolean): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (raw == null) return null;
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((id): id is string => typeof id === "string" && known(id)).slice(0, RECENT_MAX) : [];
  } catch {
    return null;
  }
}

export function saveRecent(ids: string[]) {
  AsyncStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX))).catch(() => {});
}

export function saveOverrides(o: Partial<Settings>) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(o)).catch(() => {});
}
