// Elevation strata from the real DEM (100 m grid): L1 is the highest band (crater rim and upper
// Mount Sharp), L3 the lowest (the crater floor, Aeolis Palus). One band at a time, at the design's .74.
import { Image } from "react-native";
import { useApp } from "../../state/store";
import { dataUri, useMapData } from "../data";

export function StrataLayer() {
  const { state } = useApp();
  const st = useMapData().manifest?.strata;
  const level = st?.levels.find(l => l.level === state.elev);
  if (!st || !level) return null;
  const [x, y, w, h] = st.rect;
  return (
    <Image
      source={{ uri: dataUri(level.path) }}
      fadeDuration={0}
      resizeMode="stretch"
      style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: 0.74 }}
    />
  );
}

/** "−4 to −2 km", "above −2 km", "below −4 km" */
export function bandLabel(min: number | null, max: number | null): string {
  const km = (m: number) => `${m < 0 ? "−" : "+"}${Math.abs(m / 1000).toFixed(m % 1000 ? 1 : 0)} km`;
  if (min === null && max !== null) return `below ${km(max)}`;
  if (max === null && min !== null) return `above ${km(min)}`;
  return `${km(min ?? 0)} to ${km(max ?? 0)}`;
}
