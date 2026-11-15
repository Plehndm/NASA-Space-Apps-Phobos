// About & credits: what the app is, the team, the temperature model's limits and every layer's data
// sources. Opened from the bottom of Settings (back and DONE return there) or from a heat layer's
// "limits" link (opens at the limits; closing returns to the map). Text lives in ./credits.ts and
// ../map/heatLimits.ts.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, Linking, Pressable, View, type ScrollView } from "react-native";
import { useApp, type AppState } from "../state/store";
import { useMapData } from "../map/data";
import { HEAT_CHECKED, heatCaveats, KEY_LIMITS, LIMITS_DOCS } from "../map/heatLimits";
import { C } from "../theme";
import { Card, SectionLabel } from "../ui/Card";
import { T } from "../ui/Text";
import { Dialog } from "./Dialog";
import { ABOUT_CHALLENGE, ABOUT_GOAL, ABOUT_MEMBERS, ABOUT_TEAM, avatarUrl, creditGroups, type Member } from "./credits";

function Bullets({ lines, color = C.fg2 }: { lines: readonly string[]; color?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {lines.map(l => (
        <View key={l} style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.warm2, marginTop: 7 }} />
          <T w={500} size={11} lh={1.5} color={color} style={{ flex: 1 }}>{l}</T>
        </View>
      ))}
    </View>
  );
}

function Title({ children }: { children: string }) {
  return <T w={700} size={10.5} ls={1} color={C.fg2}>{children}</T>;
}

/** A DOI or URL as plain text; tapping it opens the browser. */
function Link({ url }: { url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={url} onPress={() => { Linking.openURL(url).catch(() => {}); }} hitSlop={4}>
      <T w={600} size={10} lh={1.45} color={C.accent2}>{url.replace(/^https:\/\//, "")}</T>
    </Pressable>
  );
}

/** GitHub profile picture over the member's initials, which show if the picture can't load (offline). */
function Avatar({ m }: { m: Member }) {
  const initials = m.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  return (
    <View style={{ width: 38, height: 38, borderRadius: 19, overflow: "hidden", backgroundColor: C.raised, alignItems: "center", justifyContent: "center" }}>
      <T w={800} size={12} color={C.warm}>{initials}</T>
      <Image source={{ uri: avatarUrl(m) }} accessibilityIgnoresInvertColors style={{ position: "absolute", width: 38, height: 38 }} />
    </View>
  );
}

export function AboutDialog() {
  const about = useApp().state.about;
  return about ? <About about={about} /> : null;
}

function About({ about }: { about: NonNullable<AppState["about"]> }) {
  const { patch } = useApp();
  const { manifest } = useMapData();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [limitsY, setLimitsY] = useState<number | null>(null);

  // Opened from a heat layer: jump to the limits once the section has been laid out.
  useEffect(() => {
    if (about.at === "limits" && limitsY !== null) scroll.current?.scrollTo({ y: Math.max(0, limitsY - 4), animated: false });
  }, [about.at, limitsY]);

  const close = () => patch({ about: null, settingsOpen: about.from === "settings" });
  const ground = heatCaveats(manifest?.heat, "ground");
  const air = heatCaveats(manifest?.heat, "air");
  const fromManifest = ground.from === "manifest" || air.from === "manifest";

  return (
    <Dialog
      label="About and credits"
      title="About"
      onClose={close}
      onBack={about.from === "settings" ? close : undefined}
      backLabel="Back to settings"
      scrollRef={scroll}
    >
      <Card pebble={1} style={{ gap: 8 }}>
        <T w={700} size={15} ls={-0.2}>Mars Navigator</T>
        <T w={500} size={11.5} lh={1.5} color={C.fg2}>{ABOUT_GOAL}</T>
        <View style={{ height: 1, backgroundColor: C.hair, marginVertical: 2 }} />
        <T w={700} size={10.5} ls={1} color={C.accent2}>{ABOUT_TEAM.toUpperCase()}</T>
        <View style={{ gap: 8 }}>
          {ABOUT_MEMBERS.map(m => (
            <View key={m.name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar m={m} />
              <View style={{ gap: 1, flex: 1 }}>
                <T w={600} size={12} lh={1.4}>{m.name} <T w={500} size={11} color={C.fg3}>· {m.role}</T></T>
                <Link url={m.github} />
              </View>
            </View>
          ))}
        </View>
        <T w={500} size={11} lh={1.45} color={C.fg3}>Challenge: “{ABOUT_CHALLENGE}”</T>
      </Card>

      <View style={{ gap: 10 }} onLayout={e => setLimitsY(e.nativeEvent.layout.y)}>
        <SectionLabel>TEMPERATURE MODEL LIMITS</SectionLabel>
        <Card pebble={2} style={{ gap: 10 }}>
          <T w={700} size={13}>{HEAT_CHECKED}</T>
          <Bullets lines={KEY_LIMITS} />
        </Card>
        <Card pebble={1} style={{ gap: 10 }}>
          <Title>GROUND MAP</Title>
          <Bullets lines={ground.lines} color={C.fg3} />
          <Title>AIR MAP</Title>
          <Bullets lines={air.lines} color={C.fg3} />
          <T w={500} size={10} lh={1.45} color={C.fg3}>
            {fromManifest ? "Map notes as published with the map data. " : "Built-in summary: the map data isn't loaded. "}
            Full method, scores and the literature check: {LIMITS_DOCS} in the project repository.
          </T>
        </Card>
      </View>

      <SectionLabel>DATA CREDITS</SectionLabel>
      {creditGroups(manifest).map((g, i) => (
        <Card key={g.title} pebble={i % 2 ? 1 : 2} style={{ gap: 8 }}>
          <Title>{g.title}</Title>
          {g.credit && <T w={600} size={11.5} lh={1.45}>{g.credit}</T>}
          {g.lines.map(l => (
            <View key={l.text} style={{ gap: 2 }}>
              <T w={500} size={10.5} lh={1.45} color={C.fg3}>{l.text}</T>
              {l.url && <Link url={l.url} />}
            </View>
          ))}
        </Card>
      ))}
    </Dialog>
  );
}
