// The Cloudflare Worker behind the Pages demo (worker/index.js), called with plain Requests in Node
// against a stand-in for the Claude Messages API. The shared request checks and prompt are covered by
// servers.test.ts; this checks the Worker's own HTTP layer and that every failure tells the app to use
// its scripted fallback.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Mode = "ok" | "401" | "400";
const upstream = { mode: "ok" as Mode, last: null as null | Record<string, unknown> };
const fake: Server = createServer((req, res) => {
  let b = "";
  req.on("data", c => (b += c));
  req.on("end", () => {
    upstream.last = JSON.parse(b || "{}");
    const err = (status: number, type: string) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type, message: "UPSTREAM-SECRET" } }));
    };
    if (upstream.mode === "401") return err(401, "authentication_error"); // expired or revoked key
    if (upstream.mode === "400") return err(400, "invalid_request_error"); // e.g. credit balance too low
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: upstream.last?.model, stop_reason: "end_turn", stop_details: null,
      content: [{ type: "text", text: JSON.stringify({ reply: "Go to Yellowknife Bay.", route: ["yellowknife", "made_up"], avoid: [] }) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });
});

const ORIGIN = "https://plehndm.github.io";
const URL_ = "https://mars-navigator-assistant.example.workers.dev/api/assistant";
const body = JSON.stringify({ messages: [{ role: "user", content: "plan a day" }], context: { landmarks: [{ id: "yellowknife", name: "Yellowknife Bay" }] } });
const post = (headers: Record<string, string> = {}, b = body) =>
  new Request(URL_, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: b });

let worker: { fetch: (r: Request, env: Record<string, unknown>) => Promise<Response> };
const env = { ANTHROPIC_API_KEY: "sk-test-not-real", ALLOWED_ORIGINS: ORIGIN };

beforeAll(async () => {
  await new Promise<void>(r => fake.listen(0, "127.0.0.1", () => r()));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(fake.address() as { port: number }).port}`;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ASSISTANT_MODEL;
  worker = (await import("../worker/index.js")).default;
});
afterAll(() => {
  fake.close();
  for (const k of ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "ASSISTANT_MODEL"]) delete process.env[k];
});

describe("assistant worker", () => {
  it("reports no key, and refuses to ask without one", async () => {
    const r = await worker.fetch(new Request(URL_, { headers: { origin: ORIGIN } }), {});
    expect(await r.json()).toEqual({ live: false, model: null });
    expect(r.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect((await worker.fetch(post(), {})).status).toBe(503);
  });

  it("answers with Sonnet 5.5 by default, keeping only landmark ids the app sent", async () => {
    expect(await (await worker.fetch(new Request(URL_), env)).json()).toEqual({ live: true, model: "claude-sonnet-5-5" });
    const r = await worker.fetch(post(), env);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ reply: "Go to Yellowknife Bay.", route: ["yellowknife"], avoid: [], model: "claude-sonnet-5-5" });
    expect(upstream.last).toMatchObject({ model: "claude-sonnet-5-5" });
    expect(String(upstream.last?.system)).toMatch(/^You are the route assistant/);
  });

  it("returns an error code, never the upstream message, when the key is rejected or out of credit", async () => {
    try {
      upstream.mode = "401";
      const a = await worker.fetch(post(), env);
      expect([a.status, await a.json()]).toEqual([503, { error: "not_configured" }]);
      upstream.mode = "400";
      const b = await worker.fetch(post(), env);
      const text = await b.text();
      expect(b.status).toBe(502);
      expect(text).not.toContain("UPSTREAM-SECRET");
    } finally {
      upstream.mode = "ok";
    }
  });

  it("allows only listed browser origins, and answers CORS preflight", async () => {
    const bad = await worker.fetch(post({ origin: "https://evil.example" }), env);
    expect([bad.status, await bad.json()]).toEqual([403, { error: "forbidden" }]);
    const pre = await worker.fetch(new Request(URL_, { method: "OPTIONS", headers: { origin: ORIGIN } }), env);
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toBe("GET, POST");
  });

  it("rejects other paths, methods, non-JSON, bad JSON and large bodies", async () => {
    expect((await worker.fetch(new Request("https://x.workers.dev/"), env)).status).toBe(404);
    expect((await worker.fetch(new Request(URL_, { method: "PUT", body: "{}" }), env)).status).toBe(405);
    expect((await worker.fetch(post({ "content-type": "text/plain" }), env)).status).toBe(415);
    expect((await worker.fetch(post({}, "{nope"), env)).status).toBe(400);
    expect((await worker.fetch(post({}, JSON.stringify({ pad: "x".repeat(70_000) })), env)).status).toBe(413);
  });

  it("rate-limits through the Cloudflare bindings when present", async () => {
    const no = { limit: async () => ({ success: false }) }, yes = { limit: async () => ({ success: true }) };
    const r = await worker.fetch(post(), { ...env, LIMIT_IP: yes, LIMIT_ALL: no });
    expect([r.status, r.headers.get("retry-after")]).toEqual([429, "20"]);
  });
});
