// Route assistant (sheet mode "assistant"): chat bubbles, a proposed-route card under any answer that
// plans a route (LOAD ROUTE puts it in the multi-stop sequence), a busy pill, TRY suggestions, and the
// input row pinned under the scrolling chat (AssistantInput, placed by the Sheet).
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, Keyboard, Platform, Pressable, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useApp } from "../state/store";
import { C, font, SHADOW } from "../theme";
import { T } from "../ui/Text";
import { CloseIcon } from "../ui/icons";
import { useRoutes } from "../route/RouteProvider";
import { cumul } from "../route/router";
import { fmtKm, fmtMin } from "../route/format";
import { MAX_INPUT, useAssistant, type ChatMsg } from "../assistant/AssistantProvider";
import { DUST_ID, STOP_MIN } from "../assistant/context";
import { HAZARD_ZONES } from "../map/hazards";

export const SUGGESTIONS = [
  "Safest route to Murray Buttes before the temperature drops",
  "Plan a 3-stop science day that stays clear of dust-devil heating",
  "What hazards are between here and Pahrump Hills?",
];

const hazardName = (id: string) => (id === DUST_ID ? "Dust devils" : HAZARD_ZONES.find(z => z.id === id)?.name ?? null);

function Blink({ children }: { children: string }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.2, duration: 500, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.Text style={[font(500, 13), { color: C.accent, opacity: o }]}>{children}</Animated.Text>;
}

function RouteCard({ m }: { m: ChatMsg }) {
  const r = useRoutes();
  const { loadRoute } = useAssistant();
  const o = r.ready ? r.routeOpts(m.route) : null;
  const route = o ? (o.safe.ok ? o.safe : o.direct) : null;
  const cum = route ? cumul(route.pts) : [];
  const total = route ? `${fmtKm(route.px)} · ${fmtMin(route.min + STOP_MIN * m.route.length)}` : "";
  const avoid = m.avoid.map(hazardName).filter(Boolean).join(", ");
  return (
    <View
      style={{
        width: "100%", backgroundColor: C.card, padding: 14, borderWidth: 1, borderColor: "rgba(127,212,193,0.22)",
        borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T w={700} size={10} ls={1} color={C.warm}>{o && !o.safe.ok ? "PROPOSED ROUTE · DIRECT ONLY" : "PROPOSED ROUTE"}</T>
        <T w={700} size={11} color={C.accent2}>{total}</T>
      </View>
      {m.route.map((id, i) => {
        const leg = route ? cum[route.legEnds[i + 1]] - cum[route.legEnds[i]] : null;
        return (
          <View key={`${id}-${i}`} style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(127,212,193,0.15)", alignItems: "center", justifyContent: "center" }}>
              <T w={700} size={10} color={C.accent2}>{String(i + 1).padStart(2, "0")}</T>
            </View>
            <T w={600} size={13} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{r.lm(id)?.name ?? id}</T>
            {leg !== null && Number.isFinite(leg) && <T w={500} size={10.5} color={C.fg2}>+{fmtKm(leg)}</T>}
          </View>
        );
      })}
      {!!avoid && <T w={500} size={10} ls={0.3} color={C.fg2} style={{ marginTop: 10 }}>AVOIDS · {avoid}</T>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Load route"
        onPress={() => loadRoute(m.route)}
        style={({ pressed }) => ({
          marginTop: 12, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center",
          backgroundColor: pressed ? C.ctaHover : C.cta, boxShadow: SHADOW.glow,
        })}
      >
        <T w={700} size={14} color={C.ctaInk}>LOAD ROUTE</T>
      </Pressable>
    </View>
  );
}

function Bubble({ m }: { m: ChatMsg }) {
  const u = m.role === "user";
  return (
    <View style={{ gap: 8, alignItems: u ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "88%", paddingVertical: 11, paddingHorizontal: 14, backgroundColor: u ? C.raised : C.card,
          borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: u ? 6 : 20, borderBottomLeftRadius: u ? 20 : 6,
        }}
      >
        <T w={500} size={13} lh={1.5} selectable>{m.text}</T>
      </View>
      {!u && m.route.length > 0 && <RouteCard m={m} />}
    </View>
  );
}

export function AssistantCard() {
  const { goHome } = useApp();
  const { chat, busy, live, send } = useAssistant();
  const last = [...chat].reverse().find(m => m.role === "assistant");
  // Offline (no key, no network, or a failed request) is a normal way to run, so it reads as a mode, not an error.
  const offline = "OFFLINE ASSISTANT · answers from sector data";
  const status = last
    ? last.live ? "LIVE MODEL · grounded in sector telemetry and hazard tracks" : offline
    : live === true ? "LIVE MODEL · knows every landmark, hazard track and the current telemetry"
    : offline;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T w={500} size={16} color={C.accent}>✦</T>
          <T w={700} size={22} ls={-0.5}>Route assistant</T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close assistant"
          onPress={() => goHome()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}
        >
          <CloseIcon />
        </Pressable>
      </View>
      <T w={500} size={10.5} ls={0.2} color={C.fg3} style={{ marginBottom: 4 }}>{status}</T>
      {chat.map((m, i) => <Bubble key={i} m={m} />)}
      {busy && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.row, alignSelf: "flex-start" }}>
          <Blink>✦</Blink>
          <T w={500} size={11} color={C.fg2}>checking telemetry and hazard tracks…</T>
        </View>
      )}
      {!chat.length && !busy && (
        <>
          <T w={700} size={10.5} ls={1} color={C.fg3} style={{ marginTop: 4 }}>TRY</T>
          {SUGGESTIONS.map(s => (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => send(s)}
              style={({ pressed }) => ({
                paddingVertical: 12, paddingHorizontal: 16, backgroundColor: pressed ? C.card : C.row,
                borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 8,
              })}
            >
              <T w={500} size={13} lh={1.45}>{s}</T>
            </Pressable>
          ))}
        </>
      )}
    </>
  );
}

/** The input row, pinned under the chat. On iOS it rides above the keyboard. */
export function AssistantInput({ insetBottom }: { insetBottom: number }) {
  const { busy, send } = useAssistant();
  const [text, setText] = useState("");
  const [kb, setKb] = useState(0);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", e => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const can = !!text.trim() && !busy;
  const submit = () => {
    if (!can) return;
    send(text);
    setText("");
  };
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: kb ? kb + 8 : 12 + insetBottom }}>
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        accessibilityLabel="Message the route assistant"
        placeholder="Ask for a route, a hazard check, a science plan…"
        placeholderTextColor={C.fg3}
        selectionColor={C.accent}
        returnKeyType="send"
        maxLength={MAX_INPUT}
        submitBehavior="submit"
        style={[font(500, 14), { flex: 1, minWidth: 0, height: 48, borderRadius: 999, backgroundColor: C.row, color: C.fg, paddingHorizontal: 18, outlineStyle: "none" } as object]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !can }}
        onPress={submit}
        style={{
          width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, alignItems: "center", justifyContent: "center",
          boxShadow: "0px 8px 20px rgba(127,212,193,0.3)", opacity: can ? 1 : 0.55,
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path d="M8 13V3M4 7l4-4 4 4" stroke={C.accentInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
  );
}
