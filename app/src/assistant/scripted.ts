// Scripted (offline) assistant: answers by keyword when the live model is off or unavailable (no key on
// the server, no network, an error), or when the crew picks OFFLINE. Every number comes from the app's
// data: planned routes, hazard zones, dust-devil heating, terrain and telemetry.
//
// The questions it understands, checked in this order (the first match answers):
//   thanks · greetings and help · one hazard type ("any radiation?") · hazards toward a named place ·
//   a general hazard check · emergency (nearest landing pad) · go home (nearest habitat) · the nearest
//   landmark of a kind ("closest water ice") · what's nearby · about a named place · how far / how long ·
//   how high · how steep · a science day · where am I · status report · the rover's slope · elevation ·
//   speeds · weather, temperature and dust · the time and sol · map layers · a route through named places.
import type { Category, Landmark } from "../map/landmarks";
import { distanceM, fmtLatLon, fmtInt } from "../map/geo";
import { deg, fmtKm, fmtMin } from "../route/format";
import { tauLevel } from "../home/tau";
import { SOL } from "../state/clock";
import type { Answer } from "./api";
import { assistantLandmarks, DRIVE_KMH, dustLine, DUST_ID, hazardFacts, reachStatus, STOP_MIN, WALK_KMH, type Sources } from "./context";

// Words too generic to name a landmark on their own.
const GENERIC = new Set(["the", "checkpoint", "relay", "mast", "north", "rim", "crater", "mount", "emergency", "pad", "landing", "bay", "hills", "fan", "alpha"]);

