// What a map tap does, and where the assistant looks for its backend.
import { describe, expect, it } from "vitest";
import { tapAction, type TapState } from "../src/map/tap";
import { resolveAssistantUrl } from "../src/assistant/api";

const base: TapState = { mode: "home", sel: null, nav: null, viaPending: false, elevOpen: false, heatOpen: false };
const tap = (s: Partial<TapState>) => tapAction({ ...base, ...s });

describe("map taps", () => {
  it("drops a pin on the bare home map", () => {
    expect(tap({})).toBe("dropPin");
  });
  it("moves the pin when its own card is open", () => {
    expect(tap({ mode: "waypoint", sel: "pin-123" })).toBe("dropPin");
  });
  it("only closes an open popover, without a pin", () => {
    expect(tap({ elevOpen: true })).toBe("closePopover");
    expect(tap({ heatOpen: true })).toBe("closePopover");
    expect(tap({ mode: "waypoint", sel: "pin-1", heatOpen: true })).toBe("closePopover");
  });
  it("closes a landmark card without dropping a pin", () => {
    expect(tap({ mode: "waypoint", sel: "rocknest" })).toBe("closeCard");
  });
  it("never drops pins from other screens or while driving", () => {
    for (const mode of ["search", "route", "nav", "assistant", "settings", "about", "layers"] as TapState["mode"][]) {
      expect(tap({ mode })).toBe("coordOnly");
    }
    expect(tap({ nav: {} })).toBe("coordOnly");
  });
  it("adds a stop while picking one during a drive", () => {
    expect(tap({ mode: "nav", nav: {}, viaPending: true, elevOpen: true })).toBe("via");
  });
});

describe("assistant backend", () => {
  const o = { env: undefined as string | undefined, dev: true, web: true, origin: "http://localhost:8081", hostUri: "192.168.1.5:8081" };
  it("uses the dev server's middleware in development", () => {
    expect(resolveAssistantUrl(o)).toBe("http://localhost:8081/api/assistant");
    expect(resolveAssistantUrl({ ...o, web: false })).toBe("http://192.168.1.5:8081/api/assistant");
  });
  it("has no backend in a production build unless one is named", () => {
    expect(resolveAssistantUrl({ ...o, dev: false })).toBeNull();
    expect(resolveAssistantUrl({ ...o, dev: false, web: false })).toBeNull();
    expect(resolveAssistantUrl({ ...o, dev: false, env: "https://w.example.workers.dev" })).toBe("https://w.example.workers.dev");
  });
  it("treats an empty EXPO_PUBLIC_ASSISTANT_URL as no backend", () => {
    expect(resolveAssistantUrl({ ...o, env: "" })).toBeNull();
    expect(resolveAssistantUrl({ ...o, dev: false, env: "  " })).toBeNull();
  });
});
