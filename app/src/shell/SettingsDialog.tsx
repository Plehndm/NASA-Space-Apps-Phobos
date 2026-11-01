import { useEffect, type ReactNode } from "react";
import { useApp } from "../state/store";
import { Card, SectionLabel } from "../ui/Card";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";

function Head({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ font: "700 13px var(--font-ui)", color: "var(--fg)" }}>{title}</div>
      <div style={{ font: "500 10.5px var(--font-ui)", color: "var(--fg3)", marginTop: 3, lineHeight: 1.45 }}>{hint}</div>
    </div>
  );
}

function SliderCard({ pebble, title, hint, value, unit, min, max, step, left, right, onChange }: {
  pebble: 1 | 2; title: string; hint: string; value: number; unit: string; min: number; max: number; step: number;
  left: string; right: string; onChange: (v: number) => void;
}) {
  return (
    <Card pebble={pebble} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <Head title={title} hint={hint} />
        <span style={{ font: "700 12px var(--font-ui)", color: "var(--accent2)", background: "var(--raised)", padding: "6px 11px", borderRadius: 999, flex: "none" }}>
          {value}{unit}
        </span>
      </div>
      <input type="range" aria-label={title} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <div style={{ display: "flex", justifyContent: "space-between", font: "500 9.5px var(--font-ui)", color: "var(--fg3)" }}>
        <span>{left}</span><span>{right}</span>
      </div>
    </Card>
  );
}

function SegCard({ pebble, children }: { pebble: 1 | 2; children: ReactNode }) {
  return <Card pebble={pebble} style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</Card>;
}

/** Settings: phone = bottom sheet, desktop = centred 480 px dialog. Opened from the header gear. */
export function SettingsDialog() {
  const { state, geo, settings: o, setSetting, resetSettings, patch } = useApp();
  const close = () => patch({ settingsOpen: false });
  useEffect(() => {
    if (!state.settingsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") patch({ settingsOpen: false }); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [state.settingsOpen, patch]);
  if (!state.settingsOpen) return null;
  const desk = geo.device === "desktop";

  return (
    <>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(20,11,9,.55)", backdropFilter: "blur(4px)", zIndex: 9 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: "absolute", zIndex: 10, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg2)",
          ...(desk
            ? { left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 480, maxHeight: geo.H - 80, borderRadius: "var(--r-sheet)", boxShadow: "var(--shadow2)" }
            : { left: 0, right: 0, bottom: 0, maxHeight: Math.min(740, geo.H - 40), borderRadius: "var(--r-sheet) var(--r-sheet) 0 0", boxShadow: "var(--shadow-sheet)" }),
        }}
      >
        {desk ? (
          <div style={{ height: 20, flex: "none" }} />
        ) : (
          <div style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <div style={{ width: 44, height: 5, borderRadius: 3, background: "var(--line)" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px", flex: "none" }}>
          <span style={{ font: "700 22px var(--font-ui)", letterSpacing: "-.5px", color: "var(--fg)" }}>Settings</span>
          <button onClick={close} style={{ height: 32, padding: "0 14px", borderRadius: 999, background: "var(--raised)", border: 0, color: "var(--fg)", font: "700 10.5px var(--font-ui)", letterSpacing: ".5px", cursor: "pointer" }}>
            DONE
          </button>
        </div>

        <div className="mn-scroll mn-stack" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
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
          <Card pebble={1} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Head title="Inline notes" hint="Show the assistant's waypoint notes on target and progress cards." />
            <Switch on={o.inlineNotes} onChange={v => setSetting("inlineNotes", v)} label="Inline notes" />
          </Card>

          <button onClick={resetSettings} style={{ height: 36, background: "none", border: 0, color: "var(--fg3)", font: "600 11px var(--font-ui)", letterSpacing: ".6px", cursor: "pointer", marginTop: 4 }}>
            RESET TO DEFAULTS
          </button>
        </div>
      </div>
    </>
  );
}
