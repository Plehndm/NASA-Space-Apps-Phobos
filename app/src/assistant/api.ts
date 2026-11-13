// Talks to the route assistant's backend (scripts/assistant-middleware.js). The Claude API key lives
// only there: the app sends the conversation and a snapshot of what it knows, and gets back
// {reply, route, avoid}. Served by the Expo dev server at /api/assistant, so it follows the app's own
// address like the map data does. The GitHub Pages build sets EXPO_PUBLIC_ASSISTANT_URL to the
// Cloudflare Worker (worker/index.js).
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { AssistantContext } from "./context";

function assistantUrl(): string {
  const env = process.env.EXPO_PUBLIC_ASSISTANT_URL;
  if (env) return env;
  if (Platform.OS === "web" && typeof location !== "undefined") return `${location.origin}/api/assistant`;
  return `http://${Constants.expoConfig?.hostUri ?? "localhost:8081"}/api/assistant`;
}

export const ASSISTANT_URL = assistantUrl();

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface Answer { reply: string; route: string[]; avoid: string[] }

/** Whether the backend has a key (true), has none (false), or cannot be reached (null). */
export async function modelStatus(): Promise<boolean | null> {
  try {
    const r = await withTimeout(signal => fetch(ASSISTANT_URL, { signal }), 5000);
    if (!r.ok) return null;
    const j = (await r.json()) as { live?: unknown };
    return j.live === true;
  } catch {
    return null;
  }
}

/** Asks the live model. Throws on any failure, so the caller can answer from the scripted fallback. */
export async function askModel(messages: ChatTurn[], context: AssistantContext): Promise<Answer> {
  const r = await withTimeout(
    signal => fetch(ASSISTANT_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, context }), signal }),
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
