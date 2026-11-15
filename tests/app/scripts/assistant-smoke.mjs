// One-shot check of the route assistant's live path against the real Claude API.
//
// Sends one realistic request built by the same code the dev server uses (buildRequest/readReply in
// assistant-middleware.js) and prints the HTTP status, the model that answered, stop_reason, whether
// the reply parsed into the app's {reply, route[], avoid[]} shape, and token usage. It costs one
// small request on your account. The key is read from the environment and never printed.
//
//   ANTHROPIC_API_KEY=... node scripts/assistant-smoke.mjs                       # from app/
//   ANTHROPIC_API_KEY=... ASSISTANT_MODEL=claude-opus-5-5 node scripts/assistant-smoke.mjs
//
// Exit code 0 when the reply parsed, 1 otherwise.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const secrets = [process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_AUTH_TOKEN].filter(s => s && s.length >= 8);
const redact = s => secrets.reduce((out, k) => out.split(k).join("[redacted]"), String(s));
const log = (...a) => console.log(redact(a.join(" ")));

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error(
    "\n  ANTHROPIC_API_KEY is not set, so there is nothing to check.\n" +
      "  Run it with your own key:  ANTHROPIC_API_KEY=sk-ant-... node scripts/assistant-smoke.mjs\n" +
      "  (PowerShell:  $env:ANTHROPIC_API_KEY='sk-ant-...'; node scripts/assistant-smoke.mjs)\n",
  );
  process.exit(1);
}

const { buildRequest, readReply, getClient } = require("./assistant-middleware.js");

// A snapshot shaped like the one the app sends (src/assistant/context.ts).
const context = {
  sol: 742, clock: "14:32", rover: "Bradbury Landing", speedKmh: 0.14, walkKmh: 3, capSafe: 15, capDirect: 25,
  layers: "slope, hazards, landmarks",
  telemetry: { surfaceC: -38, tau: 0.62, tauLevel: "moderate", slope: 3.1, dust: "2 active, nearest 1.4 km NE", nearest: "Bagnold dune field, 2.1 km S" },
  landmarks: [
    { id: "yellowknife", name: "Yellowknife Bay", cat: "science", km: 0.7, elev: -4520, slope: 4, status: "safe route 5.2 h", desc: "Mudstone; first evidence of a habitable lake." },
    { id: "rocknest", name: "Rocknest", cat: "science", km: 1.1, elev: -4505, slope: 6, status: "safe route 8.0 h", desc: "Wind-blown sand shadow sampled for soil." },
    { id: "kimberley", name: "The Kimberley", cat: "science", km: 5.9, elev: -4460, slope: 9, status: "safe route 46 h", desc: "Sandstone outcrop with layered strata." },
    { id: "pahrump", name: "Pahrump Hills", cat: "science", km: 8.4, elev: -4440, slope: 12, status: "safe route 66 h", desc: "Base of Mount Sharp; Murray formation." },
    { id: "summit", name: "Mount Sharp Summit", cat: "summit", km: 18.5, elev: 700, slope: 31, status: "BLOCKED above 25°", desc: "Central peak; out of rover range." },
  ],
  hazards: [
    { id: "dunes", name: "Bagnold dune field", type: "sand", km: 2.1, detail: "Loose sand, wheel sinkage risk", on: true },
    { id: "dust", name: "Dust devils", type: "dust", km: 1.4, detail: "Two active vortices drifting NE", on: true },
  ],
};
const messages = [{ role: "user", content: "Plan a traverse to the Kimberley with one science stop on the way, and keep us out of the dunes." }];

const req = buildRequest({ messages, context });
if (!req) { console.error("buildRequest rejected the sample conversation (bug in this script)."); process.exit(1); }
const p = req.params;
log(`\n  Request: model ${p.model}, max_tokens ${p.max_tokens}, effort ${p.output_config.effort}, beta ${p.betas ? p.betas.join(",") : "(none)"}, fallbacks ${p.fallbacks ?? "(none)"}`);

let data, response;
try {
  ({ data, response } = await getClient().beta.messages.create(p).withResponse());
} catch (err) {
  // SDK API errors carry status and the API's error type; print those, never the request headers.
  log(`  HTTP status:   ${err?.status ?? "(no response: connection or timeout)"}`);
  if (err?.error?.error?.type) log(`  Error type:    ${err.error.error.type}`);
  if (err?.requestID) log(`  Request id:    ${err.requestID}`);
  log(`  Message:       ${err?.error?.error?.message ?? err?.message ?? err}`);
  const hint = { 401: "the key was rejected", 403: "the key lacks permission", 404: "unknown model id (check ASSISTANT_MODEL)", 400: "the API rejected a request field", 429: "rate limited", 529: "API overloaded, try again" }[err?.status];
  if (hint) log(`  Meaning:       ${hint}`);
  log("  Result:        FAIL\n");
  process.exit(1);
}

const u = data.usage || {};
const fellBack = (u.iterations || []).some(it => it.type === "fallback_message");
const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
let raw = null;
try { raw = JSON.parse(text); } catch {}
const strings = a => Array.isArray(a) && a.every(x => typeof x === "string");
const shapeOk = !!raw && typeof raw.reply === "string" && strings(raw.route) && strings(raw.avoid);
const app = readReply(data, req.ctx);

log(`  HTTP status:   ${response.status}`);
log(`  Request id:    ${response.headers.get("request-id") ?? "(none)"}`);
log(`  Model used:    ${data.model}${fellBack ? " (server-side fallback served this reply)" : ""}`);
log(`  stop_reason:   ${data.stop_reason}${data.stop_details?.category ? ` (${data.stop_details.category})` : ""}`);
log(`  Content:       ${(data.content || []).map(b => b.type).join(", ") || "(empty)"}`);
log(`  JSON shape:    ${shapeOk ? "ok {reply, route[], avoid[]}" : "NOT the expected {reply, route[], avoid[]}"}`);
log(`  App result:    ${app.status} ${JSON.stringify(app.json)}`);
log(`  Usage:         input ${u.input_tokens ?? "?"}, output ${u.output_tokens ?? "?"}, cache read ${u.cache_read_input_tokens ?? 0}, cache write ${u.cache_creation_input_tokens ?? 0}` +
  (u.iterations?.length > 1 ? `, ${u.iterations.length} attempts` : ""));
const pass = shapeOk && app.status === 200;
log(`  Result:        ${pass ? "PASS" : "FAIL"}\n`);
process.exit(pass ? 0 : 1);
