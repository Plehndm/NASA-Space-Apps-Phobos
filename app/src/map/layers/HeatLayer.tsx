// Temperature layer: the pipeline's modelled ground or near-surface air temperature, one frame per
// 30 minutes of local solar time, for one of five seasons, on the fixed 150–320 K inferno scale.
import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { useApp } from "../../state/store";
import { heatUri, useMapData } from "../data";

export const HEAT_OPACITY = 0.66;
const PLAY_MS = 380; // the design's timelapse speed

/** Frame label "0930" → "09:30". */
export const fmtFrame = (f: string) => `${f.slice(0, 2)}:${f.slice(2)}`;

export function HeatLayer() {
  const { state: S, patch } = useApp();
  const heat = useMapData().manifest?.heat;
  const on = S.heat === "on" && !!heat;
  const frames = heat?.frames ?? [];
  const uri = heat && frames.length ? heatUri(heat, S.heatKind, S.heatSeason, frames[S.heatT % frames.length]) : null;

  // Fetch every frame of this season once the layer is on, so scrubbing and playback don't wait.
  useEffect(() => {
    if (!on || !heat) return;
    for (const f of heat.frames) Image.prefetch(heatUri(heat, S.heatKind, S.heatSeason, f)).catch(() => {});
  }, [on, heat, S.heatKind, S.heatSeason]);

  // Playback: step one frame every PLAY_MS, wrapping round the sol.
  const n = frames.length;
  useEffect(() => {
    if (!on || !S.heatPlay || !n) return;
    const id = setInterval(() => patch(s => ({ heatT: (s.heatT + 1) % n })), PLAY_MS);
    return () => clearInterval(id);
  }, [on, S.heatPlay, n, patch]);

  // Double buffer: keep showing the last loaded frame until the next one has loaded (no flicker).
  const [shown, setShown] = useState<string | null>(null);
  const want = useRef(uri);
  want.current = uri;
  if (!on || !heat || !uri) return null;
  const [x, y, w, h] = heat.rect;
  const fill = { position: "absolute" as const, left: 0, top: 0, width: w, height: h };
  // Opacity on the container, so the two buffered frames never add up.
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: HEAT_OPACITY }}>
      {shown && shown !== uri && <Image source={{ uri: shown }} fadeDuration={0} resizeMode="stretch" style={fill} />}
      <Image
        source={{ uri }}
        fadeDuration={0}
        resizeMode="stretch"
        style={fill}
        onLoad={() => { if (want.current === uri) setShown(uri); }}
      />
    </View>
  );
}
