import { useEffect, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useApp } from "../state/store";
import { C, R, SHADOW } from "../theme";
import { Card, SectionLabel } from "../ui/Card";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import { T } from "../ui/Text";

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

/** Settings: phone = bottom sheet, desktop = centred 480 px dialog. Opened from the header gear. */
export function SettingsDialog() {
  const { state, geo, settings: o, setSetting, resetSettings, patch } = useApp();
  const close = () => patch({ settingsOpen: false });

  // Escape closes it on web (Android's back button is handled in AppShell).
  useEffect(() => {
    if (Platform.OS !== "web" || !state.settingsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") patch({ settingsOpen: false }); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.settingsOpen, patch]);

  if (!state.settingsOpen) return null;
  const desk = geo.device === "desktop";

  return (
    <>
      <Pressable accessibilityLabel="Close settings" onPress={close} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(20,11,9,0.55)", zIndex: 9 }} />
      <View
        accessibilityViewIsModal
        accessibilityLabel="Settings"
        style={[
          { position: "absolute", zIndex: 10, overflow: "hidden", backgroundColor: C.bg2 },
          desk
            ? { left: (geo.W - 480) / 2, width: 480, top: 40, maxHeight: geo.H - 80, borderRadius: R.sheet, boxShadow: SHADOW.s2, alignSelf: "center" }
            : { left: 0, right: 0, bottom: 0, maxHeight: Math.min(740, geo.H - geo.insetTop - 20), borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, boxShadow: SHADOW.sheet },
        ]}
      >
        {desk ? (
          <View style={{ height: 20 }} />
        ) : (
          <View style={{ height: 24, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 }}>
          <T w={700} size={22} ls={-0.5}>Settings</T>
          <Pressable accessibilityRole="button" onPress={close} style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.raised, justifyContent: "center" }}>
            <T w={700} size={10.5} ls={0.5}>DONE</T>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 + geo.insetBottom, gap: 10 }}>
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

          <Pressable accessibilityRole="button" onPress={resetSettings} style={{ height: 36, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
            <T w={600} size={11} ls={0.6} color={C.fg3}>RESET TO DEFAULTS</T>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}
