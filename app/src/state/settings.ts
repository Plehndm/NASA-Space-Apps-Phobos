// User-adjustable settings. Defaults match the prototype's DEF table.
export interface Settings {
  layerPicker: "dock" | "panel";
  hazardStyle: "advisory" | "banner";
  progressCard: "stepped" | "compact";
  maxGrade: number; // degrees, Route #2 grade cap (8–30)
  demoSpeed: number; // simulation speed multiplier (10–240)
  chipStyle: "counts" | "icons";
  inlineNotes: boolean;
  legendMinK: number; // heat legend endpoints, provisional until the data team confirms
  legendMaxK: number;
}

export const DEFAULT_SETTINGS: Settings = {
  layerPicker: "dock",
  hazardStyle: "advisory",
  progressCard: "stepped",
  maxGrade: 18,
  demoSpeed: 60,
  chipStyle: "counts",
  inlineNotes: true,
  legendMinK: 180,
  legendMaxK: 280,
};

const STORAGE_KEY = "mn.settings";

// Overrides are remembered per browser; storage can be unavailable, so never throw.
export function loadOverrides(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(o: Partial<Settings>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}
