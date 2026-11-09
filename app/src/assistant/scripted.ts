// Scripted fallback: answers by keyword when the live model is unavailable (no key on the server,
// no network, an error). Same branches as the design (named landmark, hazard check, science plan,
// weather, help), but every number comes from the app's data: planned routes, hazard zones,
// dust-devil heating and telemetry.
import type { Landmark } from "../map/landmarks";
import { distanceM } from "../map/geo";
import { deg, fmtKm, fmtMin } from "../route/format";
import { tauLevel } from "../home/telemetry";
import type { Answer } from "./api";
import { assistantLandmarks, dustLine, DUST_ID, hazardFacts, STOP_MIN, type Sources } from "./context";

// Words too generic to name a landmark on their own.
const GENERIC = new Set(["the", "checkpoint", "relay", "mast", "north", "rim", "crater", "mount", "emergency", "pad", "landing", "bay", "hills", "fan", "alpha"]);

const HAZARD = /\b(hazards?|danger\w*|warnings?|threats?|risk\w*|safe to|unsafe|between)\b/;
const PLAN = /\b(science|traverse|plan\w*|day|stops?|loop|samples?|explore)\b/;
const WEATHER = /\b(temp\w*|cold|heat\w*|weather|dust\w*|tau|opacity|wind\w*|devils?)\b/;

/** Landmarks named in the text, in the order they are mentioned. */
export function mentioned(text: string, list: Landmark[]): Landmark[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  const found: { l: Landmark; at: number }[] = [];
  for (const l of list) {
    const name = l.name.toLowerCase();
    const keys = [name, ...name.split(/\s+/).filter(w => w.length >= 3 && !GENERIC.has(w))];
    const at = Math.min(...keys.map(k => { const i = t.indexOf(` ${k} `); return i < 0 ? Infinity : i; }));
    if (at < Infinity) found.push({ l, at });
  }
  return found.sort((a, b) => a.at - b.at).map(f => f.l);
}

const zoneName = (id: string) => (id === DUST_ID ? "dust-devil heating" : id);

