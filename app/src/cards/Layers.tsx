// Layers card (Settings → Layer controls = PANEL): elevation strata, ground / air temperature,
// warning zones with the dust-devil heating index, landing points, and the always-on imagery.
import { Pressable, View } from "react-native";
import { useApp } from "../state/store";
import { C } from "../theme";
import { Card } from "../ui/Card";
import { Switch } from "../ui/Switch";
import { T } from "../ui/Text";
import { useMapData } from "../map/data";
import {
  DustDevilControls, HazardChips, HeatHint, HeatKindAndSeason, HeatLegendBar, HeatSwitchRow, HeatTime, StrataBar, StrataChips, StrataHint,
} from "../map/LayerControls";

function Title({ children }: { children: string }) {
  return <T w={700} size={10.5} ls={1} color={C.fg2}>{children}</T>;
}

export function LayersCard() {
  const { state: S, patch, setMode, toast } = useApp();
  const { manifest } = useMapData();
  const heat = manifest?.heat;
  const done = () => setMode(S.navActive ? "nav" : "home", "peek");
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
        <T w={700} size={22} ls={-0.5}>Layers</T>
        <Pressable accessibilityRole="button" onPress={done} style={{ height: 34, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.raised, justifyContent: "center" }}>
          <T w={700} size={11} ls={0.6}>DONE</T>
        </Pressable>
      </View>

      <Card pebble={1} style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>ELEVATION STRATA</Title>
          <T w={500} size={9.5} color={C.fg3}>1 highest · 3 lowest</T>
        </View>
        <StrataChips withOff />
        <StrataBar />
        <StrataHint />
      </Card>

      <Card pebble={2} style={{ gap: 10 }}>
        <HeatSwitchRow />
        {heat ? (
          <>
            <HeatKindAndSeason heat={heat} />
            <HeatTime heat={heat} />
            <HeatLegendBar heat={heat} />
            <HeatHint heat={heat} />
          </>
        ) : (
          <T w={500} size={10} color={C.fg3}>Waiting for the map data server.</T>
        )}
      </Card>

      <Card pebble={1} style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>WARNING ZONES</Title>
          <Switch
            label="Warning zones"
            tone="cta"
            on={S.hazOn}
            onChange={on => {
              patch({ hazOn: on });
              if (on) toast("Warning zones on · 5 hazard types tracked");
            }}
          />
        </View>
        <HazardChips />
        {S.hazTypes.weather && <DustDevilControls />}
      </Card>

      <Card pebble={2} style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>LANDING POINTS</Title>
          <Switch label="Landing points" on={S.lz} onChange={lz => patch({ lz })} />
        </View>
        <View style={{ height: 1, backgroundColor: C.hair }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            <Title>SATELLITE IMAGERY</Title>
            <T w={500} size={10} color={C.fg3} style={{ marginTop: 3 }}>MRO CTX mosaic · 6 m/px · always on</T>
          </View>
          <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: C.raised }}>
            <T w={700} size={9} ls={0.6} color={C.accent2}>BASE</T>
          </View>
        </View>
        <T w={500} size={9.5} lh={1.45} color={C.fg3}>
          Imagery NASA/JPL-Caltech/MSSS · DTM NASA/JPL-Caltech/MSSS/NHM · THEMIS/TES NASA/JPL-Caltech/ASU
        </T>
      </Card>
    </>
  );
}
