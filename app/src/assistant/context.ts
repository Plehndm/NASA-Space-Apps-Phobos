// What the assistant knows: a snapshot of the sector built from the app's own data (terrain-aware
// safe routes, hazard zones, dust-devil heating, telemetry). The live model gets it as the data part
// of its system prompt (the backend writes the rules); the scripted fallback reads the same facts.
import type { AppState } from "../state/store";
import { LANDMARKS, type Landmark } from "../map/landmarks";
import { HAZARD_ZONES } from "../map/hazards";
import { distanceM, fmtLatLon, type Pt } from "../map/geo";
import { edgeDist, pxToKm } from "../route/router";
import type { RouteApi } from "../route/RouteProvider";
import { deg, fmtKm, fmtMin } from "../route/format";
import { tauLevel, type Telemetry } from "../home/telemetry";
import type { DustAdvisory } from "../home/advisory";
import { SOL } from "../state/clock";

export const DRIVE_KMH = 8;
export const WALK_KMH = 4;
export const STOP_MIN = 25; // per science stop
export const DUST_ID = "dust";
const HEAT = ["no", "low", "moderate", "high"];

export interface LandmarkFacts {
  id: string; name: string; cat: string; km: number; elev: number | null; slope: number | null; status: string; desc: string;
}
export interface HazardFacts { id: string; name: string; type: string; km: number | null; detail: string; on: boolean }

export interface AssistantContext {
  sol: number;
  clock: string;
  rover: string;
  speedKmh: number;
  walkKmh: number;
  capSafe: number;
  capDirect: number;
  layers: string;
  telemetry: { surfaceC: number | null; tau: number | null; tauLevel: string; slope: number | null; dust: string; nearest: string };
  landmarks: LandmarkFacts[];
  hazards: HazardFacts[];
}

export interface Sources {
  S: AppState;
  r: RouteApi;
  tele: Telemetry;
  adv: DustAdvisory | null;
  clock: string;
}

/** The sector's landmarks: the fixed list plus points added at run time (not via-points). */
export const assistantLandmarks = (S: AppState): Landmark[] => [...LANDMARKS, ...S.extraLm.filter(l => !l.id.startsWith("via-"))];

/** One line on whether and how a landmark can be reached from the rover. */
export function reachStatus(r: RouteApi, rover: Pt, l: Landmark): string {
  const z = r.blockedBy(l);
  if (z) return `BLOCKED by ${z.name}`;
  if (distanceM(rover, l) < 150) return "the rover is here";
  const o = r.ready ? r.routeOpts([l.id]) : null;
  if (!o) return "route not planned yet (terrain loading)";
  if (o.safe.ok) return `reachable, safe route ${fmtKm(o.safe.px)} in ${fmtMin(o.safe.min)}, max grade ${deg(o.safe.maxGrade)}`;
  if (o.direct.ok) return `no safe route; direct route only, ${fmtKm(o.direct.px)} in ${fmtMin(o.direct.min)}, max grade ${deg(o.direct.maxGrade)}`;
  return `UNREACHABLE under the ${r.capDirect}° grade limit`;
}

export function dustLine(adv: DustAdvisory | null): string {
  if (!adv) return "no heating data";
  const far = adv.high ? `strongest heating ${adv.high.km.toFixed(1)} km ${adv.high.dir}` : "no strong heating within 30 km";
  return `${HEAT[adv.here] ?? "no"} heating under the rover (index for sol ${adv.sol}); ${far}`;
}

export function hazardFacts(S: AppState, adv: DustAdvisory | null): HazardFacts[] {
  const zones = HAZARD_ZONES.map(z => ({
    id: z.id, name: z.name, type: z.type, km: Math.max(0, pxToKm(edgeDist(S.rover, z))), detail: z.detail, on: S.hazTypes[z.type],
  }));
  const dust: HazardFacts = {
    id: DUST_ID, name: "Dust devils", type: "weather", km: adv?.high?.km ?? null,
    detail: !adv ? "Dust Devil Heating Index not loaded" : adv.high ? `Strongest heating is ${adv.high.dir} of the rover (Dust Devil Heating Index, sol ${adv.sol})` : `No strong heating within 30 km (Dust Devil Heating Index, sol ${adv.sol})`, on: S.hazTypes.weather,
  };
  return [...zones, dust];
}

export function buildContext({ S, r, tele, adv, clock }: Sources): AssistantContext {
  const hazards = hazardFacts(S, adv);
  const near = hazards.filter(h => h.on && h.km !== null).sort((a, b) => (a.km ?? 0) - (b.km ?? 0))[0];
  return {
    sol: SOL,
    clock,
    rover: fmtLatLon(S.rover),
    speedKmh: DRIVE_KMH,
    walkKmh: WALK_KMH,
    capSafe: r.capSafe,
    capDirect: r.capDirect,
    layers: `elevation ${S.elev ? `L${S.elev}` : "off"}, ground-temperature heatmap ${S.heat}, warning zones ${S.hazOn ? "on" : "off"}`,
    telemetry: {
      surfaceC: tele.tempK === null ? null : Math.round(tele.tempK - 273.15),
      tau: tele.tau ? Math.round(tele.tau.tau * 100) / 100 : null,
      tauLevel: tele.tau ? tauLevel(tele.tau.tau) : "",
      slope: tele.slope === null ? null : Math.round(tele.slope * 10) / 10,
      dust: dustLine(adv),
      nearest: near ? `${near.name}, ${near.km?.toFixed(1)} km` : "none enabled",
    },
    landmarks: assistantLandmarks(S).map(l => ({
      id: l.id, name: l.name, cat: l.cat, km: Math.round(distanceM(S.rover, l) / 100) / 10,
      elev: r.elevOf(l), slope: r.slopeOf(l) === null ? null : Math.round(r.slopeOf(l)! * 10) / 10,
      status: reachStatus(r, S.rover, l), desc: l.desc,
    })),
    hazards,
  };
}