export function scripted(text: string, src: Sources): Answer {
  const { S, r, tele, adv } = src;
  const t = text.toLowerCase();
  const list = assistantLandmarks(S);
  const hits = mentioned(text, list);
  const hz = hazardFacts(S, adv);
  const nameOf = (id: string) => hz.find(h => h.id === id)?.name ?? zoneName(id);
  const onIds = hz.filter(h => h.on).map(h => h.id);
  const ready = r.ready;

  // A hazard question about a named place: what lies between here and there.
  if (HAZARD.test(t) && hits.length) {
    const l = hits[hits.length - 1];
    const z = r.blockedBy(l);
    if (z) return { reply: `${l.name} is inside the ${z.name.toLowerCase()} zone (${z.detail.toLowerCase()}). I won't plan into it; its waypoint card offers the nearest safe approach.`, route: [], avoid: [z.id] };
    const o = ready ? r.routeOpts([l.id]) : null;
    if (!o) return { reply: `${l.name} is ${(distanceM(S.rover, l) / 1000).toFixed(1)} km away. The terrain is still loading, so I can't check the ground between here and there yet.`, route: [], avoid: [] };
    const crossed = o.direct.cross.map(nameOf);
    const direct = crossed.length
      ? `The direct line crosses ${crossed.join(" and ").toLowerCase()} (max grade ${deg(o.direct.maxGrade)}).`
      : `The direct line crosses no active zone (max grade ${deg(o.direct.maxGrade)}).`;
    const safe = o.safe.ok
      ? ` The safe track keeps clear: ${fmtKm(o.safe.px)}, about ${fmtMin(o.safe.min)}, max grade ${deg(o.safe.maxGrade)}.`
      : ` There is no safe track under the ${r.capSafe}° limit.`;
    return { reply: `Between here and ${l.name}: ${direct}${safe}`, route: o.safe.ok ? [l.id] : [], avoid: o.direct.cross.filter(id => onIds.includes(id)) };
  }

  // A general hazard check.
  if (HAZARD.test(t)) {
    const on = hz.filter(h => h.on && h.km !== null).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    if (!on.length) return { reply: "Every hazard filter is off, so I have nothing to warn you about. Turn the warning zones back on from the Layers card before you drive.", route: [], avoid: [] };
    const [n, ...rest] = on;
    const also = rest.slice(0, 3).map(h => `${h.name.toLowerCase()} ${h.km!.toFixed(1)} km`).join(", ");
    return { reply: `Nearest threat is ${n.name.toLowerCase()} at ${n.km!.toFixed(1)} km. ${n.detail}.${also ? ` Also tracked: ${also}.` : ""}`, route: [], avoid: on.map(h => h.id) };
  }

  // A science day: the three nearest reachable science sites, visited nearest-first.
  if (PLAN.test(t) && !hits.length) {
    if (!ready) return { reply: "The terrain is still loading, so I can't plan a traverse yet. Ask again in a moment.", route: [], avoid: [] };
    const sites = list
      .filter(l => (l.cat === "Geological" || l.cat === "Water-Ice") && !r.blockedBy(l))
      .map(l => ({ l, o: r.routeOpts([l.id]) }))
      .filter(x => x.o?.safe.ok)
      .sort((a, b) => a.o!.safe.min - b.o!.safe.min)
      .slice(0, 3);
    if (!sites.length) return { reply: `No science site is reachable on a safe track under the ${r.capSafe}° limit from here.`, route: [], avoid: [] };
    const order: Landmark[] = [];
    let at = { x: S.rover.x, y: S.rover.y };
    const left = sites.map(s => s.l);
    while (left.length) {
      left.sort((a, b) => distanceM(at, a) - distanceM(at, b));
      const next = left.shift()!;
      order.push(next);
      at = next;
    }
    const ids = order.map(l => l.id);
    const plan = r.routeOpts(ids);
    const safe = plan?.safe;
    // What the safe track steers around: zones the straight line would cross, and nearby dust-devil heating.
    const avoid = [...(plan?.direct.cross ?? []).filter(id => onIds.includes(id)), ...(S.hazTypes.weather && adv?.high && adv.high.km < 15 ? [DUST_ID] : [])];
    const names = order.map(l => l.name);
    const list3 = names.length > 1 ? `${names.slice(0, -1).join(", ")}, then ${names[names.length - 1]}` : names[0];
    const summary = safe?.ok
      ? ` About ${fmtKm(safe.px)}: ${fmtMin(safe.min)} of driving plus ${STOP_MIN * ids.length} min of stops, max grade ${deg(safe.maxGrade)}.`
      : "";
    const dust = S.hazTypes.weather && adv?.high ? ` It stays out of the strongest dust-devil heating (${adv.high.km.toFixed(1)} km ${adv.high.dir}).` : "";
    return { reply: `A ${ids.length}-stop science loop on the safe track: ${list3}.${summary}${dust}`, route: ids, avoid };
  }

  // Weather and telemetry.
  if (WEATHER.test(t) && !hits.length) {
    const temp = tele.tempK === null ? "Ground temperature is not loaded" : `Ground at the rover is ${Math.round(tele.tempK - 273.15)}°C (${tele.tempSub} LTST model)`;
    const tau = tele.tau ? ` Dust opacity τ ${tele.tau.tau.toFixed(2)} is ${tauLevel(tele.tau.tau).toLowerCase()}.` : "";
    return { reply: `${temp}.${tau} Dust devils: ${dustLine(adv)}.`, route: [], avoid: S.hazTypes.weather ? [DUST_ID] : [] };
  }

  // Named landmarks: a route through them on the safe track.
  if (hits.length) {
    const ok = hits.filter(l => !r.blockedBy(l));
    const blocked = hits.filter(l => r.blockedBy(l));
    const notes = blocked.map(l => ` ${l.name} is inside the ${r.blockedBy(l)!.name.toLowerCase()} zone, so I left it out; its waypoint card offers the nearest safe approach.`).join("");
    if (!ok.length) return { reply: notes.trim(), route: [], avoid: blocked.map(l => r.blockedBy(l)!.id) };
    const ids = ok.map(l => l.id);
    const o = ready ? r.routeOpts(ids) : null;
    const names = ok.map(l => l.name).join(" then ");
    if (!o) return { reply: `${names}: ${(distanceM(S.rover, ok[0]) / 1000).toFixed(1)} km in a straight line. The terrain is still loading, so load the route to plan it.${notes}`, route: ids, avoid: [] };
    if (!o.safe.ok) {
      const d = o.direct.ok ? ` The direct route works (${fmtKm(o.direct.px)}, ${fmtMin(o.direct.min)}, max grade ${deg(o.direct.maxGrade)}) but crosses ${o.direct.cross.length ? o.direct.cross.map(nameOf).join(" and ").toLowerCase() : "steep ground"}.` : "";
      return { reply: `There is no safe track to ${names} under the ${r.capSafe}° limit.${d}${notes}`, route: o.direct.ok ? ids : [], avoid: [] };
    }
    const clear = o.direct.cross.length ? `, keeping clear of ${o.direct.cross.map(nameOf).join(" and ").toLowerCase()}` : "";
    return { reply: `Route to ${names} on the safe track: ${fmtKm(o.safe.px)}, about ${fmtMin(o.safe.min)} at up to 8 km/h, max grade ${deg(o.safe.maxGrade)}${clear}.${notes}`, route: ids, avoid: o.direct.cross.filter(id => onIds.includes(id)) };
  }

  return {
    reply: "I can plan a traverse, check hazards along a route, or report the telemetry. Try: “safest route to Murray Buttes”, “what hazards are near Pahrump Hills”, or “plan a 3-stop science day”.",
    route: [], avoid: [],
  };
}
