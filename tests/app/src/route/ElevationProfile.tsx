// Elevation profile sparkline (the design's 300 × 44 profile): gradient-filled line, grades over 12° in
// warm, optional "you are here" marker with the driven part dimmed.
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { M_PER_PX } from "../map/geo";
import { C } from "../theme";
import type { Profile } from "./router";

const VW = 300, VH = 44;

export function profilePaths(samples: Profile["samples"]) {
  if (samples.length < 2) return null;
  const tot = samples[samples.length - 1].d || 1;
  let lo = Infinity, hi = -Infinity;
  for (const p of samples) if (p.h === p.h) { lo = Math.min(lo, p.h); hi = Math.max(hi, p.h); }
  const span = Math.max(hi - lo, 120);
  const X = (d: number) => (d / tot) * VW, Y = (h: number) => VH - 4 - ((h === h ? h : lo) - lo) / span * (VH - 8);
  const line = samples.map((p, i) => `${i ? "L" : "M"}${X(p.d).toFixed(1)} ${Y(p.h).toFixed(1)}`).join("");
  const steep: string[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], dd = b.d - a.d || 1e-6;
    if ((Math.atan(Math.abs(b.h - a.h) / (dd * M_PER_PX)) * 180) / Math.PI > 12) steep.push(`M${X(a.d).toFixed(1)} ${Y(a.h).toFixed(1)}L${X(b.d).toFixed(1)} ${Y(b.h).toFixed(1)}`);
  }
  /** Height (0–VH) of the profile at distance d. */
  const yAt = (d: number) => {
    let i = 0;
    while (i < samples.length - 1 && samples[i].d < d) i++;
    return Y(samples[i].h);
  };
  return { line, area: `${line}L${VW} ${VH}L0 ${VH}Z`, steep: steep.join(""), yAt, tot };
}

export function ElevationProfile({ samples, height = 44, at }: { samples: Profile["samples"]; height?: number; at?: number }) {
  const p = useMemo(() => profilePaths(samples), [samples]);
  if (!p) return <View style={{ height }} />;
  const frac = at === undefined ? null : Math.max(0, Math.min(1, at / p.tot));
  return (
    <View style={{ height, marginTop: 6 }}>
      <Svg pointerEvents="none" width="100%" height={height} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <Defs>
          <LinearGradient id="mnProfG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.accent} stopOpacity={0.35} />
            <Stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={p.area} fill="url(#mnProfG)" />
        <Path d={p.line} fill="none" stroke={C.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <Path d={p.steep} fill="none" stroke={C.warm} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </Svg>
      {frac !== null && (
        <>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: -4, bottom: -4, width: `${frac * 100}%`, backgroundColor: "rgba(27,16,13,0.45)" }} />
          <View pointerEvents="none" style={{ position: "absolute", left: `${frac * 100}%`, top: -4, bottom: -4, width: 2, marginLeft: -1, backgroundColor: C.warm3 }} />
          <View
            pointerEvents="none"
            style={{
              position: "absolute", left: `${frac * 100}%`, top: (p.yAt(at!) / VH) * height, width: 12, height: 12, marginLeft: -6, marginTop: -6,
              borderRadius: 6, backgroundColor: C.warm3, borderWidth: 2, borderColor: C.bg1,
            }}
          />
        </>
      )}
    </View>
  );
}