const HAZARD = /\b(hazards?|danger\w*|warnings?|threats?|risk\w*|safe to|unsafe|between)\b/;
const PLAN = /\b(science|traverse|plan\w*|day|stops?|loop|samples?|explore|itinerary|mission)\b/;
const WEATHER = /\b(temp\w*|cold|hot|warm\w*|freez\w*|heat\w*|weather|forecast|conditions?|dust\w*|tau|opacity|visibility|sky|haze|wind\w*|devils?|storms?)\b/;
const THANKS = /^\s*(thanks?|thank you|thx|cheers|great|perfect|awesome|ok(ay)?|got it|cool)\b[\s!.]*$/;
const HELP = /^\s*(hi|hello|hey|yo|greetings|good (morning|afternoon|evening))\b|\b(help|what can you do|what do you know|how do (i|you) use|commands?|options|capabilities)\b/;
const EMERGENCY = /\b(emergenc\w*|evacuat\w*|abort|mayday|sos|rescue|escape|bail out)\b/;
const HOME = /\b(home|base|back to (the )?(hab|base|camp)|return\w*|head back|go back|shelter)\b/;
const NEAREST = /\b(nearest|closest|near(by)?|close by|around (me|here|us)|next to me)\b/;
const LIST = /\b(what('s| is)? (nearby|around|close)|points? of interest|landmarks|places|sites|locations|list|everything)\b/;
const DESCRIBE = /\b(what('s| is| are)|whats|tell me|describe|about|info\w*|why|history|significance|interesting|known for|look like)\b/;
const DISTANCE = /\b(how far|distance|how long|eta|travel time|time to|minutes?|hours?|walk(ing)?)\b/;
const ELEVATION = /\b(elevation|altitude|height|how high|how deep|how low|above|below)\b/;
const SLOPE = /\b(slope|grade|gradient|incline|steep\w*|climb\w*|uphill|downhill)\b/;
const POSITION = /\b(where am i|where are we|where('s| is) the rover|my (location|position)|current (location|position)|coordinates?|lat(itude)?|lon(gitude)?|position)\b/;
const STATUS = /\b(status|report|summary|sitrep|overview|update|briefing)\b/;
const SPEED = /\b(speed|how fast|velocity|km\/?h|kph|driving speed)\b/;
const TIME = /\b(what time|time is it|the time|clock|sol|what day|date|ltst|mtc|today)\b/;
const LAYERS = /\b(layers?|heat ?map|strata|overlays?|legend|colou?rs?|what does the map)\b/;
const HERE = /\b(here|this spot|right now|currently|current|under (the )?rover|where (i|we) am|where we are)\b/;

/** Words for each kind of place, for "nearest …" questions. */
const KINDS: [RegExp, Category, string][] = [
  [/\b(water|ice|lake\w*|wet|aqueous)\b/, "Water-Ice", "water-ice site"],
  [/\b(geolog\w*|rocks?|science|samples?|drill\w*|minerals?|outcrops?)\b/, "Geological", "geology site"],
  [/\b(habitats?|hab|base|shelter|camp)\b/, "Habitats", "habitat"],
  [/\b(relays?|comms?|communications?|signal|antenna|radio|uplink)\b/, "Relays", "relay mast"],
  [/\b(landing|pads?|lz|launch|pickup|evac\w*)\b/, "Landing", "landing pad"],
  [/\b(craters?)\b/, "Craters", "crater"],
  [/\b(checkpoints?|waypoints?|traverse markers?)\b/, "Traverse", "checkpoint"],
];

/** Words for each hazard type, for "any radiation?" questions. */
const TYPES: [RegExp, string][] = [
  [/\b(radiation|radioactive|rads?|dose)\b/, "radiation"],
  [/\b(sand\w*|soft (soil|ground)|stuck|trap\w*|bog\w*)\b/, "sand"],
  [/\b(steep|cliffs?|scarps?|drop.?offs?)\b/, "steep"],
  [/\b(rough|rock(s|y)? field|boulders?|wheel damage)\b/, "rough"],
];

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
const km1 = (m: number) => `${(m / 1000).toFixed(1)} km`;
const elev = (m: number | null) => (m === null ? "unknown elevation" : `${fmtInt(m)} m`);
const say = (reply: string, route: string[] = [], avoid: string[] = []): Answer => ({ reply, route, avoid });

export const HELP_TEXT =
  "I'm the route assistant for this sector. Ask me to plan a route (“safest route to Murray Buttes”), check hazards (“any sand traps near Pahrump Hills?”), find the nearest water ice, habitat or landing pad, describe a landmark, give distances, elevations and slopes, report the weather and dust, or plan a 3-stop science day.";

export function scripted(text: string, src: Sources): Answer {
  const { S, r, tele, adv, clock } = src;
  const t = text.toLowerCase();
  const list = assistantLandmarks(S);
  const hits = mentioned(text, list);
  const hz = hazardFacts(S, adv);
  const nameOf = (id: string) => hz.find(h => h.id === id)?.name ?? zoneName(id);
  const onIds = hz.filter(h => h.on).map(h => h.id);
  const ready = r.ready;
  const away = (l: Landmark) => distanceM(S.rover, l);
  const byDistance = (ls: Landmark[]) => [...ls].sort((a, b) => away(a) - away(b));
  /** Landmarks other than the one the rover is parked at, nearest first. */
  const elsewhere = (ls: Landmark[]) => byDistance(ls).filter(l => away(l) > 150);

  /** A safe-track route to one landmark, or why there isn't one. */
  const routeTo = (l: Landmark, lead: string): Answer => {
    const z = r.blockedBy(l);
    if (z) return say(`${lead} ${l.name} is inside the ${z.name.toLowerCase()} zone, so I won't plan into it; its waypoint card offers the nearest safe approach.`, [], [z.id]);
    const o = ready ? r.routeOpts([l.id]) : null;
    if (!o) return say(`${lead} ${l.name}, ${km1(away(l))} away in a straight line. The terrain is still loading; load the route to plan it.`, [l.id]);
    if (!o.safe.ok) return say(`${lead} ${l.name}, but there is no safe track under the ${r.capSafe}° limit${o.direct.ok ? `; the direct route is ${fmtKm(o.direct.px)}, ${fmtMin(o.direct.min)}, max grade ${deg(o.direct.maxGrade)}` : ""}.`, o.direct.ok ? [l.id] : []);
    return say(`${lead} ${l.name}: ${fmtKm(o.safe.px)} on the safe track, about ${fmtMin(o.safe.min)}, max grade ${deg(o.safe.maxGrade)}.`, [l.id], o.direct.cross.filter(id => onIds.includes(id)));
  };

  if (THANKS.test(t)) return say("Anytime. Ask if you want a route, a hazard check or the latest telemetry.");
  if (HELP.test(t) && !hits.length) return say(HELP_TEXT);

  // One hazard type, anywhere in the sector ("how steep is it here" is about the rover's own slope, below).
  const type = TYPES.find(([re]) => re.test(t) && !(HERE.test(t) && SLOPE.test(t)));
  if (type && !hits.length) {
    const zones = hz.filter(h => h.type === type[1] && h.km !== null).sort((a, b) => a.km! - b.km!);
    if (!zones.length) return say(`No ${type[1]} hazard zone is mapped in this sector.`);
    const z = zones[0];
    const off = z.on ? "" : " Its warning filter is off, so routes don't avoid it; turn it on in the Layers card.";
    return say(`${z.name}: ${z.km! < 0.05 ? "the rover is at its edge" : `${z.km!.toFixed(1)} km from the rover`}. ${z.detail}.${off}`, [], z.on ? [z.id] : []);
  }

  // A hazard question about a named place: what lies between here and there.
  if (HAZARD.test(t) && hits.length) {
    const l = hits[hits.length - 1];
    const z = r.blockedBy(l);
    if (z) return say(`${l.name} is inside the ${z.name.toLowerCase()} zone (${z.detail.toLowerCase()}). I won't plan into it; its waypoint card offers the nearest safe approach.`, [], [z.id]);
    const o = ready ? r.routeOpts([l.id]) : null;
    if (!o) return say(`${l.name} is ${km1(away(l))} away. The terrain is still loading, so I can't check the ground between here and there yet.`);
    const crossed = o.direct.cross.map(nameOf);
    const direct = crossed.length
      ? `The direct line crosses ${crossed.join(" and ").toLowerCase()} (max grade ${deg(o.direct.maxGrade)}).`
      : `The direct line crosses no active zone (max grade ${deg(o.direct.maxGrade)}).`;
    const safe = o.safe.ok
      ? ` The safe track keeps clear: ${fmtKm(o.safe.px)}, about ${fmtMin(o.safe.min)}, max grade ${deg(o.safe.maxGrade)}.`
      : ` There is no safe track under the ${r.capSafe}° limit.`;
    return say(`Between here and ${l.name}: ${direct}${safe}`, o.safe.ok ? [l.id] : [], o.direct.cross.filter(id => onIds.includes(id)));
  }

  // A general hazard check.
  if (HAZARD.test(t)) {
    const on = hz.filter(h => h.on && h.km !== null).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    if (!on.length) return say("Every hazard filter is off, so I have nothing to warn you about. Turn the warning zones back on from the Layers card before you drive.");
    const [n, ...rest] = on;
    const also = rest.slice(0, 3).map(h => `${h.name.toLowerCase()} ${h.km!.toFixed(1)} km`).join(", ");
    return say(`Nearest threat is ${n.name.toLowerCase()} at ${n.km!.toFixed(1)} km. ${n.detail}.${also ? ` Also tracked: ${also}.` : ""}`, [], on.map(h => h.id));
  }

  // Emergency: the nearest landing pad, preferring the emergency pad when it's about as close.
  if (EMERGENCY.test(t)) {
    const pads = elsewhere(list.filter(l => l.cat === "Landing" && !r.blockedBy(l)));
    const em = pads.find(l => /emergency/i.test(l.name));
    const pick = em && pads[0] && away(em) < away(pads[0]) * 1.5 ? em : pads[0];
    if (!pick) return say("No landing pad is reachable outside the hazard zones from here. Hold position and call the habitat.");
    return routeTo(pick, "Nearest pickup point is");
  }

  // Go home: the nearest habitat.
  if (HOME.test(t) && !hits.length) {
    const hab = elsewhere(list.filter(l => l.cat === "Habitats"))[0];
    if (hab) return routeTo(hab, "Heading back to");
  }

  // The nearest landmark of a kind.
  const kind = KINDS.find(([re]) => re.test(t));
  if (kind && !hits.length && (NEAREST.test(t) || /\b(where|find|any|go to|take me|route|show)\b/.test(t))) {
    const near = elsewhere(list.filter(l => l.cat === kind[1]));
    if (!near.length) return say(`No other ${kind[2]} is mapped in this sector.`);
    const others = near.slice(1, 3).map(l => `${l.name} ${km1(away(l))}`).join(", ");
    const a = routeTo(near[0], `Nearest ${kind[2]} is`);
    return { ...a, reply: `${a.reply}${others ? ` Next: ${others}.` : ""} ${near[0].desc}` };
  }

  // What's nearby: the closest landmarks.
  if (!hits.length && (LIST.test(t) || (NEAREST.test(t) && !kind))) {
    const near = elsewhere(list).slice(0, 5);
    return say(`Closest to the rover: ${near.map(l => `${l.name} (${l.cat.toLowerCase()}, ${km1(away(l))})`).join(", ")}. Ask about any of them, or for a route.`);
  }

  // Questions about one named place.
  if (hits.length === 1) {
    const l = hits[0];
    const o = ready && !r.blockedBy(l) ? r.routeOpts([l.id]) : null;
    if (DISTANCE.test(t)) {
      const walk = fmtMin(((away(l) / 1000) / WALK_KMH) * 60);
      const drive = o?.safe.ok ? ` By rover on the safe track: ${fmtKm(o.safe.px)}, about ${fmtMin(o.safe.min)}.` : o ? ` There is no safe rover track under the ${r.capSafe}° limit.` : "";
      return say(`${l.name} is ${km1(away(l))} from the rover in a straight line.${drive} On foot at ${WALK_KMH} km/h that's about ${walk} (straight line).`, o?.safe.ok ? [l.id] : []);
    }
    if (ELEVATION.test(t)) {
      const e = r.elevOf(l), here = r.elevOf(S.rover);
      const rel = e !== null && here !== null ? `, ${fmtInt(Math.abs(e - here))} m ${e >= here ? "above" : "below"} the rover` : "";
      return say(`${l.name} sits at ${elev(e)}${rel}.${o?.safe.ok ? ` The safe track climbs ${fmtInt(o.safe.asc)} m and descends ${fmtInt(o.safe.desc)} m on the way.` : ""}`);
    }
    if (SLOPE.test(t)) {
      const s = r.slopeOf(l);
      const route = o?.safe.ok ? ` The safe track's steepest grade is ${deg(o.safe.maxGrade)} (limit ${r.capSafe}°).` : o ? ` No route stays under the ${r.capSafe}° limit.` : "";
      return say(`Ground slope at ${l.name} is ${s === null ? "unknown" : deg(s)}.${route}`, o?.safe.ok ? [l.id] : []);
    }
    if (DESCRIBE.test(t) && !/\b(route|go|drive|take me|path|navigate)\b/.test(t)) {
      return say(`${l.name} (${l.cat.toLowerCase()}${l.real ? ", visited by Curiosity" : ", mission site"}): ${l.desc} It's ${km1(away(l))} away at ${elev(r.elevOf(l))}; ${reachStatus(r, S.rover, l)}.`, o?.safe.ok ? [l.id] : []);
    }
  }

  // A science day: the three nearest reachable science sites, visited nearest-first.
  if (PLAN.test(t) && !hits.length) {
    if (!ready) return say("The terrain is still loading, so I can't plan a traverse yet. Ask again in a moment.");
    const sites = list
      .filter(l => (l.cat === "Geological" || l.cat === "Water-Ice") && !r.blockedBy(l))
      .map(l => ({ l, o: r.routeOpts([l.id]) }))
      .filter(x => x.o?.safe.ok)
      .sort((a, b) => a.o!.safe.min - b.o!.safe.min)
      .slice(0, 3);
    if (!sites.length) return say(`No science site is reachable on a safe track under the ${r.capSafe}° limit from here.`);
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
    return say(`A ${ids.length}-stop science loop on the safe track: ${list3}.${summary}${dust}`, ids, avoid);
  }

  if (!hits.length) {
    const nearest = byDistance(list)[0];
    const here = nearest && away(nearest) < 150 ? `at ${nearest.name}` : nearest ? `${km1(away(nearest))} from ${nearest.name}` : "";
    const temp = tele.tempK === null ? null : `${Math.round(tele.tempK - 273.15)}°C`;

    if (POSITION.test(t)) {
      return say(`The rover is at ${fmtLatLon(S.rover)}${here ? `, ${here}` : ""}, elevation ${elev(r.elevOf(S.rover))}${tele.slope !== null ? `, on a ${deg(tele.slope)} slope` : ""}.`);
    }

    if (STATUS.test(t)) {
      const near = hz.filter(h => h.on && h.km !== null).sort((a, b) => a.km! - b.km!)[0];
      return say(`Sol ${SOL}, ${clock} MTC. Rover ${here || `at ${fmtLatLon(S.rover)}`}. Ground ${temp ?? "temperature not loaded"}${tele.tau ? `, dust τ ${tele.tau.tau.toFixed(2)} (${tauLevel(tele.tau.tau).toLowerCase()})` : ""}. ${near ? `Nearest threat: ${near.name.toLowerCase()}, ${near.km!.toFixed(1)} km.` : "No hazard filters are on."}${S.nav ? " An expedition is under way." : S.stops.length ? ` ${S.stops.length} stops planned.` : ""}`);
    }

    if (SLOPE.test(t)) {
      return say(`Ground under the rover slopes ${tele.slope === null ? "an unknown amount" : deg(tele.slope)}. Safe routes stay under ${r.capSafe}°, direct routes under ${r.capDirect}°. Speed drops with grade: 8 km/h up to 8°, 5 km/h to 15°, 3 km/h to 20°, 2 km/h above.`);
    }

    if (ELEVATION.test(t)) {
      const hi = [...list].map(l => ({ l, e: r.elevOf(l) })).filter(x => x.e !== null).sort((a, b) => b.e! - a.e!)[0];
      return say(`The rover is at ${elev(r.elevOf(S.rover))}.${hi ? ` Highest mapped point: ${hi.l.name} at ${elev(hi.e)}.` : ""}`);
    }

    if (SPEED.test(t)) {
      return say(`The rover drives up to ${DRIVE_KMH} km/h on grades to 8°, 5 km/h to 15°, 3 km/h to 20° and 2 km/h above that. Walking EVAs are planned at ${WALK_KMH} km/h. Route times use these speeds on the real terrain.`);
    }

    if (WEATHER.test(t)) {
      const tempLine = temp === null ? "Ground temperature is not loaded" : `Ground at the rover is ${temp} (${tele.tempSub} LTST model)`;
      const tau = tele.tau ? ` Dust opacity τ ${tele.tau.tau.toFixed(2)} is ${tauLevel(tele.tau.tau).toLowerCase()}.` : "";
      return say(`${tempLine}.${tau} Dust devils: ${dustLine(adv)}.`, [], S.hazTypes.weather ? [DUST_ID] : []);
    }

    if (TIME.test(t)) return say(`It's sol ${SOL}, ${clock} Mars Coordinated Time.`);

    if (LAYERS.test(t)) {
      return say(`Map layers: elevation strata ${S.elev ? `on (L${S.elev})` : "off"}, ground-temperature heatmap ${S.heat === "off" ? "off" : "on"}, warning zones ${S.hazOn ? "on" : "off"}. Open them from the layers button on the right; the heatmap has a time slider through the sol.`);
    }
  }

  // Named landmarks: a route through them on the safe track.
  if (hits.length) {
    const ok = hits.filter(l => !r.blockedBy(l));
    const blocked = hits.filter(l => r.blockedBy(l));
    const notes = blocked.map(l => ` ${l.name} is inside the ${r.blockedBy(l)!.name.toLowerCase()} zone, so I left it out; its waypoint card offers the nearest safe approach.`).join("");
    if (!ok.length) return say(notes.trim(), [], blocked.map(l => r.blockedBy(l)!.id));
    const ids = ok.map(l => l.id);
    const o = ready ? r.routeOpts(ids) : null;
    const names = ok.map(l => l.name).join(" then ");
    if (!o) return say(`${names}: ${km1(away(ok[0]))} in a straight line. The terrain is still loading, so load the route to plan it.${notes}`, ids);
    if (!o.safe.ok) {
      const d = o.direct.ok ? ` The direct route works (${fmtKm(o.direct.px)}, ${fmtMin(o.direct.min)}, max grade ${deg(o.direct.maxGrade)}) but crosses ${o.direct.cross.length ? o.direct.cross.map(nameOf).join(" and ").toLowerCase() : "steep ground"}.` : "";
      return say(`There is no safe track to ${names} under the ${r.capSafe}° limit.${d}${notes}`, o.direct.ok ? ids : []);
    }
    const clear = o.direct.cross.length ? `, keeping clear of ${o.direct.cross.map(nameOf).join(" and ").toLowerCase()}` : "";
    return say(`Route to ${names} on the safe track: ${fmtKm(o.safe.px)}, about ${fmtMin(o.safe.min)} at up to ${DRIVE_KMH} km/h, max grade ${deg(o.safe.maxGrade)}${clear}.${notes}`, ids, o.direct.cross.filter(id => onIds.includes(id)));
  }

  return say("I can plan a traverse, check hazards along a route, find the nearest water ice, habitat or landing pad, describe a landmark, or report the telemetry. Try: “safest route to Murray Buttes”, “what hazards are near Pahrump Hills”, or “plan a 3-stop science day”.");
}
