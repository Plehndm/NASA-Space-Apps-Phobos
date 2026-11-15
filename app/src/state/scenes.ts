// Demo scenes: `?scene=<name>` on web jumps the app into one state on load, for screenshots, the slide
// deck and the demo video (the design's `applyScene`). In a dev build on a phone, EXPO_PUBLIC_SCENE
// does the same. This file only says which scene and with what; src/shell/DemoScene.tsx applies it once,
// through the app's own actions.
import { Platform } from "react-native";
import type { Category } from "../map/landmarks";

export const SCENES = ["home", "layers", "search", "waypoint", "route", "nav", "assistant", "settings", "about"] as const;
export type Scene = (typeof SCENES)[number];

// What each scene shows. The design's landmark ids all exist in the app.
export const SEARCH_CAT: Category = "Geological";
export const WAYPOINT = "rocknest";
export const ROUTE_STOPS = ["yellowknife", "rocknest", "pahrump"];
export const NAV_STOPS = ["rocknest", "pahrump"];
export const NAV_PROGRESS = 0.3; // share of the expedition already driven
export const NAV_ZOOM = 1.9; // at least this close on the rover
// The design asks to avoid "Dust Devil #84", its moving fake; the app has the pipeline's heating index instead.
export const ASSISTANT_Q = "Plan a 3-stop science day that stays clear of dust devils";

export const parseScene = (v: string | null | undefined): Scene | null =>
  (SCENES as readonly string[]).includes(v ?? "") ? (v as Scene) : null;

/** Scenes that plan routes, so they wait for the terrain and the routing grid. */
export const needsRoutes = (s: Scene) => s === "waypoint" || s === "route" || s === "nav" || s === "assistant";

/** The URL's `?scene=` wins; the EXPO_PUBLIC_SCENE variable counts only in a dev build. */
export function sceneFrom(search: string | null, env: string | undefined, dev: boolean): Scene | null {
  return parseScene(search === null ? null : new URLSearchParams(search).get("scene")) ?? (dev ? parseScene(env) : null);
}

/** The scene asked for when the app started, or null. */
export function startScene(): Scene | null {
  const search = Platform.OS === "web" && typeof location !== "undefined" ? location.search : null;
  return sceneFrom(search, process.env.EXPO_PUBLIC_SCENE, typeof __DEV__ !== "undefined" && __DEV__);
}
