// Talks to the route assistant's backend (scripts/assistant-middleware.js). The Claude API key lives
// only there: the app sends the conversation and a snapshot of what it knows, and gets back
// {reply, route, avoid}. Served by the Expo dev server at /api/assistant, so it follows the app's own
// address like the map data does. The GitHub Pages build sets EXPO_PUBLIC_ASSISTANT_URL to the
// Cloudflare Worker (worker/index.js).
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { AssistantContext } from "./context";

/**
 * Where the assistant backend is, or null when this build has none. Only the Expo dev server serves
 * /api/assistant; a production build (the GitHub Pages export, a native release) has a backend only
 * when EXPO_PUBLIC_ASSISTANT_URL names one. The Pages workflow sets it to an empty string when the
 * Worker isn't deployed.
 */
export function resolveAssistantUrl(o: { env: string | undefined; dev: boolean; web: boolean; origin: string | null; hostUri: string | undefined }): string | null {
  if (o.env !== undefined) return o.env.trim() || null;
  if (!o.dev) return null;
  if (o.web) return o.origin ? `${o.origin}/api/assistant` : null;
  return `http://${o.hostUri ?? "localhost:8081"}/api/assistant`;
}

export const ASSISTANT_URL = resolveAssistantUrl({
  env: process.env.EXPO_PUBLIC_ASSISTANT_URL,
  dev: typeof __DEV__ !== "undefined" && __DEV__,
  web: Platform.OS === "web",
  origin: typeof location !== "undefined" ? location.origin : null,
  hostUri: Constants.expoConfig?.hostUri ?? undefined,
});

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface Answer { reply: string; route: string[]; avoid: string[] }

/** Whether the live model can answer: the backend exists, is reachable and has a key. */
export async function modelStatus(): Promise<boolean> {
  if (!ASSISTANT_URL) return false;
  const url = ASSISTANT_URL;
  try {
    const r = await withTimeout(signal => fetch(url, { signal }), 5000);
    if (!r.ok) return false;
    const j = (await r.json()) as { live?: unknown };
    return j.live === true;
  } catch {
    return false;
  }
}

/** Asks the live model. Throws on any failure, so the caller can answer from the scripted fallback. */
export async function askModel(messages: ChatTurn[], context: AssistantContext): Promise<Answer> {
  if (!ASSISTANT_URL) throw new Error("no_backend");
  const url = ASSISTANT_URL;
  const r = await withTimeout(
    signal => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, context }), signal }),
    50_000,
  );
  const j = (await r.json().catch(() => null)) as Partial<Answer> & { error?: string } | null;
  if (!r.ok || !j) throw new Error(j?.error ?? `HTTP ${r.status}`);
  if (typeof j.reply !== "string" || !j.reply.trim()) throw new Error("bad_output");
  const ids = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string").slice(0, 8) : []);
  return { reply: j.reply.trim().slice(0, 900), route: ids(j.route), avoid: ids(j.avoid) };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try {
    return await run(ctl.signal);
  } finally {
    clearTimeout(id);
  }
}
