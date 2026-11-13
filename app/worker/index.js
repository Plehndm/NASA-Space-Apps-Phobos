// Route assistant on Cloudflare Workers, for the GitHub Pages demo: Pages only serves files, so the
// shared Claude API key lives here instead. Only the HTTP layer is new; the request checks, system
// prompt, model call and reply handling are scripts/assistant-middleware.js, the same code the Expo dev
// server runs.
//
// Deployed by .github/workflows/deploy.yml when the CLOUDFLARE_API_TOKEN secret is set, with the
// ANTHROPIC_API_KEY secret as its key. Anything that goes wrong (no key, a spent or expired key, rate
// limits, an outage) answers with a short error code, and the app answers from its scripted keyword
// assistant instead.
//
// Limits: 12 requests a minute per address and 120 a minute in total (the LIMIT_IP and LIMIT_ALL
// bindings in wrangler.toml), 64 KB bodies, browsers only from ALLOWED_ORIGINS. A request without an
// Origin header (a native app build, or curl) is let through to the rate limits, so put a spend limit
// on the key itself in the Claude Console.
import mw from "../scripts/assistant-middleware.js";

const DEFAULT_ORIGINS = "https://plehndm.github.io";

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });
}

// Without the rate-limit bindings (wrangler dev, tests) count per isolate instead.
const hits = new Map(); // key -> request times in the last minute
function memLimited(key, limit) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= limit) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) for (const [k, ts] of hits) if (!ts.some(t => now - t < 60_000)) hits.delete(k);
  return false;
}

async function limited(env, ip) {
  if (env.LIMIT_IP && env.LIMIT_ALL) {
    const [one, all] = await Promise.all([env.LIMIT_IP.limit({ key: ip }), env.LIMIT_ALL.limit({ key: "all" })]);
    return !one.success || !all.success;
  }
  return memLimited(ip, 12) || memLimited("*", 120);
}

export default {
  async fetch(request, env) {
    // The middleware and the Claude SDK read process.env; Workers keep vars and secrets on env.
    for (const k of ["ANTHROPIC_API_KEY", "ASSISTANT_MODEL"]) if (typeof env[k] === "string" && env[k].trim()) process.env[k] = env[k].trim();

    const url = new URL(request.url);
    if (url.pathname !== mw.PATH) return new Response(`The assistant is at ${mw.PATH}`, { status: 404 });

    const origins = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const origin = request.headers.get("origin");
    if (origin && !origins.includes(origin.toLowerCase())) return json(403, { error: "forbidden" });
    const cors = origin ? { "access-control-allow-origin": origin, vary: "origin" } : {};

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", "access-control-max-age": "600" } });
    }
    if (request.method === "GET") return json(200, { live: mw.configured(), model: mw.configured() ? mw.model() : null }, cors);
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, { ...cors, allow: "GET, POST" });
    if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) return json(415, { error: "json_only" }, cors);
    if (!mw.configured()) return json(503, { error: "not_configured" }, cors);
    if (await limited(env, request.headers.get("cf-connecting-ip") || "?")) return json(429, { error: "rate_limited" }, { ...cors, "retry-after": "20" });

    if (Number(request.headers.get("content-length") || 0) > mw.MAX_BODY) return json(413, { error: "too_large" }, cors);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > mw.MAX_BODY) return json(413, { error: "too_large" }, cors);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json(400, { error: "bad_json" }, cors); }
    if (!body || typeof body !== "object") return json(400, { error: "bad_json" }, cors);

    const r = await mw.respond(body);
    return json(r.status, r.json, cors);
  },
};
