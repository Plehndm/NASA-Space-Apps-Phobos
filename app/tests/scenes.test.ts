// Demo scenes (src/state/scenes.ts): which scene a URL or dev variable asks for, and that every
// landmark a scene names exists. Applying a scene is UI and is checked in the browser.
import { describe, expect, it } from "vitest";
import { landmarkById } from "../src/map/landmarks";
import { NAV_STOPS, parseScene, ROUTE_STOPS, SCENES, sceneFrom, WAYPOINT } from "../src/state/scenes";

describe("demo scenes", () => {
  it("accepts only the known scene names", () => {
    for (const s of SCENES) expect(parseScene(s)).toBe(s);
    expect(parseScene("Nav")).toBeNull();
    expect(parseScene("")).toBeNull();
    expect(parseScene(null)).toBeNull();
    expect(parseScene("constructor")).toBeNull();
  });

  it("reads ?scene= next to other options", () => {
    expect(sceneFrom("?device=phone&scene=nav", undefined, false)).toBe("nav");
    expect(sceneFrom("?scene=route&device=desktop", undefined, false)).toBe("route");
    expect(sceneFrom("?device=phone", undefined, false)).toBeNull();
    expect(sceneFrom("?scene=bogus", undefined, false)).toBeNull();
  });

  it("uses the dev variable only in a dev build, and the URL wins", () => {
    expect(sceneFrom(null, "assistant", true)).toBe("assistant");
    expect(sceneFrom(null, "assistant", false)).toBeNull();
    expect(sceneFrom("?scene=layers", "assistant", true)).toBe("layers");
    expect(sceneFrom("", "nope", true)).toBeNull();
  });

  it("names landmarks the app has", () => {
    for (const id of [WAYPOINT, ...ROUTE_STOPS, ...NAV_STOPS]) expect(landmarkById(id), id).not.toBeNull();
  });
});
