import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useApp } from "../state/store";
import { C, R } from "../theme";
import { Card, SectionLabel } from "../ui/Card";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import { T } from "../ui/Text";
import { Dialog } from "./Dialog";

function Head({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={{ flexShrink: 1 }}>
      <T w={700} size={13}>{title}</T>
      <T w={500} size={10.5} lh={1.45} color={C.fg3} style={{ marginTop: 3 }}>{hint}</T>
    </View>
  );
}

function SliderCard({ pebble, title, hint, value, unit, min, max, step, left, right, onChange }: {
  pebble: 1 | 2; title: string; hint: string; value: number; unit: string; min: number; max: number; step: number;
  left: string; right: string; onChange: (v: number) => void;
}) {
  return (
    <Card pebble={pebble} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <Head title={title} hint={hint} />
        <View style={{ backgroundColor: C.raised, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999 }}>
          <T w={700} size={12} color={C.accent2}>{value}{unit}</T>
        </View>
      </View>
      <Slider
        accessibilityLabel={title}
        style={{ height: 24 }}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={v => onChange(Math.round(v))}
        minimumTrackTintColor={C.accent}
        maximumTrackTintColor={C.line}
        thumbTintColor={C.accent}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T w={500} size={9.5} color={C.fg3}>{left}</T>
        <T w={500} size={9.5} color={C.fg3}>{right}</T>
      </View>
    </Card>
  );
}

function SegCard({ pebble, children }: { pebble: 1 | 2; children: ReactNode }) {
  return <Card pebble={pebble} style={{ gap: 10 }}>{children}</Card>;
}

/** Settings: phone = bottom sheet, desktop = centred 480 px dialog (src/shell/Dialog.tsx). Opened from the header gear. */
export function SettingsDialog() {
  const { state, settings: o, setSetting, resetSettings, patch } = useApp();
  if (!state.settingsOpen) return null;
  const close = () => patch({ settingsOpen: false });

  return (
    <Dialog label="Settings" title="Settings" onClose={close}>
      <SectionLabel first>MAP</SectionLabel>
      <SegCard pebble={1}>
        <Head title="Layer controls" hint="Dock keeps elevation and heatmap in floating buttons; Panel opens them inside the sheet." />
        <Segmented value={o.layerPicker} options={[["dock", "DOCK"], ["panel", "PANEL"]]} onChange={v => { setSetting("layerPicker", v); patch({ elevOpen: false, heatOpen: false }); }} />
      </SegCard>
      <SegCard pebble={2}>
        <Head title="Hazard alerts" hint="Where the nearest-threat warning appears when warning zones are on." />
        <Segmented value={o.hazardStyle} options={[["advisory", "ADVISORY CARD"], ["banner", "TOP BANNER"]]} onChange={v => setSetting("hazardStyle", v)} />
      </SegCard>

      <SectionLabel>NAVIGATION</SectionLabel>
      <SegCard pebble={1}>
        <Head title="Progress card" hint="Stepped shows legs, radar and the grade map; Compact is a single ring." />
        <Segmented value={o.progressCard} options={[["stepped", "STEPPED"], ["compact", "COMPACT"]]} onChange={v => setSetting("progressCard", v)} />
      </SegCard>
      <SliderCard pebble={2} title="Rover grade limit" hint="Steepest slope Route #2 will plan across. Direct routes allow 25°."
        value={o.maxGrade} unit="°" min={8} max={30} step={1} left="8° cautious" right="30° aggressive" onChange={v => setSetting("maxGrade", v)} />
      <SliderCard pebble={1} title="Demo speed" hint="How fast the rover simulation runs relative to real time."
        value={o.demoSpeed} unit="×" min={10} max={240} step={10} left="10×" right="240×" onChange={v => setSetting("demoSpeed", v)} />

      <SectionLabel>SEARCH</SectionLabel>
      <SegCard pebble={2}>
        <Head title="Category chips" hint="Badge on each category: how many landmarks it holds, or its code." />
        <Segmented value={o.chipStyle} options={[["counts", "COUNTS"], ["icons", "ICONS"]]} onChange={v => setSetting("chipStyle", v)} />
      </SegCard>

      <SectionLabel>ASSISTANT</SectionLabel>
      <Card pebble={1} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Head title="Inline notes" hint="Show the assistant's waypoint notes on target and progress cards." />
        <Switch on={o.inlineNotes} onChange={v => setSetting("inlineNotes", v)} label="Inline notes" />
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="About & credits"
        onPress={() => patch({ settingsOpen: false, about: { from: "settings" } })}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginTop: 6, backgroundColor: pressed ? C.raised : C.card }, R.pebble2]}
      >
        <View style={{ flexShrink: 1, flexGrow: 1 }}>
          <T w={700} size={13}>About & credits</T>
          <T w={500} size={10.5} lh={1.45} color={C.fg3} style={{ marginTop: 3 }}>The team, data sources and the temperature model's limits.</T>
        </View>
        <T w={700} size={18} color={C.fg3}>›</T>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={resetSettings} style={{ height: 36, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
        <T w={600} size={11} ls={0.6} color={C.fg3}>RESET TO DEFAULTS</T>
      </Pressable>
    </Dialog>
  );
}
