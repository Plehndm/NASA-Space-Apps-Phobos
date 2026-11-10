// About & credits text (src/shell/credits.ts) and the temperature model's limits (src/map/heatLimits.ts):
// manifest text wins over the built-in copies, bad manifest values fall back, and the numbers match the
// pipeline's write-ups. Also checks the built app/data/manifest.json when it exists.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest } from "../src/map/data";
import { FALLBACK_CAVEATS, heatCaveats, KEY_LIMITS, keyLimits } from "../src/map/heatLimits";
import { creditGroups } from "../src/shell/credits";

type Heat = NonNullable<Manifest["heat"]>;
const heatWith = (caveats: Record<string, unknown>) =>
  ({ kinds: { ground: { title: "g", range_by_season_k: {}, caveats: caveats.ground }, air: { title: "a", range_by_season_k: {}, caveats: caveats.air } } }) as unknown as Heat;

describe("temperature model limits", () => {
  it("uses the manifest's caveats when it has them", () => {
    const h = heatWith({ ground: ["  Spatial skill is not measured.  ", "Second."], air: "One line." });
    expect(heatCaveats(h, "ground")).toEqual({ lines: ["Spatial skill is not measured.", "Second."], from: "manifest" });
    expect(heatCaveats(h, "air")).toEqual({ lines: ["One line."], from: "manifest" });
  });

  it("falls back without a manifest, or when its caveats are missing, empty or not text", () => {
    for (const h of [null, undefined, heatWith({}), heatWith({ ground: [], air: [] }), heatWith({ ground: [1, null, " "], air: { x: 1 } })]) {
      expect(heatCaveats(h, "ground")).toEqual({ lines: [...FALLBACK_CAVEATS.ground], from: "fallback" });
      expect(heatCaveats(h, "air")).toEqual({ lines: [...FALLBACK_CAVEATS.air], from: "fallback" });
    }
  });

  it("keeps only the text entries and caps a flood", () => {
    const h = heatWith({ ground: ["a", 2, "b", ...Array.from({ length: 40 }, (_, i) => `x${i}`)] });
    const r = heatCaveats(h, "ground");
    expect(r.from).toBe("manifest");
    expect(r.lines.slice(0, 2)).toEqual(["a", "b"]);
    expect(r.lines.length).toBeLessThanOrEqual(12);
  });

  it("shows the night-air line with the air map only", () => {
    const night = KEY_LIMITS.find(l => l.startsWith("Night air"))!;
    expect(keyLimits("air")).toContain(night);
    expect(keyLimits("ground")).not.toContain(night);
    expect(keyLimits("ground")).toHaveLength(KEY_LIMITS.length - 1);
  });

  it("states the pipeline's numbers (MarsDataPipline/README.md, docs/plan.md)", () => {
    const all = KEY_LIMITS.join(" ");
    for (const s of ["5 K", "4 K", "10 × 5 km", "82%"]) expect(all).toContain(s);
  });
});

describe("credits", () => {
  it("prefers the manifest's credit lines and falls back to the built-in ones", () => {
    const m = { imagery: { attribution: "Imagery X" }, heat: { credit: "Model Y" } } as unknown as Manifest;
    const by = (g: ReturnType<typeof creditGroups>, t: string) => g.find(x => x.title.startsWith(t))!;
    expect(by(creditGroups(m), "BASE IMAGERY").credit).toBe("Imagery X");
    expect(by(creditGroups(m), "TEMPERATURE").credit).toBe("Model Y");
    expect(by(creditGroups(null), "BASE IMAGERY").credit).toBe("Image: NASA/JPL-Caltech/MSSS");
    expect(by(creditGroups(null), "TEMPERATURE").credit).toMatch(/^Model: Team Phobos/);
  });

  it("links only to https addresses, with unique titles", () => {
    const g = creditGroups(null);
    expect(new Set(g.map(x => x.title)).size).toBe(g.length);
    for (const l of g.flatMap(x => x.lines)) if (l.url) expect(l.url).toMatch(/^https:\/\/[^\s]+$/);
  });

  it("cites every data source in MarsDataPipline/raw_data/Citations", () => {
    const text = creditGroups(null).flatMap(x => x.lines.map(l => `${l.text} ${l.url ?? ""}`)).join("\n");
    for (const doi of ["10.6084/m9.figshare.6584984.v1", "10.17632/tbh3pg39xc.3", "Gale_CTX_BlockAdj_dd", "mslrem_1001", "themis_thermal_inertia_mosaic", "inertia/2007/albedo"]) {
      expect(text).toContain(doi);
    }
  });
});

const built = fileURLToPath(new URL("../data/manifest.json", import.meta.url));
describe.skipIf(!existsSync(built))("the built manifest", () => {
  it("carries heat caveats and credit lines for the About screen", () => {
    const m = JSON.parse(readFileSync(built, "utf8")) as Manifest;
    expect(heatCaveats(m.heat, "ground").from).toBe("manifest");
    expect(heatCaveats(m.heat, "air").from).toBe("manifest");
    expect(typeof m.heat?.credit).toBe("string");
    expect(typeof m.imagery?.attribution).toBe("string");
  });
});
