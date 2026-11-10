// Route assistant state: the conversation, the busy flag and whether the live model is available.
// Asks the backend first; on any failure answers from the scripted fallback, so the crew always gets
// a reply. Kept outside the sheet so the conversation survives leaving and reopening the assistant.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "../state/store";
import { useRoutes } from "../route/RouteProvider";
import { useTelemetry } from "../home/telemetry";
import { useDustAdvisory } from "../home/advisory";
import { fmtClock, mtcSeconds } from "../state/clock";
import { askModel, modelStatus, type Answer, type ChatTurn } from "./api";
import { buildContext, type Sources } from "./context";
import { scripted } from "./scripted";

export const MAX_INPUT = 500;

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  raw: string; // what goes back to the model: the user's text, or the assistant's JSON answer
  route: string[];
  avoid: string[];
  live?: boolean;
}

interface AssistantApi {
  chat: ChatMsg[];
  busy: boolean;
  live: boolean | null; // backend has a key (true), has none (false), unknown or unreachable (null)
  /** Ask a question. `offline` answers from the scripted fallback without trying the backend (demo scenes). */
  send: (text: string, opts?: { offline?: boolean }) => void;
  loadRoute: (ids: string[]) => void;
}

const Ctx = createContext<AssistantApi | null>(null);
export function useAssistant(): AssistantApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAssistant needs <AssistantProvider>");
  return v;
}

const tick = () => new Promise(res => setTimeout(res, 30));

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { state: S, patch, setMode, toast } = useApp();
  const r = useRoutes();
  const tele = useTelemetry();
  const adv = useDustAdvisory();
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);

  // Sends read the latest app state through a ref (a reply can arrive after several renders).
  const src = useRef<Omit<Sources, "clock">>({ S, r, tele, adv });
  src.current = { S, r, tele, adv };
  const sources = (): Sources => ({ ...src.current, clock: fmtClock(mtcSeconds(), false) });
  const state = useRef({ chat, busy });
  state.current = { chat, busy };

  // Ask the backend whether it has a key each time the assistant opens.
  const open = S.mode === "assistant";
  useEffect(() => {
    if (!open) return;
    let on = true;
    modelStatus().then(v => on && setLive(v));
    return () => { on = false; };
  }, [open]);

  const send = useCallback(async (input: string, opts?: { offline?: boolean }) => {
    const text = input.trim().slice(0, MAX_INPUT);
    if (!text || state.current.busy) return;
    const user: ChatMsg = { role: "user", text, raw: text, route: [], avoid: [] };
    const history = [...state.current.chat, user];
    setChat(history);
    setBusy(true);
    await tick(); // let the busy pill draw before the route planning below
    let out: Answer, wasLive = false;
    try {
      if (live === false || opts?.offline) throw new Error("no model");
      // The backend keeps the last 16 messages; send no more than that.
      const turns: ChatTurn[] = history.slice(-16).map(m => ({ role: m.role, content: m.raw }));
      const a = await askModel(turns, buildContext(sources()));
      // Keep only landmarks the app knows, once each.
      out = { ...a, route: [...new Set(a.route.filter(id => !!src.current.r.lm(id)))] };
      wasLive = true;
    } catch {
      out = scripted(text, sources());
    }
    if (wasLive !== live) setLive(wasLive);
    setChat(c => [...c, { role: "assistant", text: out.reply, raw: JSON.stringify(out), route: out.route, avoid: out.avoid, live: wasLive }]);
    setBusy(false);
  }, [live]);

  const loadRoute = useCallback((ids: string[]) => {
    const s = src.current.S;
    if (s.nav) return toast("End the expedition before loading a new route");
    const known = ids.filter(id => !!src.current.r.lm(id));
    if (!known.length) return;
    patch({ stops: known, routeOpt: 2, sel: null, override: null, elevOpen: false, heatOpen: false });
    setMode("route", "half");
    toast("Assistant route loaded · review the sequence");
  }, [patch, setMode, toast]);

  const value = useMemo(() => ({ chat, busy, live, send, loadRoute }), [chat, busy, live, send, loadRoute]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
